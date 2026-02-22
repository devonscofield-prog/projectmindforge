export type SDRProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type SDRCallType = 'conversation' | 'voicemail' | 'hangup' | 'internal' | 'reminder';

export type SDRCallAnalysisStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'failed';

export interface SDRTranscriptListItem {
  id: string;
  sdr_id: string;
  transcript_date: string;
  processing_status: SDRProcessingStatus;
  processing_error: string | null;
  processing_stage: string | null;
  graded_count: number;
  total_calls_detected: number;
  meaningful_calls_count: number;
  created_at: string;
  updated_at: string;
}

export interface SDRTranscriptDetail extends SDRTranscriptListItem {
  raw_text: string;
  uploaded_by: string;
}

export interface SDRCallGradeListItem {
  id: string;
  call_id: string;
  sdr_id: string;
  overall_grade: string;
  opener_score: number | null;
  engagement_score: number | null;
  objection_handling_score: number | null;
  appointment_setting_score: number | null;
  professionalism_score: number | null;
  call_summary: string | null;
  meeting_scheduled: boolean | null;
  created_at: string;
}

export interface SDRCallGradeDetail extends SDRCallGradeListItem {
  strengths: string[] | null;
  improvements: string[] | null;
  key_moments: Array<{ timestamp: string; description: string; sentiment: string }> | null;
  coaching_notes: string | null;
  model_name: string;
  raw_json: unknown;
}

export interface SDRCallListItem {
  id: string;
  daily_transcript_id: string;
  sdr_id: string;
  call_index: number;
  call_type: SDRCallType;
  is_meaningful: boolean;
  prospect_name: string | null;
  prospect_company: string | null;
  duration_estimate_seconds: number | null;
  start_timestamp: string | null;
  analysis_status: SDRCallAnalysisStatus;
  processing_error: string | null;
  created_at: string;
  updated_at: string;
  sdr_call_grades?: SDRCallGradeListItem[];
}

export interface SDRCallDetail extends Omit<SDRCallListItem, 'sdr_call_grades'> {
  raw_text: string;
  sdr_call_grades?: SDRCallGradeDetail[];
}

export interface SDRCoachingPrompt {
  id: string;
  team_id: string | null;
  created_by: string;
  agent_key: 'splitter' | 'filter' | 'grader';
  prompt_name: string;
  system_prompt: string;
  scoring_weights: Record<string, number> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SDRTeam {
  id: string;
  name: string;
  manager_id: string;
  created_at: string;
  updated_at: string;
}

export interface SDRTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

export interface SDRTeamMemberWithProfile extends SDRTeamMember {
  profiles?: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
}

export interface SDRStatsSummary {
  totalCallsToday: number;
  meaningfulCallsToday: number;
  avgScore: number | null;
  totalGradedCalls: number;
  gradeDistribution: Record<string, number>;
  processingStatus: SDRProcessingStatus | null;
}

export interface SDRMemberGradeStats {
  count: number;
  totalScore: number;
  meetings: number;
  grades: Record<string, number>;
}

export interface SDRTeamGradeSummary {
  avgScore: number;
  meetingsSet: number;
  totalGraded: number;
  gradeDistribution: Record<string, number>;
  memberStats: Record<string, SDRMemberGradeStats>;
}

export interface SDRTranscriptListParams {
  sdrId?: string;
  sdrIds?: string[];
  statuses?: SDRProcessingStatus[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  enabled?: boolean;
  pollWhileProcessing?: boolean;
}

export interface SDRCallListParams {
  transcriptId?: string;
  sdrId?: string;
  sdrIds?: string[];
  onlyMeaningful?: boolean;
  orderBy?: 'recency' | 'call_index';
  limit?: number;
  enabled?: boolean;
  pollWhileProcessing?: boolean;
}

export interface SDRTeamGradeSummaryParams {
  memberIds: string[];
  lookbackLimit?: number;
  enabled?: boolean;
}
