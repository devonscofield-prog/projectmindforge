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
