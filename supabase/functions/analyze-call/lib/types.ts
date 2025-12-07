// Types for analyze-call edge function

export interface TranscriptRow {
  id: string;
  rep_id: string;
  raw_text: string;
  call_date: string;
  source: string;
}

export interface MEDDPICCElement {
  score: number;
  justification: string;
}

export interface MEDDPICCScores {
  metrics: MEDDPICCElement;
  economic_buyer: MEDDPICCElement;
  decision_criteria: MEDDPICCElement;
  decision_process: MEDDPICCElement;
  paper_process: MEDDPICCElement;
  identify_pain: MEDDPICCElement;
  champion: MEDDPICCElement;
  competition: MEDDPICCElement;
  overall_score: number;
  summary: string;
}

export interface CoachOutput {
  call_type: string;
  duration_minutes: number;
  framework_scores: {
    meddpicc: MEDDPICCScores;
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  };
  meddpicc_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  critical_info_missing: Array<{
    info: string;
    missed_opportunity: string;
  }>;
  recommended_follow_up_questions: Array<{
    question: string;
    timing_example: string;
  }>;
  heat_signature: {
    score: number;
    explanation: string;
  };
}

export interface ProspectIntel {
  business_context?: string;
  pain_points?: string[];
  current_state?: string;
  decision_process?: {
    stakeholders?: string[];
    timeline?: string;
    budget_signals?: string;
  };
  competitors_mentioned?: string[];
  industry?: string;
  user_counts?: {
    it_users?: number;
    end_users?: number;
    ai_users?: number;
    source_quote?: string;
  };
}

/**
 * Type guard to validate ProspectIntel structure at runtime
 */
export function isValidProspectIntel(value: unknown): value is ProspectIntel {
  if (!value || typeof value !== 'object') return false;
  const intel = value as Record<string, unknown>;
  
  // All fields are optional, but if present they should be correct types
  if (intel.business_context !== undefined && typeof intel.business_context !== 'string') return false;
  if (intel.current_state !== undefined && typeof intel.current_state !== 'string') return false;
  if (intel.industry !== undefined && typeof intel.industry !== 'string') return false;
  if (intel.pain_points !== undefined && !Array.isArray(intel.pain_points)) return false;
  if (intel.competitors_mentioned !== undefined && !Array.isArray(intel.competitors_mentioned)) return false;
  
  // Validate user_counts if present
  if (intel.user_counts !== undefined) {
    if (typeof intel.user_counts !== 'object' || intel.user_counts === null) return false;
    const counts = intel.user_counts as Record<string, unknown>;
    if (counts.it_users !== undefined && typeof counts.it_users !== 'number') return false;
    if (counts.end_users !== undefined && typeof counts.end_users !== 'number') return false;
    if (counts.ai_users !== undefined && typeof counts.ai_users !== 'number') return false;
  }
  
  return true;
}

/**
 * Type guard to validate CoachOutput structure at runtime
 */
export function isValidCoachOutput(value: unknown): value is CoachOutput {
  if (!value || typeof value !== 'object') return false;
  const coach = value as Record<string, unknown>;
  
  // Validate framework_scores exists and has required properties
  if (!coach.framework_scores || typeof coach.framework_scores !== 'object') return false;
  const scores = coach.framework_scores as Record<string, unknown>;
  if (!scores.meddpicc || typeof scores.meddpicc !== 'object') return false;
  if (!scores.gap_selling || typeof scores.gap_selling !== 'object') return false;
  if (!scores.active_listening || typeof scores.active_listening !== 'object') return false;
  
  // Validate heat_signature exists with score
  if (!coach.heat_signature || typeof coach.heat_signature !== 'object') return false;
  const heat = coach.heat_signature as Record<string, unknown>;
  if (typeof heat.score !== 'number') return false;
  if (typeof heat.explanation !== 'string') return false;
  
  // Validate required arrays exist
  if (!Array.isArray(coach.meddpicc_improvements)) return false;
  if (!Array.isArray(coach.gap_selling_improvements)) return false;
  if (!Array.isArray(coach.active_listening_improvements)) return false;
  if (!Array.isArray(coach.critical_info_missing)) return false;
  if (!Array.isArray(coach.recommended_follow_up_questions)) return false;
  
  return true;
}

export interface StakeholderIntel {
  name: string;
  job_title?: string;
  influence_level: 'light_influencer' | 'heavy_influencer' | 'secondary_dm' | 'final_dm';
  champion_score?: number;
  champion_score_reasoning?: string;
  was_present?: boolean;
  ai_notes?: string;
}

export interface AnalysisResult {
  call_id: string;
  rep_id: string;
  model_name: string;
  prompt_version: string;
  confidence: number;
  call_summary: string;
  discovery_score: number;
  objection_handling_score: number;
  rapport_communication_score: number;
  product_knowledge_score: number;
  deal_advancement_score: number;
  call_effectiveness_score: number;
  trend_indicators: Record<string, string>;
  deal_gaps: { critical_missing_info: string[]; unresolved_objections: string[] };
  strengths: Array<{ area: string; example: string }>;
  opportunities: Array<{ area: string; example: string }>;
  skill_tags: string[];
  deal_tags: string[];
  meta_tags: string[];
  call_notes: string;
  recap_email_draft: string;
  coach_output: CoachOutput;
  raw_json: Record<string, unknown>;
  prospect_intel?: ProspectIntel;
  stakeholders_intel?: StakeholderIntel[];
}

export interface ProspectData {
  id: string;
  industry: string | null;
  opportunity_details: Record<string, unknown> | null;
  ai_extracted_info: Record<string, unknown> | null;
  heat_score: number | null;
  suggested_follow_ups: unknown[] | null;
}
