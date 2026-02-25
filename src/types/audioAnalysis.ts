/**
 * Shared type definitions for audio analysis features.
 * Used across API functions, hooks, and components.
 */

// ---------------------------------------------------------------------------
// Processing pipeline stages
// ---------------------------------------------------------------------------

export type AudioProcessingStage =
  | 'uploading'
  | 'uploaded'
  | 'transcribing'
  | 'transcribed'
  | 'analyzing_text'
  | 'analyzing_voice'
  | 'complete'
  | 'error';

// ---------------------------------------------------------------------------
// Voice metrics types
// ---------------------------------------------------------------------------

export interface WPMDataPoint {
  /** Timestamp in seconds from start of audio */
  timestamp_sec: number;
  /** Words per minute at this point */
  wpm: number;
  /** Speaker identifier */
  speaker: string;
}

export interface FillerWordInstance {
  /** The filler word/phrase (e.g., "um", "like", "you know") */
  word: string;
  /** Timestamp in seconds */
  timestamp_sec: number;
  /** Speaker identifier */
  speaker: string;
}

export interface FillerWordBreakdown {
  /** Total filler word count */
  total_count: number;
  /** Filler words per minute */
  per_minute: number;
  /** Breakdown by specific filler word */
  by_word: Record<string, number>;
  /** Individual instances with timestamps */
  instances: FillerWordInstance[];
}

export interface AudioTalkListenRatio {
  /** Percentage of time the rep was speaking (0-100) */
  rep_talk_pct: number;
  /** Percentage of time the prospect was speaking (0-100) */
  prospect_talk_pct: number;
  /** Percentage of silence (0-100) */
  silence_pct: number;
  /** Total call duration in seconds */
  total_duration_sec: number;
}

export interface EnergySentimentDataPoint {
  /** Timestamp in seconds from start */
  timestamp_sec: number;
  /** Energy level (0-100) */
  energy: number;
  /** Sentiment score (-1 to 1, negative to positive) */
  sentiment: number;
  /** Speaker identifier */
  speaker: string;
}

export interface SilenceGap {
  /** Start timestamp in seconds */
  start_sec: number;
  /** End timestamp in seconds */
  end_sec: number;
  /** Duration of the silence in seconds */
  duration_sec: number;
  /** Context: what was said before the silence */
  preceding_text?: string;
  /** Context: what was said after the silence */
  following_text?: string;
}

export interface SpeakerInfo {
  /** Speaker identifier (e.g., "Speaker 1", "Rep", "Prospect") */
  id: string;
  /** Display label */
  label: string;
  /** Identified role */
  role: 'rep' | 'prospect' | 'unknown';
  /** Total speaking time in seconds */
  speaking_time_sec: number;
  /** Average words per minute */
  avg_wpm: number;
}

// ---------------------------------------------------------------------------
// Aggregated audio metrics
// ---------------------------------------------------------------------------

export interface AudioMetricsData {
  wpm_timeline: WPMDataPoint[];
  filler_words: FillerWordBreakdown;
  talk_listen_ratio: AudioTalkListenRatio;
  energy_sentiment_arc: EnergySentimentDataPoint[];
  silence_gaps: SilenceGap[];
  speakers: SpeakerInfo[];
}

// ---------------------------------------------------------------------------
// Coaching types for audio analysis
// ---------------------------------------------------------------------------

export interface TimestampedCoachingTip {
  /** Timestamp in seconds where the coachable moment occurs */
  timestamp_sec: number;
  /** Category of the coaching tip */
  category: 'pace' | 'filler' | 'energy' | 'silence' | 'talk_ratio' | 'general';
  /** The coaching suggestion */
  tip: string;
  /** Severity / priority */
  severity: 'info' | 'suggestion' | 'warning';
  /** Relevant speaker */
  speaker?: string;
}

export interface AudioCoachingData {
  /** Overall voice quality grade */
  voice_grade: string;
  /** Summary of voice performance */
  voice_summary: string;
  /** Timestamped coaching tips */
  tips: TimestampedCoachingTip[];
  /** Top strengths identified from voice analysis */
  voice_strengths: string[];
  /** Top improvement areas from voice analysis */
  voice_improvements: string[];
}

// ---------------------------------------------------------------------------
// Complete voice analysis result
// ---------------------------------------------------------------------------

export interface VoiceAnalysisResult {
  /** The call/transcript ID this analysis belongs to */
  call_id: string;
  /** Processing stage of this analysis */
  processing_stage: AudioProcessingStage;
  /** Audio file path in storage */
  audio_file_path: string | null;
  /** Duration of the audio in seconds */
  audio_duration_sec: number | null;
  /** Voice metrics data */
  metrics: AudioMetricsData | null;
  /** Voice coaching data */
  coaching: AudioCoachingData | null;
  /** Error message if processing_stage is 'error' */
  error_message: string | null;
  /** When the analysis was created */
  created_at: string;
  /** When the analysis was last updated */
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Upload types
// ---------------------------------------------------------------------------

export interface AudioUploadInput {
  /** The audio file to upload */
  file: File;
  /** Call date in YYYY-MM-DD format */
  callDate: string;
  /** Processing pipeline — 'full_cycle' for AE/closer calls, 'sdr' for SDR calls */
  pipeline: 'full_cycle' | 'sdr';
  /** Call type classification (optional for SDR pipeline — extracted from transcript) */
  callType?: string;
  /** Account/company name (optional for SDR pipeline — extracted from transcript) */
  accountName?: string;
  /** Stakeholder/contact name */
  stakeholderName?: string;
  /** Optional SDR ID (for SDR module) */
  sdrId?: string;
  /** Optional transcript ID to attach audio to an existing text transcript */
  existingTranscriptId?: string;
}

export interface AudioUploadResult {
  /** The created or linked transcript ID */
  transcriptId: string;
  /** The call ID */
  callId: string;
  /** Storage path for the uploaded audio */
  audioPath: string;
}

export type AudioUploadProgressCallback = (progress: {
  /** Percentage complete (0-100) */
  percent: number;
  /** Bytes uploaded so far */
  loaded: number;
  /** Total bytes to upload */
  total: number;
}) => void;

// ---------------------------------------------------------------------------
// Voice usage quota types
// ---------------------------------------------------------------------------

export interface VoiceUsageQuota {
  /** Number of analyses used this period */
  used: number;
  /** Maximum allowed analyses this period */
  limit: number;
  /** When the quota resets (ISO date string) */
  resetDate: string;
}

export interface VoiceUsageAdminEntry {
  /** User ID */
  userId: string;
  /** User display name */
  userName: string | null;
  /** User email */
  userEmail: string | null;
  /** Analyses used this period */
  used: number;
  /** Individual limit (null means using team/global default) */
  individualLimit: number | null;
  /** Effective limit (resolved from individual > team > global) */
  effectiveLimit: number;
}

export interface VoiceUsageAdminOverview {
  entries: VoiceUsageAdminEntry[];
  /** Global default limit */
  globalLimit: number;
}

export interface UpdateVoiceQuotaInput {
  /** Scope of the limit: 'global', 'team', or 'individual' */
  scope: 'global' | 'team' | 'individual';
  /** Target ID: user_id for individual, team_id for team, null for global */
  targetId: string | null;
  /** New monthly limit (number of analyses) */
  monthlyLimit: number;
}
