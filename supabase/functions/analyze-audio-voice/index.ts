/**
 * analyze-audio-voice Edge Function
 *
 * Receives an HMAC-signed internal call from transcribe-audio.
 * Downloads audio from Supabase Storage, segments it into 3 key portions
 * (opener, key moment, close), sends each to GPT-4o audio input for
 * voice coaching analysis, merges results, and stores the analysis.
 *
 * Supports both full-cycle and SDR pipelines.
 */

import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";
import { validateSignedRequest } from "../_shared/hmac.ts";
import { getCorrelationId, createTracedLogger } from "../_shared/tracing.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";

// Declare EdgeRuntime for Supabase Deno edge functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Segment duration in seconds (3 minutes)
const SEGMENT_DURATION_SECONDS = 180;

// Keywords to identify key moments in transcript text
const KEY_MOMENT_KEYWORDS = [
  'price', 'pricing', 'cost', 'costs', 'budget',
  'concern', 'concerns', 'worried', 'worry',
  'competitor', 'competitors', 'alternative', 'alternatives',
  'objection', 'objections', 'pushback',
  'expensive', 'cheap', 'afford',
  'discount', 'deal', 'offer',
  'not sure', 'not interested', 'think about it',
  'challenge', 'problem', 'issue',
];

// Valid overall voice grades
const VALID_GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'] as const;

// ============================================================
// Types
// ============================================================

interface AnalyzeAudioVoicePayload {
  transcriptId: string;
  callId?: string;
  audioPath: string;
  pipeline: 'full_cycle' | 'sdr';
  transcriptText: string;
}

interface SegmentVoiceAnalysis {
  segment_label: string;
  estimated_wpm: number;
  filler_words: {
    count: number;
    examples: string[];
    per_minute: number;
  };
  tone_assessment: {
    confidence: number;
    energy: number;
    warmth: number;
    clarity: number;
  };
  pace_assessment: {
    overall: 'too_slow' | 'good' | 'too_fast';
    variability: 'monotone' | 'some_variation' | 'dynamic';
    recommendation: string;
  };
  notable_moments: Array<{
    description: string;
    assessment: 'strength' | 'improvement';
    coaching_tip: string;
  }>;
  interruptions_detected: number;
  silence_handling: {
    appropriate_pauses: number;
    rushed_responses: number;
    assessment: string;
  };
}

interface VoiceAnalysisResult {
  analyzed_at: string;
  segments_analyzed: number;
  total_duration_analyzed_seconds: number;
  overall_voice_grade: string;
  voice_summary: string;
  top_strengths: string[];
  top_improvements: string[];
  metrics: {
    avg_wpm: number;
    total_filler_words: number;
    filler_words_per_minute: number;
    avg_confidence: number;
    avg_energy: number;
    avg_warmth: number;
    avg_clarity: number;
    total_interruptions: number;
  };
  segment_analyses: SegmentVoiceAnalysis[];
  coaching_tips: Array<{
    category: 'pace' | 'filler' | 'energy' | 'silence' | 'tone' | 'engagement';
    severity: 'positive' | 'neutral' | 'improvement';
    title: string;
    description: string;
    segment: string;
  }>;
}

// ============================================================
// System Prompt
// ============================================================

const VOICE_COACH_SYSTEM_PROMPT = `You are an expert sales call voice coach specializing in analyzing audio recordings of sales conversations. Your job is to evaluate the speaker's vocal delivery, pace, tone, filler word usage, and overall communication effectiveness.

You are analyzing a SPECIFIC SEGMENT of a sales call. Pay close attention to the segment context provided (opener, key moment, or close) and adjust your analysis accordingly:

- **Opener segments**: Focus on confidence, warmth, energy level, and whether the speaker sounds enthusiastic and prepared vs. flat and scripted.
- **Key moment segments**: Focus on how the speaker handles pressure — do they maintain confidence during pricing/objection discussions? Do they rush or pause effectively?
- **Close segments**: Focus on assertiveness, clarity of next steps, and whether energy/confidence is maintained or drops off.

## What to Analyze

Listen carefully to the audio and assess:

1. **Speaking Pace (WPM)**: Estimate words per minute. Ideal sales call pace is 130-160 WPM. Too fast (>170) suggests nervousness or rushing. Too slow (<120) suggests low energy or uncertainty.

2. **Filler Words**: Count instances of "um", "uh", "like", "you know", "so", "right", "basically", "actually", "kind of", "sort of", "I mean". Note specific examples heard. Calculate filler words per minute.

3. **Tone Assessment**:
   - **Confidence** (0-100): Does the speaker sound sure of themselves? Firm, steady voice vs. wavering, uptalk, or trailing off.
   - **Energy** (0-100): How engaging is their vocal energy? Dynamic and enthusiastic vs. flat and monotone.
   - **Warmth** (0-100): Does the speaker sound approachable and empathetic? Friendly tone vs. cold and transactional.
   - **Clarity** (0-100): How clearly does the speaker articulate? Easy to understand vs. mumbling, talking too fast, or unclear enunciation.

4. **Pace Assessment**: Is the overall pace too slow, good, or too fast? How much variability is there (monotone, some variation, dynamic)? Provide a specific recommendation.

5. **Notable Moments**: Identify 2-4 specific moments where the speaker excelled or could improve vocally. For each, provide a description, whether it is a strength or area for improvement, and a concrete coaching tip.

6. **Interruptions**: Count times the speaker talked over the other person or was interrupted (estimate from audio patterns).

7. **Silence Handling**: Assess how the speaker handles pauses. Count appropriate strategic pauses vs. rushed responses where they should have paused. Provide an overall assessment.

## Response Format

Return ONLY valid JSON matching this exact structure:

{
  "segment_label": "opener" | "key_moment" | "close",
  "estimated_wpm": <number>,
  "filler_words": {
    "count": <number>,
    "examples": ["um", "uh", ...],
    "per_minute": <number>
  },
  "tone_assessment": {
    "confidence": <0-100>,
    "energy": <0-100>,
    "warmth": <0-100>,
    "clarity": <0-100>
  },
  "pace_assessment": {
    "overall": "too_slow" | "good" | "too_fast",
    "variability": "monotone" | "some_variation" | "dynamic",
    "recommendation": "<specific recommendation>"
  },
  "notable_moments": [
    {
      "description": "<what happened>",
      "assessment": "strength" | "improvement",
      "coaching_tip": "<actionable tip>"
    }
  ],
  "interruptions_detected": <number>,
  "silence_handling": {
    "appropriate_pauses": <number>,
    "rushed_responses": <number>,
    "assessment": "<overall assessment>"
  }
}

Return ONLY valid JSON. No additional text or explanation.`;

// ============================================================
// Helpers
// ============================================================

async function logEdgeMetric(
  supabase: ReturnType<typeof createClient>,
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
    console.warn(`[analyze-audio-voice] Failed to write metric ${metricName}:`, metricError);
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
 * Find the approximate timestamp of a "key moment" in the transcript text
 * by searching for keywords related to pricing, objections, or competitors.
 *
 * Transcript format from transcribe-audio is:
 *   [MM:SS] text here
 *   [MM:SS] more text
 *
 * Returns the timestamp in seconds of the best match, or null if none found.
 */
function findKeyMomentTimestamp(transcriptText: string, totalDurationSeconds: number): number | null {
  const lines = transcriptText.split('\n');
  const timestampRegex = /^\[(\d{2}):(\d{2})\]/;

  let bestMatchTimestamp: number | null = null;
  let bestMatchScore = 0;

  for (const line of lines) {
    const tsMatch = line.match(timestampRegex);
    if (!tsMatch) continue;

    const minutes = parseInt(tsMatch[1], 10);
    const seconds = parseInt(tsMatch[2], 10);
    const lineTimestamp = minutes * 60 + seconds;

    // Skip lines that are in the opener or close segments to avoid overlap
    if (lineTimestamp < SEGMENT_DURATION_SECONDS || lineTimestamp > totalDurationSeconds - SEGMENT_DURATION_SECONDS) {
      continue;
    }

    const lowerLine = line.toLowerCase();
    let score = 0;

    for (const keyword of KEY_MOMENT_KEYWORDS) {
      if (lowerLine.includes(keyword)) {
        score += 1;
      }
    }

    if (score > bestMatchScore) {
      bestMatchScore = score;
      bestMatchTimestamp = lineTimestamp;
    }
  }

  return bestMatchTimestamp;
}

/**
 * Calculate byte ranges for audio segments based on total file size and duration.
 *
 * This uses a linear approximation: byte_offset = (timestamp / total_duration) * total_bytes.
 * For compressed formats (mp3, m4a), this is approximate but sufficient for segment extraction.
 *
 * Returns an array of { label, startByte, endByte } segment descriptors.
 */
function calculateSegmentRanges(
  totalBytes: number,
  totalDurationSeconds: number,
  keyMomentTimestamp: number | null,
): Array<{ label: string; startByte: number; endByte: number; startSeconds: number; endSeconds: number }> {
  const bytesPerSecond = totalBytes / totalDurationSeconds;
  const segmentBytes = Math.floor(SEGMENT_DURATION_SECONDS * bytesPerSecond);

  const segments: Array<{ label: string; startByte: number; endByte: number; startSeconds: number; endSeconds: number }> = [];

  // Opener: first 3 minutes
  const openerEnd = Math.min(segmentBytes, totalBytes);
  segments.push({
    label: 'opener',
    startByte: 0,
    endByte: openerEnd,
    startSeconds: 0,
    endSeconds: Math.min(SEGMENT_DURATION_SECONDS, totalDurationSeconds),
  });

  // Key moment: centered around the detected keyword timestamp
  if (keyMomentTimestamp !== null) {
    const halfSegment = SEGMENT_DURATION_SECONDS / 2;
    const keyStartSec = Math.max(SEGMENT_DURATION_SECONDS, keyMomentTimestamp - halfSegment);
    const keyEndSec = Math.min(totalDurationSeconds - SEGMENT_DURATION_SECONDS, keyStartSec + SEGMENT_DURATION_SECONDS);
    const adjustedStartSec = keyEndSec - SEGMENT_DURATION_SECONDS; // re-adjust if end was clamped

    segments.push({
      label: 'key_moment',
      startByte: Math.floor(adjustedStartSec * bytesPerSecond),
      endByte: Math.floor(keyEndSec * bytesPerSecond),
      startSeconds: adjustedStartSec,
      endSeconds: keyEndSec,
    });
  } else {
    // Fallback: use the middle of the call
    const midpoint = totalDurationSeconds / 2;
    const halfSegment = SEGMENT_DURATION_SECONDS / 2;
    const midStartSec = Math.max(SEGMENT_DURATION_SECONDS, midpoint - halfSegment);
    const midEndSec = Math.min(totalDurationSeconds - SEGMENT_DURATION_SECONDS, midStartSec + SEGMENT_DURATION_SECONDS);
    const adjustedStartSec = midEndSec - SEGMENT_DURATION_SECONDS;

    segments.push({
      label: 'key_moment',
      startByte: Math.floor(adjustedStartSec * bytesPerSecond),
      endByte: Math.floor(midEndSec * bytesPerSecond),
      startSeconds: adjustedStartSec,
      endSeconds: midEndSec,
    });
  }

  // Close: last 3 minutes
  const closeStartByte = Math.max(0, totalBytes - segmentBytes);
  const closeStartSec = Math.max(0, totalDurationSeconds - SEGMENT_DURATION_SECONDS);
  segments.push({
    label: 'close',
    startByte: closeStartByte,
    endByte: totalBytes,
    startSeconds: closeStartSec,
    endSeconds: totalDurationSeconds,
  });

  return segments;
}

/**
 * Convert a Uint8Array to base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }
  return btoa(binary);
}

/**
 * Send an audio segment to GPT-4o audio input for voice analysis.
 */
async function analyzeSegment(
  audioBase64: string,
  segmentLabel: string,
  segmentIndex: number,
  segmentContext: string,
  audioFormat: string,
  openaiApiKey: string,
  log: ReturnType<typeof createTracedLogger>,
): Promise<SegmentVoiceAnalysis> {
  log.info(`Analyzing segment ${segmentIndex + 1}/3: ${segmentLabel} (${(audioBase64.length * 0.75 / 1024 / 1024).toFixed(1)}MB audio)`);

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-audio-preview',
        messages: [
          { role: 'system', content: VOICE_COACH_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBase64,
                  // GPT-4o audio input only supports 'mp3' and 'wav' format hints.
                  // For other formats (m4a, ogg, webm), we use 'mp3' as the closest hint.
                  // The model is generally robust to format mismatches for common codecs.
                  format: audioFormat === 'wav' ? 'wav' : 'mp3',
                },
              },
              {
                type: 'text',
                text: `Analyze this sales call segment (segment ${segmentIndex + 1} of 3: ${segmentLabel}). ${segmentContext}`,
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(120_000), // 2 minute timeout per segment
    },
    { maxRetries: 3, baseDelayMs: 5000, agentName: 'VoiceCoach' },
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error(`VoiceCoach returned empty response for segment ${segmentLabel}`);
  }

  let parsed: SegmentVoiceAnalysis;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`VoiceCoach returned invalid JSON for segment ${segmentLabel}: ${content.slice(0, 200)}`);
  }

  // Ensure the segment label matches what we requested
  parsed.segment_label = segmentLabel;

  // Validate key fields
  if (typeof parsed.estimated_wpm !== 'number') parsed.estimated_wpm = 0;
  if (!parsed.filler_words) parsed.filler_words = { count: 0, examples: [], per_minute: 0 };
  if (!parsed.tone_assessment) parsed.tone_assessment = { confidence: 50, energy: 50, warmth: 50, clarity: 50 };
  if (!parsed.pace_assessment) parsed.pace_assessment = { overall: 'good', variability: 'some_variation', recommendation: '' };
  if (!Array.isArray(parsed.notable_moments)) parsed.notable_moments = [];
  if (typeof parsed.interruptions_detected !== 'number') parsed.interruptions_detected = 0;
  if (!parsed.silence_handling) parsed.silence_handling = { appropriate_pauses: 0, rushed_responses: 0, assessment: '' };

  log.info(`Segment ${segmentLabel} analyzed: WPM=${parsed.estimated_wpm}, confidence=${parsed.tone_assessment.confidence}, fillers=${parsed.filler_words.count}`);

  return parsed;
}

/**
 * Calculate the overall voice grade based on merged metrics.
 *
 * Grading rubric:
 * - Confidence, Energy, Warmth, Clarity averaged (40% weight)
 * - WPM proximity to ideal 130-160 (20% weight)
 * - Filler words per minute penalty (20% weight)
 * - Interruptions penalty (10% weight)
 * - Silence handling (10% weight)
 */
function calculateOverallGrade(metrics: VoiceAnalysisResult['metrics'], segments: SegmentVoiceAnalysis[]): string {
  // Tone score (0-100) — average of four tone dimensions
  const toneScore = (metrics.avg_confidence + metrics.avg_energy + metrics.avg_warmth + metrics.avg_clarity) / 4;

  // WPM score (0-100): ideal 130-160, penalty for deviation
  let wpmScore = 100;
  if (metrics.avg_wpm < 100) {
    wpmScore = Math.max(0, 100 - (100 - metrics.avg_wpm) * 2);
  } else if (metrics.avg_wpm < 130) {
    wpmScore = 100 - (130 - metrics.avg_wpm) * 1.5;
  } else if (metrics.avg_wpm > 190) {
    wpmScore = Math.max(0, 100 - (metrics.avg_wpm - 190) * 2);
  } else if (metrics.avg_wpm > 160) {
    wpmScore = 100 - (metrics.avg_wpm - 160) * 1.5;
  }

  // Filler words score (0-100): <2/min = excellent, >8/min = poor
  let fillerScore = 100;
  if (metrics.filler_words_per_minute > 2) {
    fillerScore = Math.max(0, 100 - (metrics.filler_words_per_minute - 2) * 12);
  }

  // Interruptions score (0-100)
  let interruptionScore = 100;
  if (metrics.total_interruptions > 0) {
    interruptionScore = Math.max(0, 100 - metrics.total_interruptions * 15);
  }

  // Silence handling score (0-100): based on ratio of appropriate pauses to rushed responses
  let silenceScore = 75; // default neutral
  const totalPauses = segments.reduce((sum, s) => sum + s.silence_handling.appropriate_pauses, 0);
  const totalRushed = segments.reduce((sum, s) => sum + s.silence_handling.rushed_responses, 0);
  if (totalPauses + totalRushed > 0) {
    silenceScore = Math.round((totalPauses / (totalPauses + totalRushed)) * 100);
  }

  // Weighted composite score
  const compositeScore =
    toneScore * 0.40 +
    wpmScore * 0.20 +
    fillerScore * 0.20 +
    interruptionScore * 0.10 +
    silenceScore * 0.10;

  // Map to letter grade
  if (compositeScore >= 95) return 'A+';
  if (compositeScore >= 90) return 'A';
  if (compositeScore >= 87) return 'A-';
  if (compositeScore >= 83) return 'B+';
  if (compositeScore >= 80) return 'B';
  if (compositeScore >= 77) return 'B-';
  if (compositeScore >= 73) return 'C+';
  if (compositeScore >= 70) return 'C';
  if (compositeScore >= 67) return 'C-';
  if (compositeScore >= 63) return 'D+';
  if (compositeScore >= 60) return 'D';
  if (compositeScore >= 57) return 'D-';
  return 'F';
}

/**
 * Generate a voice summary using GPT-4o-mini (text-only, fast + cheap).
 */
async function generateVoiceSummary(
  metrics: VoiceAnalysisResult['metrics'],
  grade: string,
  segments: SegmentVoiceAnalysis[],
  openaiApiKey: string,
  log: ReturnType<typeof createTracedLogger>,
): Promise<string> {
  try {
    const summaryPrompt = `Based on the following voice analysis metrics from a sales call, write a 2-3 sentence coaching summary:

Overall Grade: ${grade}
Average WPM: ${metrics.avg_wpm}
Filler Words Per Minute: ${metrics.filler_words_per_minute.toFixed(1)}
Confidence: ${metrics.avg_confidence}/100
Energy: ${metrics.avg_energy}/100
Warmth: ${metrics.avg_warmth}/100
Clarity: ${metrics.avg_clarity}/100
Total Interruptions: ${metrics.total_interruptions}

Segments analyzed: ${segments.map(s => s.segment_label).join(', ')}

Notable moments:
${segments.flatMap(s => s.notable_moments.map(m => `- [${s.segment_label}] ${m.assessment}: ${m.description}`)).join('\n')}

Write a concise, encouraging but honest summary suitable for a sales rep's coaching dashboard. Focus on the most impactful observation and the #1 thing to improve. Do NOT use JSON — just plain text.`;

    const response = await fetchWithRetry(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a concise sales voice coach. Write 2-3 sentences only.' },
            { role: 'user', content: summaryPrompt },
          ],
          temperature: 0.5,
          max_tokens: 300,
        }),
        signal: AbortSignal.timeout(30_000),
      },
      { maxRetries: 2, baseDelayMs: 2000, agentName: 'VoiceSummary' },
    );

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content && typeof content === 'string') {
      return content.trim();
    }
  } catch (err) {
    log.warn('Failed to generate voice summary via GPT-4o-mini, using fallback:', err);
  }

  // Fallback: generate a simple summary from metrics
  const wpmAssessment = metrics.avg_wpm >= 130 && metrics.avg_wpm <= 160
    ? 'a well-paced delivery'
    : metrics.avg_wpm > 160
      ? 'a fast-paced delivery that could benefit from slowing down'
      : 'a slower pace that could use more energy';

  return `This call showed ${wpmAssessment} at ${Math.round(metrics.avg_wpm)} WPM with an average confidence level of ${Math.round(metrics.avg_confidence)}/100. ${metrics.filler_words_per_minute > 4 ? 'Reducing filler word usage would significantly improve perceived authority.' : 'Filler word usage was within acceptable range.'}`;
}

/**
 * Merge segment analyses into a single VoiceAnalysisResult.
 */
function mergeSegmentAnalyses(segments: SegmentVoiceAnalysis[]): {
  metrics: VoiceAnalysisResult['metrics'];
  coachingTips: VoiceAnalysisResult['coaching_tips'];
  topStrengths: string[];
  topImprovements: string[];
} {
  const count = segments.length || 1;

  // Calculate average metrics
  const avgWpm = Math.round(segments.reduce((sum, s) => sum + s.estimated_wpm, 0) / count);
  const totalFillerWords = segments.reduce((sum, s) => sum + s.filler_words.count, 0);

  // Total analyzed minutes (3 segments * 3 min each = ~9 min)
  const totalMinutes = count * (SEGMENT_DURATION_SECONDS / 60);
  const fillerWordsPerMinute = totalMinutes > 0 ? totalFillerWords / totalMinutes : 0;

  const avgConfidence = Math.round(segments.reduce((sum, s) => sum + s.tone_assessment.confidence, 0) / count);
  const avgEnergy = Math.round(segments.reduce((sum, s) => sum + s.tone_assessment.energy, 0) / count);
  const avgWarmth = Math.round(segments.reduce((sum, s) => sum + s.tone_assessment.warmth, 0) / count);
  const avgClarity = Math.round(segments.reduce((sum, s) => sum + s.tone_assessment.clarity, 0) / count);
  const totalInterruptions = segments.reduce((sum, s) => sum + s.interruptions_detected, 0);

  const metrics: VoiceAnalysisResult['metrics'] = {
    avg_wpm: avgWpm,
    total_filler_words: totalFillerWords,
    filler_words_per_minute: Math.round(fillerWordsPerMinute * 10) / 10,
    avg_confidence: avgConfidence,
    avg_energy: avgEnergy,
    avg_warmth: avgWarmth,
    avg_clarity: avgClarity,
    total_interruptions: totalInterruptions,
  };

  // Collect all notable moments as coaching tips
  const coachingTips: VoiceAnalysisResult['coaching_tips'] = [];

  for (const segment of segments) {
    for (const moment of segment.notable_moments) {
      coachingTips.push({
        category: inferCategory(moment.description),
        severity: moment.assessment === 'strength' ? 'positive' : 'improvement',
        title: moment.description.length > 80 ? moment.description.slice(0, 77) + '...' : moment.description,
        description: moment.coaching_tip,
        segment: segment.segment_label,
      });
    }

    // Add pace-related coaching tip if pace is not good
    if (segment.pace_assessment.overall !== 'good' && segment.pace_assessment.recommendation) {
      coachingTips.push({
        category: 'pace',
        severity: 'improvement',
        title: `Pace ${segment.pace_assessment.overall === 'too_fast' ? 'too fast' : 'too slow'} in ${segment.segment_label}`,
        description: segment.pace_assessment.recommendation,
        segment: segment.segment_label,
      });
    }

    // Add filler word coaching tip if high count
    if (segment.filler_words.per_minute > 4) {
      coachingTips.push({
        category: 'filler',
        severity: 'improvement',
        title: `High filler word usage in ${segment.segment_label}`,
        description: `Detected ${segment.filler_words.count} filler words (${segment.filler_words.per_minute.toFixed(1)}/min) including: ${segment.filler_words.examples.slice(0, 3).join(', ')}. Practice pausing instead of filling silence.`,
        segment: segment.segment_label,
      });
    }

    // Add silence handling coaching tip if many rushed responses
    if (segment.silence_handling.rushed_responses > 2) {
      coachingTips.push({
        category: 'silence',
        severity: 'improvement',
        title: `Rushed responses in ${segment.segment_label}`,
        description: segment.silence_handling.assessment,
        segment: segment.segment_label,
      });
    }
  }

  // Extract top strengths and improvements from notable moments
  const strengths = segments
    .flatMap(s => s.notable_moments.filter(m => m.assessment === 'strength'))
    .map(m => m.description);
  const improvements = segments
    .flatMap(s => s.notable_moments.filter(m => m.assessment === 'improvement'))
    .map(m => m.description);

  const topStrengths = strengths.slice(0, 3);
  const topImprovements = improvements.slice(0, 3);

  // Ensure at least one strength and improvement
  if (topStrengths.length === 0) {
    if (avgConfidence >= 70) topStrengths.push('Maintained solid vocal confidence throughout analyzed segments');
    else topStrengths.push('Showed willingness to engage in extended sales conversations');
  }
  if (topImprovements.length === 0) {
    if (fillerWordsPerMinute > 3) topImprovements.push('Reduce filler word usage to project more authority');
    else topImprovements.push('Continue developing dynamic vocal delivery for maximum engagement');
  }

  return { metrics, coachingTips, topStrengths, topImprovements };
}

/**
 * Infer a coaching tip category from a moment description.
 */
function inferCategory(description: string): VoiceAnalysisResult['coaching_tips'][0]['category'] {
  const lower = description.toLowerCase();
  if (lower.includes('pace') || lower.includes('speed') || lower.includes('fast') || lower.includes('slow') || lower.includes('wpm')) return 'pace';
  if (lower.includes('filler') || lower.includes('um') || lower.includes('uh') || lower.includes('like')) return 'filler';
  if (lower.includes('energy') || lower.includes('enthusiasm') || lower.includes('flat') || lower.includes('monotone')) return 'energy';
  if (lower.includes('pause') || lower.includes('silence') || lower.includes('rush')) return 'silence';
  if (lower.includes('tone') || lower.includes('confidence') || lower.includes('warmth') || lower.includes('clarity')) return 'tone';
  return 'engagement';
}

/**
 * Check voice analysis usage quota for a user.
 * Returns { allowed: true } if under limit, or { allowed: false, reason } if over.
 */
async function checkUsageQuota(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  teamId: string | null,
  log: ReturnType<typeof createTracedLogger>,
): Promise<{ allowed: boolean; reason?: string; currentUsage?: number; limit?: number }> {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStr = currentMonth.toISOString().slice(0, 10);

    // Get current usage
    const { data: usageRow } = await supabase
      .from('voice_analysis_usage')
      .select('analyses_used')
      .eq('user_id', userId)
      .eq('month', monthStr)
      .maybeSingle();

    const currentUsage = usageRow?.analyses_used || 0;

    // Get applicable limit (hierarchy: individual > team > global)
    let applicableLimit: number | null = null;

    // Check individual limit
    const { data: individualLimit } = await supabase
      .from('voice_analysis_limits')
      .select('monthly_limit')
      .eq('scope', 'individual')
      .eq('target_id', userId)
      .maybeSingle();

    if (individualLimit) {
      applicableLimit = individualLimit.monthly_limit;
    }

    // Check team limit if no individual limit
    if (applicableLimit === null && teamId) {
      const { data: teamLimit } = await supabase
        .from('voice_analysis_limits')
        .select('monthly_limit')
        .eq('scope', 'team')
        .eq('target_id', teamId)
        .maybeSingle();

      if (teamLimit) {
        applicableLimit = teamLimit.monthly_limit;
      }
    }

    // Check global limit if no team or individual limit
    if (applicableLimit === null) {
      const { data: globalLimit } = await supabase
        .from('voice_analysis_limits')
        .select('monthly_limit')
        .eq('scope', 'global')
        .is('target_id', null)
        .maybeSingle();

      if (globalLimit) {
        applicableLimit = globalLimit.monthly_limit;
      }
    }

    // Default to 10 if no limit is configured anywhere
    if (applicableLimit === null) {
      applicableLimit = 10;
    }

    if (currentUsage >= applicableLimit) {
      return {
        allowed: false,
        reason: `Monthly voice analysis limit reached (${currentUsage}/${applicableLimit})`,
        currentUsage,
        limit: applicableLimit,
      };
    }

    log.info(`Usage quota check passed: ${currentUsage}/${applicableLimit}`);
    return { allowed: true, currentUsage, limit: applicableLimit };

  } catch (err) {
    log.error('Failed to check usage quota — denying analysis for safety:', err);
    return { allowed: false, reason: 'Unable to verify usage quota. Please try again.' };
  }
}

/**
 * Increment usage counter for the current month.
 */
async function incrementUsage(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  log: ReturnType<typeof createTracedLogger>,
): Promise<boolean> {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);
    const monthStr = currentMonth.toISOString().slice(0, 10);

    // Upsert: increment if exists, insert with 1 if not
    const { data: existing } = await supabase
      .from('voice_analysis_usage')
      .select('id, analyses_used')
      .eq('user_id', userId)
      .eq('month', monthStr)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('voice_analysis_usage')
        .update({ analyses_used: existing.analyses_used + 1 })
        .eq('id', existing.id);
    } else {
      await supabase
        .from('voice_analysis_usage')
        .insert({ user_id: userId, month: monthStr, analyses_used: 1 });
    }

    log.info(`Incremented voice analysis usage for ${userId} (month: ${monthStr})`);
    return true;
  } catch (err) {
    log.warn('Failed to increment usage counter:', err);
    return false;
  }
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
  const log = createTracedLogger('analyze-audio-voice', correlationId);
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
  let payload: AnalyzeAudioVoicePayload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const { transcriptId, callId, audioPath, pipeline, transcriptText } = payload;

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

  if (!transcriptText || typeof transcriptText !== 'string') {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing transcriptText' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  if (callId && !UUID_REGEX.test(callId)) {
    return new Response(
      JSON.stringify({ error: 'Invalid callId format' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  log.info(`Starting voice analysis: pipeline=${pipeline}, transcriptId=${transcriptId}, audioPath=${audioPath}`);

  // ========== Fire-and-forget: return 202 immediately, process in background ==========
  const runBackgroundAnalysis = async () => {
    try {
      // 1. Resolve the user who owns this transcript for quota checking
      let ownerId: string | null = null;
      let ownerTeamId: string | null = null;

      if (pipeline === 'full_cycle') {
        const { data: transcript } = await supabaseAdmin
          .from('call_transcripts')
          .select('rep_id')
          .eq('id', transcriptId)
          .maybeSingle();
        ownerId = transcript?.rep_id || null;
      } else {
        // SDR pipeline: look up sdr_id from sdr_calls or sdr_daily_transcripts
        if (callId) {
          const { data: call } = await supabaseAdmin
            .from('sdr_calls')
            .select('sdr_id')
            .eq('id', callId)
            .maybeSingle();
          ownerId = call?.sdr_id || null;
        }
        if (!ownerId) {
          const { data: daily } = await supabaseAdmin
            .from('sdr_daily_transcripts')
            .select('sdr_id')
            .eq('id', transcriptId)
            .maybeSingle();
          ownerId = daily?.sdr_id || null;
        }
      }

      // Resolve team ID for quota hierarchy
      if (ownerId) {
        if (pipeline === 'full_cycle') {
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('team_id')
            .eq('id', ownerId)
            .maybeSingle();
          ownerTeamId = profile?.team_id || null;
        } else {
          const { data: membership } = await supabaseAdmin
            .from('sdr_team_members')
            .select('team_id')
            .eq('user_id', ownerId)
            .maybeSingle();
          ownerTeamId = membership?.team_id || null;
        }
      }

      // 2. Check usage quota
      if (ownerId) {
        const quota = await checkUsageQuota(supabaseAdmin, ownerId, ownerTeamId, log);
        if (!quota.allowed) {
          log.info(`Skipping voice analysis — quota exceeded: ${quota.reason}`);
          // Log metric and exit gracefully (not an error)
          await logEdgeMetric(
            supabaseAdmin,
            'analyze-audio-voice.quota_exceeded',
            performance.now() - requestStartedAt,
            'success',
            {
              pipeline,
              transcriptId,
              ownerId,
              currentUsage: quota.currentUsage,
              limit: quota.limit,
            },
          );
          return;
        }
      } else {
        log.warn('Could not resolve owner ID for quota check — proceeding without quota enforcement');
      }

      // 2b. Reserve usage slot immediately (before expensive GPT-4o call)
      if (ownerId) {
        await incrementUsage(supabaseAdmin, ownerId, log);
      }

      // 3. Check file size before downloading to prevent OOM
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

      // 3b. Download audio from Supabase Storage
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

      // 4. Derive format info
      const { extension: fileExtension } = getAudioMimeInfo(audioPath);
      // GPT-4o audio input only supports 'mp3' and 'wav' format hints.
      // For other formats (m4a, ogg, webm), we use 'mp3' as the closest hint.
      // The model is generally robust to format mismatches for common codecs.
      const audioFormat = fileExtension === 'wav' ? 'wav' : 'mp3';

      // 5. Determine total duration from the transcript record
      let totalDurationSeconds = 0;

      if (pipeline === 'full_cycle') {
        const { data: durationRow } = await supabaseAdmin
          .from('call_transcripts')
          .select('audio_duration_seconds')
          .eq('id', transcriptId)
          .maybeSingle();
        totalDurationSeconds = durationRow?.audio_duration_seconds || 0;
      }

      // Fallback: estimate duration from transcript timestamps
      if (totalDurationSeconds === 0) {
        const timestampRegex = /\[(\d{2}):(\d{2})\]/g;
        let maxTimestamp = 0;
        let match: RegExpExecArray | null;
        while ((match = timestampRegex.exec(transcriptText)) !== null) {
          const ts = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
          if (ts > maxTimestamp) maxTimestamp = ts;
        }
        totalDurationSeconds = maxTimestamp > 0 ? maxTimestamp + 30 : 0; // Add 30s buffer for last segment
      }

      // If still no duration, estimate from file size (~128kbps for mp3)
      if (totalDurationSeconds === 0) {
        const estimatedBitrate = fileExtension === 'wav' ? 1_411_200 : 128_000; // bits per second
        totalDurationSeconds = Math.round((audioBuffer.byteLength * 8) / estimatedBitrate);
        log.warn(`Estimated duration from file size: ${totalDurationSeconds}s (using ${estimatedBitrate} bps)`);
      }

      log.info(`Total audio duration: ${totalDurationSeconds}s (${(totalDurationSeconds / 60).toFixed(1)} min)`);

      // 6. Check if audio is long enough to segment (need at least ~7 minutes for 3 segments)
      const MIN_DURATION_FOR_SEGMENTATION = 420; // 7 minutes

      let segments: Array<{ label: string; audioBytes: Uint8Array; context: string }>;

      if (totalDurationSeconds < MIN_DURATION_FOR_SEGMENTATION) {
        // Short audio: analyze as a single segment
        log.info(`Audio too short for 3-segment analysis (${totalDurationSeconds}s < ${MIN_DURATION_FOR_SEGMENTATION}s), analyzing as single segment`);
        segments = [{
          label: 'opener',
          audioBytes: new Uint8Array(audioBuffer),
          context: 'This is a short call — analyze the entire recording. Focus on opener quality, overall tone, and call close.',
        }];
      } else {
        // 7. Find key moment in transcript text
        const keyMomentTimestamp = findKeyMomentTimestamp(transcriptText, totalDurationSeconds);
        if (keyMomentTimestamp !== null) {
          log.info(`Found key moment at ${Math.floor(keyMomentTimestamp / 60)}:${String(Math.floor(keyMomentTimestamp % 60)).padStart(2, '0')}`);
        } else {
          log.info('No specific key moment found, using middle of call');
        }

        // 8. Calculate byte ranges for segments
        const segmentRanges = calculateSegmentRanges(audioBuffer.byteLength, totalDurationSeconds, keyMomentTimestamp);

        segments = segmentRanges.map(range => ({
          label: range.label,
          audioBytes: new Uint8Array(audioBuffer.slice(range.startByte, range.endByte)),
          context: range.label === 'opener'
            ? 'This is the opening segment of the call (first ~3 minutes). Evaluate how the sales rep starts the conversation — confidence, warmth, and energy in their opening.'
            : range.label === 'key_moment'
              ? `This is a key moment from the middle of the call (around ${Math.floor(range.startSeconds / 60)}:${String(Math.floor(range.startSeconds % 60)).padStart(2, '0')} to ${Math.floor(range.endSeconds / 60)}:${String(Math.floor(range.endSeconds % 60)).padStart(2, '0')}). This section ${keyMomentTimestamp !== null ? 'contains a detected objection, pricing, or competitor discussion' : 'is from the middle of the conversation'}. Focus on how the speaker handles pressure and maintains composure.`
              : 'This is the closing segment of the call (last ~3 minutes). Evaluate how the sales rep wraps up — assertiveness, clarity on next steps, and whether energy/confidence is maintained.',
        }));
      }

      // 9. Send each segment to GPT-4o audio input
      const segmentAnalyses: SegmentVoiceAnalysis[] = [];

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const audioBase64 = uint8ArrayToBase64(segment.audioBytes);

        try {
          const analysis = await analyzeSegment(
            audioBase64,
            segment.label,
            i,
            segment.context,
            audioFormat,
            openaiApiKey,
            log,
          );
          segmentAnalyses.push(analysis);
        } catch (segErr) {
          log.error(`Failed to analyze segment ${segment.label}:`, segErr instanceof Error ? segErr.message : String(segErr));
          // Continue with remaining segments — partial results are better than none
        }
      }

      if (segmentAnalyses.length === 0) {
        throw new Error('All segment analyses failed — no voice analysis data produced');
      }

      log.info(`Completed ${segmentAnalyses.length}/${segments.length} segment analyses`);

      // 10. Merge results
      const { metrics, coachingTips, topStrengths, topImprovements } = mergeSegmentAnalyses(segmentAnalyses);

      // 11. Calculate overall grade
      const overallGrade = calculateOverallGrade(metrics, segmentAnalyses);
      log.info(`Overall voice grade: ${overallGrade}`);

      // 12. Generate voice summary via GPT-4o-mini
      const voiceSummary = await generateVoiceSummary(metrics, overallGrade, segmentAnalyses, openaiApiKey, log);

      // 13. Assemble final result
      const totalDurationAnalyzed = segments.length * SEGMENT_DURATION_SECONDS;
      const result: VoiceAnalysisResult = {
        analyzed_at: new Date().toISOString(),
        segments_analyzed: segmentAnalyses.length,
        total_duration_analyzed_seconds: Math.min(totalDurationAnalyzed, totalDurationSeconds),
        overall_voice_grade: overallGrade,
        voice_summary: voiceSummary,
        top_strengths: topStrengths,
        top_improvements: topImprovements,
        metrics,
        segment_analyses: segmentAnalyses,
        coaching_tips: coachingTips,
      };

      // 14. Store results in the appropriate table
      if (pipeline === 'full_cycle') {
        // Store in ai_call_analysis.audio_voice_analysis
        // Use update-first, then upsert pattern to eliminate TOCTOU race with analyze-call
        const { data: updated } = await supabaseAdmin
          .from('ai_call_analysis')
          .update({ audio_voice_analysis: result })
          .eq('call_id', transcriptId)
          .select('id')
          .maybeSingle();

        if (updated) {
          log.info(`Updated voice analysis on ai_call_analysis for ${transcriptId}`);
        } else {
          // Row doesn't exist yet — insert with ON CONFLICT to handle race condition
          // Fetch rep_id for the insert
          const { data: transcript } = await supabaseAdmin
            .from('call_transcripts')
            .select('rep_id')
            .eq('id', transcriptId)
            .maybeSingle();

          const { error: upsertError } = await supabaseAdmin
            .from('ai_call_analysis')
            .upsert({
              call_id: transcriptId,
              rep_id: transcript?.rep_id,
              model_name: 'gpt-4o-audio-preview',
              audio_voice_analysis: result,
              // Required NOT NULL columns with placeholder values
              call_summary: 'Pending — voice analysis completed before text analysis',
              confidence: 'pending',
              prompt_version: 1,
            }, { onConflict: 'call_id' });

          if (upsertError) {
            throw new Error(`Failed to upsert ai_call_analysis: ${upsertError.message}`);
          }
          log.info(`Upserted new ai_call_analysis with voice analysis for ${transcriptId}`);
        }
      } else {
        // SDR pipeline: store in sdr_call_grades.audio_voice_analysis
        // Use update-first, then upsert pattern to eliminate TOCTOU race with sdr-grade-call
        const targetCallId = callId || transcriptId;
        const { data: updated } = await supabaseAdmin
          .from('sdr_call_grades')
          .update({ audio_voice_analysis: result })
          .eq('call_id', targetCallId)
          .select('id')
          .maybeSingle();

        if (updated) {
          log.info(`Updated voice analysis on sdr_call_grades for ${targetCallId}`);
        } else {
          // Row doesn't exist yet — insert with ON CONFLICT to handle race condition
          const gradeSdrId = ownerId || null;
          if (gradeSdrId) {
            const { error: upsertError } = await supabaseAdmin
              .from('sdr_call_grades')
              .upsert({
                call_id: targetCallId,
                sdr_id: gradeSdrId,
                // Use valid grade from CHECK constraint: ('A+','A','B','C','D','F')
                overall_grade: 'F',
                model_name: 'gpt-4o-audio-preview',
                audio_voice_analysis: result,
                call_summary: 'Pending — voice analysis completed before grading',
              }, { onConflict: 'call_id' });

            if (upsertError) {
              log.error(`Failed to upsert sdr_call_grades for ${targetCallId}: ${upsertError.message}`);
            } else {
              log.info(`Upserted new sdr_call_grades with voice analysis for ${targetCallId}`);
            }
          } else {
            log.warn(`No existing sdr_call_grades record found for ${targetCallId} and no sdr_id available — voice analysis not stored.`);
          }
        }
      }

      // 15. (Usage counter already incremented in step 2b before analysis)

      // 16. Log success metric
      await logEdgeMetric(
        supabaseAdmin,
        'analyze-audio-voice.total',
        performance.now() - requestStartedAt,
        'success',
        {
          pipeline,
          transcriptId,
          callId: callId || null,
          audioSizeMB: fileSizeMB,
          durationSeconds: totalDurationSeconds,
          segmentsAnalyzed: segmentAnalyses.length,
          overallGrade,
          avgWpm: metrics.avg_wpm,
          totalFillerWords: metrics.total_filler_words,
          avgConfidence: metrics.avg_confidence,
        },
      );

      log.info(`Voice analysis complete for ${transcriptId}: grade=${overallGrade}, segments=${segmentAnalyses.length}`);

    } catch (bgError) {
      const errorMessage = bgError instanceof Error ? bgError.message : String(bgError);
      log.error('Background voice analysis failed:', errorMessage);

      // Log error metric
      await logEdgeMetric(
        supabaseAdmin,
        'analyze-audio-voice.total',
        performance.now() - requestStartedAt,
        'error',
        {
          pipeline,
          transcriptId,
          callId: callId || null,
          error: errorMessage,
        },
      );
    }
  };

  // @ts-ignore - EdgeRuntime available in Supabase
  EdgeRuntime.waitUntil(runBackgroundAnalysis());

  // Return 202 Accepted immediately
  return new Response(
    JSON.stringify({
      status: 'analyzing_voice',
      message: 'Voice analysis started in background',
      transcriptId,
      pipeline,
    }),
    { status: 202, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
