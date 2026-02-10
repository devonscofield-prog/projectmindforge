import { createClient } from "@supabase/supabase-js";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { daily_transcript_id, raw_text, sdr_id, transcript_date } = body;

    let transcriptId = daily_transcript_id;

    // If raw text provided, create the daily transcript record first
    if (!transcriptId && raw_text) {
      const targetSdrId = sdr_id || user.id;
      const { data: transcript, error: insertError } = await supabase
        .from('sdr_daily_transcripts')
        .insert({
          sdr_id: targetSdrId,
          transcript_date: transcript_date || new Date().toISOString().split('T')[0],
          raw_text,
          processing_status: 'processing',
          uploaded_by: user.id,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      transcriptId = transcript.id;
    }

    if (!transcriptId) {
      return new Response(JSON.stringify({ error: 'Must provide daily_transcript_id or raw_text' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch transcript if we only have the ID
    const { data: transcriptRecord, error: fetchError } = await supabase
      .from('sdr_daily_transcripts')
      .select('*')
      .eq('id', transcriptId)
      .single();

    if (fetchError || !transcriptRecord) {
      return new Response(JSON.stringify({ error: 'Transcript not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // If retrying, clean up old calls and grades from previous attempt
    const isRetry = transcriptRecord.processing_status === 'failed' || transcriptRecord.processing_status === 'partial';
    if (isRetry || daily_transcript_id) {
      // Delete old grades first (FK dependency)
      const { data: oldCalls } = await supabase
        .from('sdr_calls')
        .select('id')
        .eq('daily_transcript_id', transcriptId);

      if (oldCalls && oldCalls.length > 0) {
        const oldCallIds = oldCalls.map((c: any) => c.id);
        await supabase
          .from('sdr_call_grades')
          .delete()
          .in('call_id', oldCallIds);
        await supabase
          .from('sdr_calls')
          .delete()
          .eq('daily_transcript_id', transcriptId);
        console.log(`[sdr-pipeline] Retry: cleaned up ${oldCalls.length} old calls for transcript ${transcriptId}`);
      }
    }

    // Mark as processing
    await supabase
      .from('sdr_daily_transcripts')
      .update({ processing_status: 'processing', processing_error: null })
      .eq('id', transcriptId);

    // Start background processing
    EdgeRuntime.waitUntil(
      processTranscriptPipeline(supabase, openaiApiKey, transcriptId, transcriptRecord.raw_text, transcriptRecord.sdr_id)
    );

    return new Response(JSON.stringify({
      daily_transcript_id: transcriptId,
      status: 'processing',
      message: 'Transcript processing started. Poll for status updates.',
    }), {
      status: 202,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sdr-process-transcript] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// ============================================================
// PIPELINE: Split → Filter → Grade
// ============================================================

async function processTranscriptPipeline(
  supabase: any,
  openaiApiKey: string,
  transcriptId: string,
  rawText: string,
  sdrId: string,
) {
  try {
    console.log(`[sdr-pipeline] Starting pipeline for transcript ${transcriptId}`);

    // Load custom prompts for this SDR's team (if any)
    const customPrompts = await loadCustomPrompts(supabase, sdrId);

    // ---- STAGE 1: Split transcript into individual calls ----
    console.log('[sdr-pipeline] Stage 1: Splitting transcript...');
    let splitCalls: Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>;
    try {
      splitCalls = await runSplitterAgent(openaiApiKey, rawText, customPrompts.splitter);
      console.log(`[sdr-pipeline] Splitter found ${splitCalls.length} segments`);
    } catch (error) {
      console.error(`[sdr-pipeline] Splitter agent failed: ${error.message}`);
      await updateTranscriptError(supabase, transcriptId, `Splitter failed: ${error.message}`);
      return;
    }

    if (!splitCalls || splitCalls.length === 0) {
      console.warn('[sdr-pipeline] Splitter returned 0 segments');
      await supabase
        .from('sdr_daily_transcripts')
        .update({
          processing_status: 'failed',
          processing_error: 'No calls detected in transcript. The transcript may be empty or in an unrecognized format.',
          total_calls_detected: 0,
          meaningful_calls_count: 0,
        })
        .eq('id', transcriptId);
      return;
    }

    // ---- STAGE 2: Filter/classify each segment ----
    console.log('[sdr-pipeline] Stage 2: Filtering/classifying segments...');
    let classifiedCalls: Array<any>;
    try {
      classifiedCalls = await runFilterAgent(openaiApiKey, splitCalls, customPrompts.filter);
      const meaningfulCount = classifiedCalls.filter(c => c.is_meaningful).length;
      console.log(`[sdr-pipeline] Filter found ${meaningfulCount} meaningful calls out of ${classifiedCalls.length}`);
    } catch (error) {
      console.error(`[sdr-pipeline] Filter agent failed: ${error.message}`);
      await updateTranscriptError(supabase, transcriptId, `Filter failed: ${error.message}`);
      return;
    }

    // ---- Insert all calls into DB ----
    const callInserts = classifiedCalls.map((call, idx) => ({
      daily_transcript_id: transcriptId,
      sdr_id: sdrId,
      call_index: idx + 1,
      raw_text: call.raw_text,
      call_type: call.call_type,
      is_meaningful: call.is_meaningful,
      prospect_name: call.prospect_name || null,
      prospect_company: call.prospect_company || null,
      duration_estimate_seconds: call.duration_estimate_seconds || null,
      start_timestamp: call.start_timestamp || null,
      analysis_status: call.is_meaningful ? 'pending' : 'skipped',
    }));

    const { data: insertedCalls, error: insertError } = await supabase
      .from('sdr_calls')
      .insert(callInserts)
      .select('id, is_meaningful');

    if (insertError) {
      console.error(`[sdr-pipeline] Failed to insert calls: ${insertError.message}`);
      await updateTranscriptError(supabase, transcriptId, `DB insert failed: ${insertError.message}`);
      return;
    }

    // ---- STAGE 3: Grade meaningful calls ----
    const meaningfulCalls = insertedCalls.filter((c: any) => c.is_meaningful);
    console.log(`[sdr-pipeline] Stage 3: Grading ${meaningfulCalls.length} meaningful calls...`);

    let gradedCount = 0;
    let failedCount = 0;

    for (const call of meaningfulCalls) {
      try {
        await supabase.from('sdr_calls').update({ analysis_status: 'processing' }).eq('id', call.id);
        
        const callData = classifiedCalls.find((_, idx) => insertedCalls[idx]?.id === call.id)
          || classifiedCalls[insertedCalls.indexOf(call)];
        
        const grade = await runGraderAgent(openaiApiKey, callData.raw_text, customPrompts.grader);
        
        await supabase.from('sdr_call_grades').insert({
          call_id: call.id,
          sdr_id: sdrId,
          overall_grade: grade.overall_grade,
          opener_score: grade.opener_score,
          engagement_score: grade.engagement_score,
          objection_handling_score: grade.objection_handling_score,
          appointment_setting_score: grade.appointment_setting_score,
          professionalism_score: grade.professionalism_score,
          call_summary: grade.call_summary,
          strengths: grade.strengths,
          improvements: grade.improvements,
          key_moments: grade.key_moments,
          coaching_notes: grade.coaching_notes,
          model_name: 'gpt-5.2-2025-12-11',
          raw_json: grade,
        });

        await supabase.from('sdr_calls').update({ analysis_status: 'completed' }).eq('id', call.id);
        gradedCount++;
      } catch (gradeError) {
        failedCount++;
        console.error(`[sdr-pipeline] Failed to grade call ${call.id} after retries:`, gradeError);
        await supabase.from('sdr_calls').update({
          analysis_status: 'failed',
        }).eq('id', call.id);
      }
    }

    // ---- Update transcript status ----
    const meaningfulCount = classifiedCalls.filter(c => c.is_meaningful).length;
    const finalStatus = failedCount === 0 ? 'completed' : (gradedCount > 0 ? 'partial' : 'failed');

    await supabase
      .from('sdr_daily_transcripts')
      .update({
        processing_status: finalStatus,
        total_calls_detected: classifiedCalls.length,
        meaningful_calls_count: meaningfulCount,
        ...(failedCount > 0 ? { processing_error: `${failedCount}/${meaningfulCount} calls failed grading` } : {}),
      })
      .eq('id', transcriptId);

    console.log(`[sdr-pipeline] Pipeline complete for transcript ${transcriptId} — status: ${finalStatus}, graded: ${gradedCount}, failed: ${failedCount}`);

  } catch (error) {
    console.error(`[sdr-pipeline] Pipeline failed for transcript ${transcriptId}:`, error);
    await updateTranscriptError(supabase, transcriptId, error.message || 'Unknown error');
  }
}

// ============================================================
// Helper: Update transcript with error
// ============================================================

async function updateTranscriptError(supabase: any, transcriptId: string, errorMessage: string) {
  try {
    await supabase
      .from('sdr_daily_transcripts')
      .update({
        processing_status: 'failed',
        processing_error: errorMessage.slice(0, 1000), // Truncate long errors
      })
      .eq('id', transcriptId);
  } catch (dbError) {
    console.error(`[sdr-pipeline] CRITICAL: Failed to update error status for ${transcriptId}:`, dbError);
  }
}

// ============================================================
// AGENT 1: Splitter — Finds call boundaries
// ============================================================

const DEFAULT_SPLITTER_PROMPT = `You are an expert transcript analyst specializing in SDR cold call dialer sessions.

You will receive a full-day transcript from an SDR's dialer system. This transcript contains MANY calls concatenated together — real conversations, voicemails, automated phone systems, hangups, and "in-between" chatter where the rep talks to coworkers while waiting for the next call.

Your job is to SPLIT this transcript into individual segments. Each segment represents one distinct phone interaction or one block of in-between chatter.

## How to detect call boundaries:
1. **Timestamp gaps**: A gap of 30+ seconds between lines, combined with a new greeting pattern, strongly indicates a new call
2. **New greeting patterns**: Lines like "Hello", "Hi, is this [name]?", "Hey [name], this is [rep name]" signal a new call starting
3. **Speaker label changes**: When "Speaker N" numbers reset or change significantly  
4. **Voicemail system prompts**: "You have reached the voicemail of..." indicates a voicemail segment
5. **Automated phone systems**: "Thank you for calling...", "Press 1 for...", "Please listen carefully..." indicate IVR navigation
6. **In-between chatter**: Extended blocks where the rep talks casually (about food, sports, personal topics) without any prospect on the line — these are between-call idle time

## Important notes:
- The transcript uses the format: "Speaker N | MM:SS" or "username | MM:SS" or "username | HH:MM:SS"
- Some timestamps reset or use different formats — use context clues alongside timestamps
- A single "call" might include the rep navigating an IVR system to reach someone — keep that as one segment
- Voicemails that play during dialing (prospect's VM greeting) are their own short segment

Return a JSON array where each element has:
- "raw_text": The full text of that segment (preserve original formatting)
- "start_timestamp": The timestamp of the first line in the segment
- "approx_duration_seconds": Estimated duration based on timestamps (null if unclear)

Return ONLY valid JSON. No markdown, no explanation.`;

// Maximum characters per chunk sent to the Splitter.
// ~25k chars ≈ ~6k tokens — keeps each chunk well within the model's reliable output range.
// Previous value of 50k caused model refusals on ~42k chunks ("too long to segment reliably").
const SPLITTER_CHUNK_MAX_CHARS = 25_000;

/**
 * Split a long transcript into overlapping text chunks by finding natural
 * line-break boundaries. Each chunk shares a small overlap so the Splitter
 * doesn't miss a call that spans the boundary.
 */
function chunkTranscriptText(rawText: string, maxChars: number): string[] {
  if (rawText.length <= maxChars) return [rawText];

  const lines = rawText.split('\n');
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLen = 0;
  const OVERLAP_LINES = 30; // lines of overlap between chunks

  for (const line of lines) {
    if (currentLen + line.length + 1 > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      // Keep last OVERLAP_LINES lines as overlap for the next chunk
      const overlap = currentChunk.slice(-OVERLAP_LINES);
      currentChunk = [...overlap];
      currentLen = overlap.reduce((sum, l) => sum + l.length + 1, 0);
    }
    currentChunk.push(line);
    currentLen += line.length + 1;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Send a single text chunk to the Splitter model and return extracted segments.
 */
async function runSplitterOnChunk(
  openaiApiKey: string,
  chunkText: string,
  systemPrompt: string,
  chunkIndex: number,
  totalChunks: number,
): Promise<Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>> {
  const chunkLabel = totalChunks > 1 ? ` (chunk ${chunkIndex + 1}/${totalChunks})` : '';

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      signal: AbortSignal.timeout(90000),
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2-2025-12-11',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Here is a section of an SDR dialer transcript. Split it into individual call segments:\n\n${chunkText}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    },
    { maxRetries: 3, baseDelayMs: 2000, agentName: `Splitter${chunkLabel}` },
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Splitter returned empty response${chunkLabel}`);

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Splitter returned invalid JSON${chunkLabel}: ${content.slice(0, 200)}`);
  }

  let segments: any[] | null = null;
  if (Array.isArray(parsed)) {
    segments = parsed;
  } else {
    for (const key of ['segments', 'calls', 'data', 'results']) {
      if (Array.isArray(parsed[key])) { segments = parsed[key]; break; }
    }
    if (!segments) {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0) { segments = val as any[]; break; }
      }
    }
  }

  // Fallback: if no array found, check if the response is a single segment object
  if (!segments && typeof parsed === 'object' && parsed !== null && (parsed as any).raw_text) {
    console.log(`[sdr-pipeline] Splitter returned single segment object${chunkLabel}, wrapping in array`);
    segments = [parsed];
  }

  if (!segments) {
    console.error(`[sdr-pipeline] Splitter raw content${chunkLabel}: ${content.slice(0, 500)}`);
    throw new Error(`Splitter returned unexpected structure${chunkLabel}: ${Object.keys(parsed).join(', ')}`);
  }

  return segments;
}

/**
 * Deduplicate segments that appear in overlapping chunks.
 * Uses start_timestamp + first 100 chars of raw_text as a fingerprint.
 */
function deduplicateSegments(
  segments: Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>,
): Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }> {
  const seen = new Set<string>();
  const unique: typeof segments = [];
  for (const seg of segments) {
    const fingerprint = `${seg.start_timestamp}::${(seg.raw_text || '').slice(0, 100)}`;
    if (!seen.has(fingerprint)) {
      seen.add(fingerprint);
      unique.push(seg);
    }
  }
  return unique;
}

async function runSplitterAgent(
  openaiApiKey: string,
  rawText: string,
  customPrompt?: string,
): Promise<Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>> {
  const systemPrompt = customPrompt || DEFAULT_SPLITTER_PROMPT;
  const chunks = chunkTranscriptText(rawText, SPLITTER_CHUNK_MAX_CHARS);

  console.log(`[sdr-pipeline] Transcript length: ${rawText.length} chars → ${chunks.length} chunk(s)`);

  // Process chunks sequentially to avoid rate limits
  const allSegments: Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunkSegments = await runSplitterOnChunk(openaiApiKey, chunks[i], systemPrompt, i, chunks.length);
    console.log(`[sdr-pipeline] Chunk ${i + 1}/${chunks.length} returned ${chunkSegments.length} segments`);
    allSegments.push(...chunkSegments);
  }

  // Deduplicate segments from overlapping regions
  const deduplicated = chunks.length > 1 ? deduplicateSegments(allSegments) : allSegments;

  if (chunks.length > 1) {
    console.log(`[sdr-pipeline] After dedup: ${deduplicated.length} segments (from ${allSegments.length} raw)`);
  }

  return deduplicated;
}

// ============================================================
// AGENT 2: Filter — Classifies each segment
// ============================================================

const DEFAULT_FILTER_PROMPT = `You are an expert at classifying SDR cold call transcript segments.

You will receive an array of transcript segments from an SDR's day. Classify each one.

## Classification types:
- **"conversation"**: A real interaction where the SDR spoke with a prospect/contact. The prospect answered, there was back-and-forth dialogue. This includes:
  - Cold calls where the prospect engaged (even briefly to say "not interested")
  - Callback conversations
  - Follow-up reminder calls where the prospect answered
- **"voicemail"**: The call went to voicemail. Either the SDR heard a VM greeting, or left a message. Very short segments with VM system prompts.
- **"hangup"**: Immediate disconnect — the prospect hung up instantly or the line went dead with minimal/no interaction.
- **"internal"**: Between-call chatter. The SDR talking to coworkers about non-work topics (food, sports, personal stories), or discussing work logistics (Salesforce, scheduling). NO prospect is on the line.
- **"reminder"**: The SDR called specifically to remind someone about an upcoming meeting (not a cold call pitch). Usually very short: "Hey, just calling to remind you about the call in 40 minutes."

## What counts as "meaningful" (is_meaningful = true):
A call is meaningful if it's a "conversation" type AND:
- The SDR actually spoke with a prospect (not a voicemail/machine)
- This includes prospects who declined, agreed to a meeting, gave a quick "not interested," or any other real human interaction
- Even a brief "no thanks" counts as meaningful — the SDR reached a real person

NOT meaningful:
- Voicemails, hangups, internal chatter, and reminder calls
- Automated systems / IVR menus with no human contact

## For each segment, also extract:
- **prospect_name**: The prospect's name if mentioned (null otherwise)
- **prospect_company**: Their company if mentioned (null otherwise)

Return a JSON object with a "calls" array. Each element:
{
  "segment_index": <0-based index matching input>,
  "call_type": "conversation" | "voicemail" | "hangup" | "internal" | "reminder",
  "is_meaningful": true/false,
  "prospect_name": "Name" or null,
  "prospect_company": "Company" or null,
  "reasoning": "Brief explanation of classification"
}

Return ONLY valid JSON.`;

// Maximum segments per batch sent to the Filter agent.
// Keeps each request within token limits for transcripts with many calls.
const FILTER_BATCH_SIZE = 10;

async function runFilterOnBatch(
  openaiApiKey: string,
  batchSegments: Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>,
  batchStartIndex: number,
  systemPrompt: string,
  batchLabel: string,
): Promise<any[]> {
  const segmentInputs = batchSegments.map((seg, idx) => ({
    index: batchStartIndex + idx,
    start_timestamp: seg.start_timestamp,
    approx_duration_seconds: seg.approx_duration_seconds,
    text: seg.raw_text,
  }));

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2-2025-12-11',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Classify these ${batchSegments.length} transcript segments:\n\n${JSON.stringify(segmentInputs)}` },
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    },
    { maxRetries: 3, baseDelayMs: 2000, agentName: `Filter${batchLabel}` },
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`Filter returned empty response${batchLabel}`);

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Filter returned invalid JSON${batchLabel}: ${content.slice(0, 200)}`);
  }

  let classifications: any[] | null = null;
  if (Array.isArray(parsed)) {
    classifications = parsed;
  } else {
    for (const key of ['calls', 'classifications', 'data', 'results']) {
      if (Array.isArray(parsed[key])) { classifications = parsed[key]; break; }
    }
    if (!classifications) {
      for (const val of Object.values(parsed)) {
        if (Array.isArray(val) && val.length > 0) { classifications = val as any[]; break; }
      }
    }
  }

  if (!classifications) {
    console.error(`[sdr-pipeline] Filter raw content${batchLabel}: ${content.slice(0, 500)}`);
    throw new Error(`Filter returned unexpected structure${batchLabel}: ${Object.keys(parsed).join(', ')}`);
  }

  return classifications;
}

async function runFilterAgent(
  openaiApiKey: string,
  segments: Array<{ raw_text: string; start_timestamp: string; approx_duration_seconds: number | null }>,
  customPrompt?: string,
): Promise<Array<{
  raw_text: string;
  call_type: string;
  is_meaningful: boolean;
  prospect_name: string | null;
  prospect_company: string | null;
  duration_estimate_seconds: number | null;
  start_timestamp: string;
}>> {
  const systemPrompt = customPrompt || DEFAULT_FILTER_PROMPT;

  // Process in batches to avoid token overflow with many segments
  const allClassifications: any[] = [];
  const totalBatches = Math.ceil(segments.length / FILTER_BATCH_SIZE);

  for (let i = 0; i < segments.length; i += FILTER_BATCH_SIZE) {
    const batch = segments.slice(i, i + FILTER_BATCH_SIZE);
    const batchIndex = Math.floor(i / FILTER_BATCH_SIZE);
    const batchLabel = totalBatches > 1 ? ` (batch ${batchIndex + 1}/${totalBatches})` : '';

    console.log(`[sdr-pipeline] Filter${batchLabel}: classifying ${batch.length} segments`);
    const batchClassifications = await runFilterOnBatch(openaiApiKey, batch, i, systemPrompt, batchLabel);
    allClassifications.push(...batchClassifications);
  }

  return segments.map((seg, idx) => {
    const classification = allClassifications.find((c: any) => c.segment_index === idx) || allClassifications[idx] || {};
    return {
      raw_text: seg.raw_text,
      call_type: classification.call_type || 'internal',
      is_meaningful: classification.is_meaningful || false,
      prospect_name: classification.prospect_name || null,
      prospect_company: classification.prospect_company || null,
      duration_estimate_seconds: seg.approx_duration_seconds,
      start_timestamp: seg.start_timestamp,
    };
  });
}

// ============================================================
// AGENT 3: Grader — Scores meaningful calls
// ============================================================

const DEFAULT_GRADER_PROMPT = `You are an expert SDR cold call coach. You grade individual cold calls on specific skills.

You will receive the transcript of a single SDR cold call. Grade it on these 5 dimensions (each scored 1-10):

## Scoring Dimensions:

### 1. Opener Score (opener_score)
- Did the SDR introduce themselves clearly?
- Did they reference a prior connection or reason for calling?
- Did they create enough curiosity to keep the prospect on the line?
- Were they warm and conversational vs robotic and scripted?

### 2. Engagement Score (engagement_score)  
- Did the SDR ask questions about the prospect's needs/situation?
- Did they listen and respond to what the prospect said?
- Did they build rapport (casual conversation, empathy, humor)?
- Did the prospect stay engaged and participatory?

### 3. Objection Handling Score (objection_handling_score)
- If the prospect raised objections ("not interested", "send an email", "too busy"), how well did the SDR handle them?
- Did they acknowledge the objection before redirecting?
- Did they offer a low-commitment alternative?
- If no objections occurred, score based on how well they preempted potential resistance
- Score N/A as 5 (neutral) if truly no opportunity for objections

### 4. Appointment Setting Score (appointment_setting_score)
- Did the SDR attempt to book a meeting/demo?
- Did they suggest specific times?
- Did they confirm the prospect's email/calendar?
- Did they get a firm commitment vs a vague "maybe"?
- If an appointment was set: how smoothly was it handled?

### 5. Professionalism Score (professionalism_score)
- Was the SDR courteous and professional?
- Did they maintain a good pace (not rushing, not dragging)?
- Did they handle the call close well (clear next steps, friendly goodbye)?
- Were there any unprofessional moments?

## Overall Grade
Based on the weighted scores, assign an overall letter grade:
- A+ (9.5-10): Exceptional — textbook cold call
- A (8.5-9.4): Excellent — strong across all dimensions
- B (7-8.4): Good — solid performance with minor improvements needed
- C (5.5-6.9): Average — functional but significant improvement areas
- D (4-5.4): Below average — multiple weaknesses
- F (below 4): Poor — fundamental issues

## Response Format
Return a JSON object:
{
  "overall_grade": "A/B/C/D/F/A+",
  "opener_score": 1-10,
  "engagement_score": 1-10,
  "objection_handling_score": 1-10,
  "appointment_setting_score": 1-10,
  "professionalism_score": 1-10,
  "call_summary": "2-3 sentence summary of what happened on this call",
  "strengths": ["strength 1", "strength 2", ...],
  "improvements": ["improvement 1", "improvement 2", ...],
  "key_moments": [
    {"timestamp": "MM:SS", "description": "What happened", "sentiment": "positive/negative/neutral"}
  ],
  "coaching_notes": "1-2 paragraphs of specific, actionable coaching advice for this SDR based on this call"
}

Return ONLY valid JSON.`;

async function runGraderAgent(
  openaiApiKey: string,
  callText: string,
  customPrompt?: string,
): Promise<any> {
  const systemPrompt = customPrompt || DEFAULT_GRADER_PROMPT;

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2-2025-12-11',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Grade this SDR cold call:\n\n${callText}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    },
    { maxRetries: 3, baseDelayMs: 2000, agentName: 'Grader' },
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Grader returned empty response');

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Grader returned invalid JSON: ${content.slice(0, 200)}`);
  }
}

// ============================================================
// Load custom prompts for an SDR's team
// ============================================================

async function loadCustomPrompts(
  supabase: any,
  sdrId: string,
): Promise<{ splitter?: string; filter?: string; grader?: string }> {
  try {
    const { data: membership } = await supabase
      .from('sdr_team_members')
      .select('team_id')
      .eq('user_id', sdrId)
      .maybeSingle();

    if (!membership?.team_id) return {};

    const { data: prompts } = await supabase
      .from('sdr_coaching_prompts')
      .select('agent_key, system_prompt')
      .eq('team_id', membership.team_id)
      .eq('is_active', true);

    if (!prompts || prompts.length === 0) return {};

    const result: any = {};
    for (const p of prompts) {
      result[p.agent_key] = p.system_prompt;
    }
    return result;
  } catch (error) {
    console.warn('[sdr-pipeline] Failed to load custom prompts, using defaults:', error);
    return {};
  }
}
