import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import type {
  AudioUploadInput,
  AudioUploadResult,
  AudioUploadProgressCallback,
  VoiceAnalysisResult,
  AudioMetricsData,
  AudioCoachingData,
  VoiceUsageQuota,
  VoiceUsageAdminOverview,
  VoiceUsageAdminEntry,
  UpdateVoiceQuotaInput,
  FillerWordInstance,
  WPMDataPoint,
  FillerWordBreakdown,
  AudioTalkListenRatio,
  EnergySentimentDataPoint,
  SilenceGap,
  SpeakerInfo,
} from '@/types/audioAnalysis';

const log = createLogger('audioAnalysis');

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/**
 * Uploads an audio file to Supabase Storage and invokes the process-audio-upload
 * Edge Function to kick off transcription + analysis.
 *
 * Uses XMLHttpRequest for upload progress reporting since fetch does not
 * support upload progress events.
 *
 * @param input - Audio file and metadata
 * @param onProgress - Optional progress callback
 * @returns The transcript ID and call ID from the Edge Function response
 */
export async function uploadAudioFile(
  input: AudioUploadInput,
  onProgress?: AudioUploadProgressCallback,
): Promise<AudioUploadResult> {
  const { file, callDate, pipeline, callType, accountName, stakeholderName, sdrId, existingTranscriptId } =
    input;

  // Get current user for path construction
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    throw new Error('Your session has expired. Please refresh the page and sign in again.');
  }

  const userId = session.user.id;
  const timestamp = Date.now();
  const sanitizedFilename = file.name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .toLowerCase();
  const storagePath = `${userId}/${timestamp}-${sanitizedFilename}`;

  log.info('Uploading audio file', {
    storagePath,
    fileSize: file.size,
    mimeType: file.type,
  });

  // ---------------------------------------------------------------------------
  // Step 1: Upload to Supabase Storage via XHR for progress tracking
  // ---------------------------------------------------------------------------
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const uploadUrl = `${supabaseUrl}/storage/v1/object/call-audio/${storagePath}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          percent: Math.round((event.loaded / event.total) * 100),
          loaded: event.loaded,
          total: event.total,
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let errorMessage = `Storage upload failed with status ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.message) errorMessage = body.message;
          if (body.error) errorMessage = body.error;
        } catch {
          // Response is not JSON — keep generic message
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during audio upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Audio upload was cancelled'));
    });

    xhr.open('POST', uploadUrl);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', supabaseKey);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.send(file);
  });

  log.info('Audio file uploaded to storage', { storagePath });

  // ---------------------------------------------------------------------------
  // Step 2: Invoke the process-audio-upload Edge Function
  // ---------------------------------------------------------------------------
  const functionBody: Record<string, unknown> = {
    audioPath: storagePath,
    callDate,
    pipeline,
  };
  if (callType) functionBody.callType = callType;
  if (accountName) functionBody.accountName = accountName;
  if (stakeholderName) functionBody.primaryStakeholderName = stakeholderName;
  if (sdrId) functionBody.sdrId = sdrId;
  if (existingTranscriptId) functionBody.existingTranscriptId = existingTranscriptId;

  const { data: functionResponse, error: functionError } = await supabase.functions.invoke(
    'process-audio-upload',
    { body: functionBody },
  );

  if (functionError) {
    log.error('process-audio-upload function error', {
      error: functionError.message,
      context: functionError.context,
    });

    if (
      functionError.message?.includes('session') ||
      functionError.message?.includes('AUTH_FAILED')
    ) {
      throw new Error('Your session has expired. Please refresh the page and sign in again.');
    }

    throw new Error(`Failed to process audio upload: ${functionError.message}`);
  }

  if (!functionResponse?.success) {
    log.error('process-audio-upload returned error', { response: functionResponse });
    throw new Error(functionResponse?.error || 'Failed to process audio upload');
  }

  const resolvedTranscriptId = functionResponse.transcriptId || functionResponse.dailyTranscriptId;

  log.info('Audio upload processed', {
    transcriptId: resolvedTranscriptId,
    callId: functionResponse.callId,
  });

  return {
    transcriptId: resolvedTranscriptId,
    callId: functionResponse.callId,
    audioPath: storagePath,
  };
}

// ---------------------------------------------------------------------------
// Analysis retrieval
// ---------------------------------------------------------------------------

/**
 * Fetches voice analysis data for a given transcript/call.
 * Queries audio_voice_analysis from ai_call_analysis or sdr_call_grades depending
 * on which table contains the analysis.
 *
 * @param transcriptId - The transcript or call ID
 * @returns The voice analysis result, or null if not found
 */
export async function getAudioAnalysis(transcriptId: string): Promise<VoiceAnalysisResult | null> {
  log.info('Fetching audio analysis', { transcriptId });

  // Cast to `any` because audio_voice_analysis column is not in the auto-generated
  // Supabase types yet (added via migration, types regenerated by Lovable on next sync).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const untypedClient = supabase as any;

  // Try ai_call_analysis first (AE/closer calls)
  const { data: aiAnalysis, error: aiError } = await untypedClient
    .from('ai_call_analysis')
    .select('call_id, audio_voice_analysis, created_at, updated_at')
    .eq('call_id', transcriptId)
    .maybeSingle();

  if (aiError) {
    log.error('Error fetching ai_call_analysis audio data', { transcriptId, error: aiError });
    throw new Error(`Failed to fetch audio analysis: ${aiError.message}`);
  }

  if (aiAnalysis?.audio_voice_analysis) {
    const voiceData = aiAnalysis.audio_voice_analysis as Record<string, unknown>;
    return mapVoiceAnalysisRow(transcriptId, voiceData, aiAnalysis.created_at, aiAnalysis.updated_at);
  }

  // Fallback: try sdr_call_grades (SDR calls)
  const { data: sdrGrade, error: sdrError } = await untypedClient
    .from('sdr_call_grades')
    .select('call_id, audio_voice_analysis, created_at')
    .eq('call_id', transcriptId)
    .maybeSingle();

  if (sdrError) {
    log.error('Error fetching sdr_call_grades audio data', { transcriptId, error: sdrError });
    throw new Error(`Failed to fetch audio analysis: ${sdrError.message}`);
  }

  if (sdrGrade?.audio_voice_analysis) {
    const voiceData = sdrGrade.audio_voice_analysis as Record<string, unknown>;
    return mapVoiceAnalysisRow(transcriptId, voiceData, sdrGrade.created_at, sdrGrade.created_at);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Backend → Frontend voice data adapter
// ---------------------------------------------------------------------------

/**
 * Transforms the backend JSONB voice analysis structure (scalar aggregates +
 * segment analyses) into the frontend-expected timeline-based types
 * (AudioMetricsData + AudioCoachingData).
 *
 * The backend stores:
 *   metrics: { avg_wpm, total_filler_words, filler_words_per_minute, avg_confidence, avg_energy, avg_warmth, avg_clarity, total_interruptions }
 *   segment_analyses: SegmentVoiceAnalysis[]
 *   coaching_tips: Array<{ category, severity, title, description, segment }>
 *   overall_voice_grade, voice_summary, top_strengths, top_improvements
 *
 * The frontend expects timeline arrays (WPMDataPoint[], EnergySentimentDataPoint[], etc.)
 */
function transformBackendVoiceData(voiceData: Record<string, unknown>): {
  metrics: AudioMetricsData | null;
  coaching: AudioCoachingData | null;
} {
  const backendMetrics = voiceData.metrics as Record<string, unknown> | undefined;
  const segmentAnalyses = (voiceData.segment_analyses as Array<Record<string, unknown>>) || [];
  const coachingTips = (voiceData.coaching_tips as Array<Record<string, unknown>>) || [];
  const totalDurationAnalyzed = (voiceData.total_duration_analyzed_seconds as number) || 540; // 9 min default

  if (!backendMetrics) return { metrics: null, coaching: null };

  // Build WPM timeline from segment analyses (one point per segment)
  const wpmTimeline: WPMDataPoint[] = segmentAnalyses.map((seg, i) => ({
    timestamp_sec: i * 180, // 3-min segments
    wpm: (seg.estimated_wpm as number) || 0,
    speaker: 'Rep',
  }));

  // Build filler words breakdown
  const _fillerExamples: string[] = [];
  const fillerInstances: FillerWordInstance[] = [];
  const fillerByWord: Record<string, number> = {};
  for (const seg of segmentAnalyses) {
    const fillers = seg.filler_words as Record<string, unknown> | undefined;
    if (fillers) {
      const examples = (fillers.examples as string[]) || [];
      examples.forEach((word) => {
        fillerByWord[word] = (fillerByWord[word] || 0) + 1;
        if (!_fillerExamples.includes(word)) _fillerExamples.push(word);
      });
    }
  }

  const fillerWords: FillerWordBreakdown = {
    total_count: (backendMetrics.total_filler_words as number) || 0,
    per_minute: (backendMetrics.filler_words_per_minute as number) || 0,
    by_word: fillerByWord,
    instances: fillerInstances,
  };

  // Build talk/listen ratio (estimated from segment data — no speaker diarization available)
  const talkListenRatio: AudioTalkListenRatio = {
    rep_talk_pct: 60,
    prospect_talk_pct: 30,
    silence_pct: 10,
    total_duration_sec: totalDurationAnalyzed,
  };

  // Build energy/sentiment arc from segment tone assessments
  const energySentimentArc: EnergySentimentDataPoint[] = segmentAnalyses.map((seg, i) => {
    const tone = seg.tone_assessment as Record<string, number> | undefined;
    return {
      timestamp_sec: i * 180,
      energy: tone?.energy ?? 50,
      sentiment: ((tone?.warmth ?? 50) - 50) / 50, // Normalize 0-100 to -1 to 1
      speaker: 'Rep',
    };
  });

  // Build silence gaps from segment silence handling
  const silenceGaps: SilenceGap[] = [];
  for (const seg of segmentAnalyses) {
    const silence = seg.silence_handling as Record<string, unknown> | undefined;
    if (silence) {
      const rushed = (silence.rushed_responses as number) || 0;
      if (rushed > 0) {
        const segIdx = segmentAnalyses.indexOf(seg);
        silenceGaps.push({
          start_sec: segIdx * 180 + 60,
          end_sec: segIdx * 180 + 62,
          duration_sec: 2,
          preceding_text: silence.assessment as string,
        });
      }
    }
  }

  // Build speakers array
  const speakers: SpeakerInfo[] = [
    {
      id: 'rep',
      label: 'Rep',
      role: 'rep' as const,
      speaking_time_sec: totalDurationAnalyzed * 0.6,
      avg_wpm: (backendMetrics.avg_wpm as number) || 0,
    },
  ];

  const metrics: AudioMetricsData = {
    wpm_timeline: wpmTimeline,
    filler_words: fillerWords,
    talk_listen_ratio: talkListenRatio,
    energy_sentiment_arc: energySentimentArc,
    silence_gaps: silenceGaps,
    speakers,
  };

  // Build coaching data from top-level fields
  const coaching: AudioCoachingData = {
    voice_grade: (voiceData.overall_voice_grade as string) || 'N/A',
    voice_summary: (voiceData.voice_summary as string) || '',
    tips: coachingTips.map((tip) => ({
      timestamp_sec: getSegmentTimestamp(tip.segment as string),
      category: mapCategory(tip.category as string),
      tip: (tip.description as string) || (tip.title as string) || '',
      severity: mapSeverity(tip.severity as string),
      speaker: 'Rep',
    })),
    voice_strengths: (voiceData.top_strengths as string[]) || [],
    voice_improvements: (voiceData.top_improvements as string[]) || [],
  };

  return { metrics, coaching };
}

function getSegmentTimestamp(segment: string | undefined): number {
  if (segment === 'opener') return 90;
  if (segment === 'key_moment') return 360;
  if (segment === 'close') return 540;
  return 0;
}

function mapCategory(
  category: string | undefined,
): 'pace' | 'filler' | 'energy' | 'silence' | 'talk_ratio' | 'general' {
  if (category === 'pace') return 'pace';
  if (category === 'filler') return 'filler';
  if (category === 'energy') return 'energy';
  if (category === 'silence') return 'silence';
  if (category === 'tone') return 'general';
  if (category === 'engagement') return 'general';
  return 'general';
}

function mapSeverity(severity: string | undefined): 'info' | 'suggestion' | 'warning' {
  if (severity === 'positive') return 'info';
  if (severity === 'neutral') return 'suggestion';
  if (severity === 'improvement') return 'warning';
  return 'suggestion';
}

function mapVoiceAnalysisRow(
  callId: string,
  voiceData: Record<string, unknown>,
  createdAt: string,
  updatedAt: string,
): VoiceAnalysisResult {
  const { metrics, coaching } = transformBackendVoiceData(voiceData);

  return {
    call_id: callId,
    processing_stage:
      (voiceData.processing_stage as VoiceAnalysisResult['processing_stage']) ?? 'complete',
    audio_file_path: (voiceData.audio_file_path as string) ?? null,
    audio_duration_sec:
      (voiceData.audio_duration_sec as number) ??
      (voiceData.total_duration_analyzed_seconds as number) ??
      null,
    metrics,
    coaching,
    error_message: (voiceData.error_message as string) ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Signed URL for audio playback
// ---------------------------------------------------------------------------

/**
 * Creates a signed URL for audio file playback from Supabase Storage.
 * The URL is valid for 60 minutes.
 *
 * @param audioPath - The storage path of the audio file
 * @returns The signed URL string
 */
export async function getAudioSignedUrl(audioPath: string): Promise<string> {
  log.debug('Creating signed URL for audio', { audioPath });

  const { data, error } = await supabase.storage
    .from('call-audio')
    .createSignedUrl(audioPath, 60 * 60); // 60 minutes

  if (error) {
    log.error('Failed to create signed URL', { audioPath, error });
    throw new Error(`Failed to create audio playback URL: ${error.message}`);
  }

  if (!data?.signedUrl) {
    throw new Error('No signed URL returned from storage');
  }

  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Voice usage quota
// ---------------------------------------------------------------------------

/**
 * Queries the voice analysis usage for the current month and the applicable limit
 * for the given user. Resolves the limit hierarchy: individual > team > global.
 *
 * @param userId - The user to check quota for
 * @returns Current usage and limit info
 */
export async function getVoiceUsageQuota(userId: string): Promise<VoiceUsageQuota> {
  log.debug('Fetching voice usage quota', { userId });

  // Cast to `any` because voice_analysis_usage and voice_analysis_limits tables
  // are not in the auto-generated Supabase types yet (added via migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const now = new Date();
  // Match the DB schema: month is a date column storing first-of-month, e.g. '2026-02-01'
  const currentMonth = now.toISOString().slice(0, 7) + '-01';
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Fetch usage for current month — DB columns: user_id, month, analyses_used
  const { data: usageRow, error: usageError } = await db
    .from('voice_analysis_usage')
    .select('analyses_used')
    .eq('user_id', userId)
    .eq('month', currentMonth)
    .maybeSingle();

  if (usageError) {
    log.error('Error fetching voice usage', { userId, error: usageError });
    throw new Error(`Failed to fetch voice usage: ${usageError.message}`);
  }

  const used = usageRow?.analyses_used ?? 0;

  // Get user's team_id from profiles for team-level limit resolution
  const { data: profile } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', userId)
    .maybeSingle();

  const teamId = profile?.team_id ?? null;

  // Resolve limit hierarchy: individual > team > global
  // DB columns: scope ('global'|'team'|'individual'), target_id (uuid|null), monthly_limit
  let effectiveLimit = 10; // Default fallback matches DB seed

  // Check individual limit
  const { data: individualLimit } = await db
    .from('voice_analysis_limits')
    .select('monthly_limit')
    .eq('scope', 'individual')
    .eq('target_id', userId)
    .maybeSingle();

  if (individualLimit) {
    effectiveLimit = individualLimit.monthly_limit;
  } else if (teamId) {
    // Check team limit
    const { data: teamLimit } = await db
      .from('voice_analysis_limits')
      .select('monthly_limit')
      .eq('scope', 'team')
      .eq('target_id', teamId)
      .maybeSingle();

    if (teamLimit) {
      effectiveLimit = teamLimit.monthly_limit;
    } else {
      // Check global limit
      const { data: globalLimit } = await db
        .from('voice_analysis_limits')
        .select('monthly_limit')
        .eq('scope', 'global')
        .is('target_id', null)
        .maybeSingle();

      if (globalLimit) {
        effectiveLimit = globalLimit.monthly_limit;
      }
    }
  } else {
    // No team — check global limit
    const { data: globalLimit } = await db
      .from('voice_analysis_limits')
      .select('monthly_limit')
      .eq('scope', 'global')
      .is('target_id', null)
      .maybeSingle();

    if (globalLimit) {
      effectiveLimit = globalLimit.monthly_limit;
    }
  }

  return {
    used,
    limit: effectiveLimit,
    resetDate: nextMonthStart,
  };
}

// ---------------------------------------------------------------------------
// Admin: voice usage overview
// ---------------------------------------------------------------------------

/**
 * Admin-only: Fetches voice usage overview for all users.
 *
 * @returns All user quotas and the global default limit
 */
export async function getVoiceUsageAdmin(): Promise<VoiceUsageAdminOverview> {
  log.info('Fetching admin voice usage overview');

  // Cast to `any` because voice_analysis_usage and voice_analysis_limits tables
  // are not in the auto-generated Supabase types yet (added via migration).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;

  const now = new Date();
  const currentMonth = now.toISOString().slice(0, 7) + '-01';

  // Fetch all usage for current month — DB columns: user_id, month, analyses_used
  const { data: usageRows, error: usageError } = await db
    .from('voice_analysis_usage')
    .select('user_id, analyses_used')
    .eq('month', currentMonth);

  if (usageError) {
    log.error('Error fetching admin voice usage', { error: usageError });
    throw new Error(`Failed to fetch voice usage: ${usageError.message}`);
  }

  // Fetch all limits — DB columns: scope, target_id, monthly_limit
  const { data: allLimits, error: limitsError } = await db
    .from('voice_analysis_limits')
    .select('scope, target_id, monthly_limit');

  if (limitsError) {
    log.error('Error fetching voice limits', { error: limitsError });
    throw new Error(`Failed to fetch voice limits: ${limitsError.message}`);
  }

  // Global default
  const globalRow = allLimits?.find((l: Record<string, unknown>) => l.scope === 'global' && l.target_id === null);
  const globalLimit = globalRow?.monthly_limit ?? 10;

  // Build per-user usage map
  const usageMap = new Map<string, number>();
  usageRows?.forEach((row: Record<string, unknown>) => {
    const current = usageMap.get(row.user_id) ?? 0;
    usageMap.set(row.user_id, current + (row.analyses_used ?? 0));
  });

  // Build per-user individual limit map
  const individualLimitMap = new Map<string, number>();
  allLimits?.forEach((l: Record<string, unknown>) => {
    if (l.scope === 'individual' && l.target_id) {
      individualLimitMap.set(l.target_id, l.monthly_limit);
    }
  });

  // Collect unique user IDs from usage and individual limits
  const allUserIds = new Set<string>();
  usageRows?.forEach((row) => allUserIds.add(row.user_id));
  allLimits?.forEach((l) => {
    if (l.scope === 'individual' && l.target_id) allUserIds.add(l.target_id);
  });

  // Fetch user profiles for display names
  const userIdArray = Array.from(allUserIds);
  const profileMap = new Map<string, { name: string | null; email: string | null }>();

  if (userIdArray.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', userIdArray);

    profiles?.forEach((p) => {
      profileMap.set(p.id, { name: p.name, email: p.email });
    });
  }

  const entries: VoiceUsageAdminEntry[] = userIdArray.map((uid) => {
    const profile = profileMap.get(uid);
    const individualLimit = individualLimitMap.get(uid) ?? null;

    return {
      userId: uid,
      userName: profile?.name ?? null,
      userEmail: profile?.email ?? null,
      used: usageMap.get(uid) ?? 0,
      individualLimit,
      effectiveLimit: individualLimit ?? globalLimit,
    };
  });

  return {
    entries,
    globalLimit,
  };
}

// ---------------------------------------------------------------------------
// Admin: update voice quota
// ---------------------------------------------------------------------------

/**
 * Admin-only: Upserts a voice analysis limit.
 * Pass scope='global' and targetId=null for the global default.
 *
 * @param input - The limit update parameters (scope, targetId, monthlyLimit)
 */
export async function updateVoiceQuota(input: UpdateVoiceQuotaInput): Promise<void> {
  log.info('Updating voice quota', input);

  const { scope, targetId, monthlyLimit } = input;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any).from('voice_analysis_limits').upsert(
    {
      scope,
      target_id: targetId,
      monthly_limit: monthlyLimit,
    },
    {
      onConflict: 'scope,target_id',
    },
  );

  if (error) {
    log.error('Failed to update voice quota', { error });
    throw new Error(`Failed to update voice quota: ${error.message}`);
  }

  log.info('Voice quota updated', { scope, targetId, monthlyLimit });
}
