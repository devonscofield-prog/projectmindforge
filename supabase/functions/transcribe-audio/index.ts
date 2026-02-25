/**
 * transcribe-audio Edge Function
 *
 * Receives an HMAC-signed internal call from process-audio-upload.
 * Downloads audio from Supabase Storage, transcribes via OpenAI Whisper,
 * writes the transcript to the database, and chains to downstream analysis.
 *
 * Supports both full-cycle and SDR pipelines.
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateSignedRequest, signedFetch } from "../_shared/hmac.ts";
import { getCorrelationId, createTracedLogger } from "../_shared/tracing.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

// Declare EdgeRuntime for Supabase Deno edge functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

// OpenAI Whisper file size limit (25MB). We chunk at 20MB for safety margin.
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;
const CHUNK_TARGET_BYTES = 20 * 1024 * 1024;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================================
// Whisper API types
// ============================================================

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

interface WhisperResponse {
  text: string;
  segments: WhisperSegment[];
  words?: WhisperWord[];
  duration?: number;
}

// ============================================================
// Helpers
// ============================================================

async function logEdgeMetric(
  supabase: any,
  metricName: string,
  durationMs: number,
  status: 'success' | 'error',
  metadata: Record<string, unknown> = {},
) {
  try {
    await supabase.from('performance_metrics').insert({
      metric_type: 'edge_function',
      metric_name: metricName,
      duration_ms: Math.round(durationMs),
      status,
      metadata,
    });
  } catch (metricError) {
    console.warn(`[transcribe-audio] Failed to write metric ${metricName}:`, metricError);
  }
}

/**
 * Derive MIME type and file extension from an audio file path.
 */
function getAudioMimeInfo(audioPath: string): { mimeType: string; extension: string } {
  const ext = (audioPath.split('.').pop() || '').toLowerCase();
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'audio/mp4',
    m4a: 'audio/x-m4a',
    wav: 'audio/wav',
    webm: 'audio/webm',
    ogg: 'audio/ogg',
  };
  return {
    mimeType: mimeMap[ext] || 'audio/mpeg',
    extension: ext || 'mp3',
  };
}

/**
 * Transcribe a single audio chunk via OpenAI Whisper API.
 * Uses fetchWithRetry for resilience against transient 429/5xx errors.
 *
 * NOTE: Byte-boundary chunking of compressed audio formats (mp3, m4a, ogg, etc.)
 * can corrupt the file structure and cause Whisper to fail. The 20MB chunk target
 * is set high enough to avoid chunking for the vast majority of real-world call
 * recordings (<60 min). If chunking IS triggered, it will only work reliably for
 * uncompressed formats (WAV). A future improvement would be to use ffmpeg or a
 * server-side splitter to chunk at silence boundaries.
 */
async function transcribeChunk(
  audioBytes: Uint8Array,
  openaiApiKey: string,
  chunkIndex: number,
  totalChunks: number,
  mimeType: string = 'audio/mpeg',
  fileExtension: string = 'mp3',
): Promise<WhisperResponse> {
  const formData = new FormData();
  // Use audioBytes.buffer to satisfy Deno's Blob constructor (expects ArrayBuffer, not Uint8Array)
  formData.append('file', new Blob([audioBytes.buffer], { type: mimeType }), `chunk_${chunkIndex}.${fileExtension}`);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'word');
  formData.append('timestamp_granularities[]', 'segment');

  console.log(`[transcribe-audio] Transcribing chunk ${chunkIndex + 1}/${totalChunks} (${(audioBytes.length / 1024 / 1024).toFixed(1)}MB)`);

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(300_000), // 5 minute timeout per chunk
    },
    { maxRetries: 3, baseDelayMs: 5000, agentName: 'Whisper' },
  );

  const data = await response.json();

  if (!data.text && !data.segments) {
    throw new Error(`Whisper returned unexpected response for chunk ${chunkIndex}: ${JSON.stringify(data).slice(0, 500)}`);
  }

  return data as WhisperResponse;
}

/**
 * Split an ArrayBuffer into byte-range chunks of approximately targetSize bytes.
 */
function splitIntoChunks(buffer: ArrayBuffer, targetSize: number): Uint8Array[] {
  const totalBytes = buffer.byteLength;
  if (totalBytes <= targetSize) {
    return [new Uint8Array(buffer)];
  }

  const chunks: Uint8Array[] = [];
  let offset = 0;

  while (offset < totalBytes) {
    const end = Math.min(offset + targetSize, totalBytes);
    chunks.push(new Uint8Array(buffer.slice(offset, end)));
    offset = end;
  }

  console.log(`[transcribe-audio] Split ${(totalBytes / 1024 / 1024).toFixed(1)}MB into ${chunks.length} chunks`);
  return chunks;
}

/**
 * Merge multiple Whisper responses into a single combined result.
 * Offsets timestamps of subsequent chunks by cumulative duration of prior chunks.
 */
function mergeWhisperResults(results: WhisperResponse[]): {
  fullText: string;
  segments: WhisperSegment[];
  words: WhisperWord[];
  totalDuration: number;
} {
  if (results.length === 1) {
    const r = results[0];
    const duration = r.duration ?? (r.segments?.length ? r.segments[r.segments.length - 1].end : 0);
    return {
      fullText: r.text,
      segments: r.segments || [],
      words: r.words || [],
      totalDuration: duration,
    };
  }

  let cumulativeOffset = 0;
  const allSegments: WhisperSegment[] = [];
  const allWords: WhisperWord[] = [];
  const textParts: string[] = [];

  for (const result of results) {
    textParts.push(result.text);

    if (result.segments) {
      for (const seg of result.segments) {
        allSegments.push({
          start: seg.start + cumulativeOffset,
          end: seg.end + cumulativeOffset,
          text: seg.text,
        });
      }
    }

    if (result.words) {
      for (const word of result.words) {
        allWords.push({
          word: word.word,
          start: word.start + cumulativeOffset,
          end: word.end + cumulativeOffset,
        });
      }
    }

    // Use the duration from the Whisper response, falling back to last segment end time
    const chunkDuration = result.duration
      ?? (result.segments?.length ? result.segments[result.segments.length - 1].end : 0);
    cumulativeOffset += chunkDuration;
  }

  return {
    fullText: textParts.join(' '),
    segments: allSegments,
    words: allWords,
    totalDuration: cumulativeOffset,
  };
}

/**
 * Format transcript text with segment timestamps for readability.
 * Since Whisper does not provide speaker diarization, we format with timestamps only.
 */
function formatTranscriptWithTimestamps(segments: WhisperSegment[]): string {
  if (!segments || segments.length === 0) {
    return '';
  }

  return segments.map((seg) => {
    const startMin = Math.floor(seg.start / 60);
    const startSec = Math.floor(seg.start % 60);
    const timestamp = `[${String(startMin).padStart(2, '0')}:${String(startSec).padStart(2, '0')}]`;
    return `${timestamp} ${seg.text.trim()}`;
  }).join('\n');
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);
  const log = createTracedLogger('transcribe-audio', correlationId);
  const requestStartedAt = performance.now();

  // Read body as text so we can validate the HMAC signature before parsing
  let bodyText: string;
  try {
    bodyText = await req.text();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Failed to read request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // ========== HMAC Signature Validation ==========
  // This function only accepts signed service-to-service requests
  const signatureValidation = await validateSignedRequest(req.headers, bodyText, supabaseServiceKey);
  if (!signatureValidation.valid) {
    log.warn('Invalid HMAC signature:', signatureValidation.error);
    return new Response(
      JSON.stringify({ error: 'Invalid request signature', details: signatureValidation.error }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  log.info('Validated signed service-to-service request');

  // ========== Parse & validate request body ==========
  let payload: {
    transcriptId: string;
    callId?: string;
    audioPath: string;
    pipeline: 'full_cycle' | 'sdr';
  };

  try {
    const body = JSON.parse(bodyText);
    payload = body;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { transcriptId, callId, audioPath, pipeline } = payload;

  // Validate required fields
  if (!transcriptId || !UUID_REGEX.test(transcriptId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing transcriptId' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (!audioPath || typeof audioPath !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing audioPath' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (pipeline !== 'full_cycle' && pipeline !== 'sdr') {
    return new Response(
      JSON.stringify({ error: 'Invalid pipeline. Must be "full_cycle" or "sdr"' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (pipeline === 'sdr' && callId && !UUID_REGEX.test(callId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid callId format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  log.info(`Starting transcription: pipeline=${pipeline}, transcriptId=${transcriptId}, audioPath=${audioPath}`);

  // ========== Update status to "transcribing" ==========
  try {
    if (pipeline === 'full_cycle') {
      await supabaseAdmin
        .from('call_transcripts')
        .update({ analysis_status: 'transcribing', analysis_error: null })
        .eq('id', transcriptId);
    } else {
      await supabaseAdmin
        .from('sdr_daily_transcripts')
        .update({ processing_status: 'transcribing' })
        .eq('id', transcriptId);
      if (callId) {
        await supabaseAdmin
          .from('sdr_calls')
          .update({ analysis_status: 'transcribing' })
          .eq('id', callId);
      }
    }
  } catch (statusErr) {
    log.warn('Failed to set initial transcribing status:', statusErr);
    // Non-fatal — continue with transcription
  }

  // ========== Fire-and-forget: return 202 immediately, process in background ==========
  const runBackgroundTranscription = async () => {
    try {
      // 1. Check file size before downloading to prevent OOM
      const folder = audioPath.split('/').slice(0, -1).join('/');
      const fileName = audioPath.split('/').pop() || '';
      const { data: files } = await supabaseAdmin.storage
        .from('call-audio')
        .list(folder, { search: fileName, limit: 1 });

      const fileMetadata = files?.find(f => f.name === fileName);
      const fileSizeBytes = fileMetadata?.metadata?.size || 0;
      const MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024; // 50MB safety limit for Edge Function memory

      if (fileSizeBytes > MAX_DOWNLOAD_BYTES) {
        throw new Error(`Audio file too large for processing (${(fileSizeBytes / 1024 / 1024).toFixed(1)}MB, max ${MAX_DOWNLOAD_BYTES / 1024 / 1024}MB). Please upload a smaller file or use a compressed format.`);
      }

      // 1b. Download audio from Supabase Storage
      log.info(`Downloading audio from call-audio/${audioPath}`);
      const { data: audioData, error: downloadError } = await supabaseAdmin.storage
        .from('call-audio')
        .download(audioPath);

      if (downloadError || !audioData) {
        throw new Error(`Failed to download audio: ${downloadError?.message || 'No data returned'}`);
      }

      const audioBuffer = await audioData.arrayBuffer();
      const fileSizeMB = audioBuffer.byteLength / 1024 / 1024;
      log.info(`Downloaded audio: ${fileSizeMB.toFixed(1)}MB`);

      // 2. Derive MIME type and extension from actual audio path
      const { mimeType, extension: fileExtension } = getAudioMimeInfo(audioPath);
      log.info(`Audio format: ${mimeType} (.${fileExtension})`);

      // 3. Chunk if necessary (>25MB)
      const chunks = audioBuffer.byteLength > WHISPER_MAX_BYTES
        ? splitIntoChunks(audioBuffer, CHUNK_TARGET_BYTES)
        : [new Uint8Array(audioBuffer)];

      if (chunks.length > 1 && fileExtension !== 'wav') {
        log.warn(`File requires chunking (${fileSizeMB.toFixed(1)}MB) but is a compressed format (${fileExtension}). Byte-boundary splitting may corrupt the audio. Attempting transcription anyway.`);
      }

      // 4. Transcribe each chunk sequentially (to stay within memory limits)
      const whisperResults: WhisperResponse[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const result = await transcribeChunk(chunks[i], openaiApiKey, i, chunks.length, mimeType, fileExtension);
        whisperResults.push(result);
      }

      // 5. Merge results
      const { fullText, segments, words, totalDuration } = mergeWhisperResults(whisperResults);

      if (!fullText || fullText.trim().length === 0) {
        throw new Error('Whisper returned empty transcript');
      }

      // 6. Format transcript with timestamps
      const formattedTranscript = formatTranscriptWithTimestamps(segments);
      // Use formatted version with timestamps if available, otherwise use raw text
      const transcriptText = formattedTranscript || fullText;

      log.info(`Transcription complete: ${totalDuration.toFixed(1)}s duration, ${segments.length} segments, ${words.length} words, ${transcriptText.length} chars`);

      // 7. Write transcript to database
      if (pipeline === 'full_cycle') {
        const { error: updateError } = await supabaseAdmin
          .from('call_transcripts')
          .update({
            raw_text: transcriptText,
            audio_duration_seconds: Math.round(totalDuration),
            analysis_status: 'transcribed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', transcriptId);

        if (updateError) {
          throw new Error(`Failed to update call_transcripts: ${updateError.message}`);
        }
        log.info(`Wrote transcript to call_transcripts (${transcriptId})`);
      } else {
        // SDR pipeline: update sdr_daily_transcripts and sdr_calls
        const { error: dailyUpdateError } = await supabaseAdmin
          .from('sdr_daily_transcripts')
          .update({
            raw_text: transcriptText,
            processing_status: 'transcribed',
          })
          .eq('id', transcriptId);

        if (dailyUpdateError) {
          throw new Error(`Failed to update sdr_daily_transcripts: ${dailyUpdateError.message}`);
        }

        if (callId) {
          const { error: callUpdateError } = await supabaseAdmin
            .from('sdr_calls')
            .update({
              raw_text: transcriptText,
              analysis_status: 'transcribed',
            })
            .eq('id', callId);

          if (callUpdateError) {
            log.warn(`Failed to update sdr_calls (${callId}):`, callUpdateError.message);
          }
        }

        log.info(`Wrote transcript to sdr_daily_transcripts (${transcriptId})${callId ? ` and sdr_calls (${callId})` : ''}`);
      }

      // 8. Chain to downstream analysis (fire-and-forget)
      log.info('Chaining to downstream analysis...');

      if (pipeline === 'full_cycle') {
        // Chain to analyze-call (existing)
        try {
          const analyzeResponse = await signedFetch(
            `${supabaseUrl}/functions/v1/analyze-call`,
            {
              method: 'POST',
              body: { call_id: transcriptId },
              serviceRoleKey: supabaseServiceKey,
            },
          );
          if (!analyzeResponse.ok) {
            const errText = await analyzeResponse.text();
            log.warn(`analyze-call chain failed (${analyzeResponse.status}):`, errText);
          } else {
            log.info('Chained to analyze-call successfully');
          }
        } catch (chainErr) {
          log.warn('Failed to chain to analyze-call:', chainErr);
        }

        // Chain to analyze-audio-voice for voice/tone analysis
        try {
          const voiceResponse = await signedFetch(
            `${supabaseUrl}/functions/v1/analyze-audio-voice`,
            {
              method: 'POST',
              body: {
                transcriptId,
                audioPath,
                pipeline: 'full_cycle',
                transcriptText,
              },
              serviceRoleKey: supabaseServiceKey,
            },
          );
          if (!voiceResponse.ok) {
            const errText = await voiceResponse.text();
            log.warn(`analyze-audio-voice chain failed (${voiceResponse.status}):`, errText);
          } else {
            log.info('Chained to analyze-audio-voice successfully');
          }
        } catch (chainErr) {
          log.warn('Failed to chain to analyze-audio-voice:', chainErr);
        }

      } else {
        // SDR pipeline: chain to sdr-grade-call (existing)
        // Use supabaseAdmin.functions.invoke() instead of signedFetch because
        // sdr-grade-call uses JWT auth (getUser), not HMAC validation.
        // The service-role client sends Authorization: Bearer <service_role_key>
        // which Supabase's function gateway accepts for service-to-service calls.
        if (callId) {
          try {
            const { error: gradeError } = await supabaseAdmin.functions.invoke(
              'sdr-grade-call',
              { body: { call_id: callId } },
            );
            if (gradeError) {
              log.warn(`sdr-grade-call chain failed:`, gradeError);
            } else {
              log.info(`Chained to sdr-grade-call for ${callId} successfully`);
            }
          } catch (chainErr) {
            log.warn('Failed to chain to sdr-grade-call:', chainErr);
          }
        }

        // Chain to analyze-audio-voice for voice/tone analysis
        try {
          const voiceResponse = await signedFetch(
            `${supabaseUrl}/functions/v1/analyze-audio-voice`,
            {
              method: 'POST',
              body: {
                transcriptId,
                callId,
                audioPath,
                pipeline: 'sdr',
                transcriptText,
              },
              serviceRoleKey: supabaseServiceKey,
            },
          );
          if (!voiceResponse.ok) {
            const errText = await voiceResponse.text();
            log.warn(`analyze-audio-voice chain failed (${voiceResponse.status}):`, errText);
          } else {
            log.info('Chained to analyze-audio-voice successfully');
          }
        } catch (chainErr) {
          log.warn('Failed to chain to analyze-audio-voice:', chainErr);
        }
      }

      // 9. Log success metric
      await logEdgeMetric(
        supabaseAdmin,
        'transcribe-audio.total',
        performance.now() - requestStartedAt,
        'success',
        {
          pipeline,
          transcriptId,
          audioSizeMB: fileSizeMB,
          durationSeconds: totalDuration,
          chunkCount: chunks.length,
          segmentCount: segments.length,
          wordCount: words.length,
          transcriptLength: transcriptText.length,
        },
      );

      log.info(`Transcription pipeline complete for ${transcriptId} (${totalDuration.toFixed(1)}s audio, ${chunks.length} chunk(s))`);

    } catch (bgError) {
      const errorMessage = bgError instanceof Error ? bgError.message : String(bgError);
      log.error('Background transcription failed:', errorMessage);

      // Update status to error
      try {
        if (pipeline === 'full_cycle') {
          await supabaseAdmin
            .from('call_transcripts')
            .update({
              analysis_status: 'error',
              analysis_error: `Transcription failed: ${errorMessage}`,
            })
            .eq('id', transcriptId);
        } else {
          await supabaseAdmin
            .from('sdr_daily_transcripts')
            .update({ processing_status: 'failed' })
            .eq('id', transcriptId);
          if (callId) {
            await supabaseAdmin
              .from('sdr_calls')
              .update({ analysis_status: 'failed' })
              .eq('id', callId);
          }
        }
      } catch (statusUpdateErr) {
        log.error('Failed to update error status:', statusUpdateErr);
      }

      // Log error metric
      await logEdgeMetric(
        supabaseAdmin,
        'transcribe-audio.total',
        performance.now() - requestStartedAt,
        'error',
        {
          pipeline,
          transcriptId,
          error: errorMessage,
        },
      );
    }
  };

  EdgeRuntime.waitUntil(runBackgroundTranscription());

  // Return 202 Accepted immediately
  return new Response(
    JSON.stringify({
      status: 'transcribing',
      message: 'Transcription started in background',
      transcriptId,
      pipeline,
    }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
