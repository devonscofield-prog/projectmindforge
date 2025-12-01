/**
 * Shared TypeScript types for Edge Functions
 * 
 * These types provide type safety across all edge functions
 * and eliminate the need for 'any' types.
 */

// ============================================================================
// SUPABASE DATABASE TYPES
// ============================================================================

export interface DatabaseProspect {
  id: string;
  prospect_name: string;
  account_name: string | null;
  status: 'active' | 'won' | 'lost' | 'dormant';
  heat_score: number | null;
  potential_revenue: number | null;
  last_contact_date: string | null;
  ai_extracted_info: ProspectAIInfo | null;
  opportunity_details: unknown;
  salesforce_link: string | null;
  website: string | null;
  industry: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectAIInfo {
  business_context?: string;
  pain_points?: string[];
  decision_process?: {
    timeline?: string;
    budget_signals?: string;
  };
  competitors_mentioned?: string[];
  relationship_health?: string;
  key_opportunities?: string[];
}

export interface DatabaseCallTranscript {
  id: string;
  rep_id: string;
  prospect_id: string | null;
  call_date: string;
  call_type: string | null;
  raw_text: string;
  analysis_status: 'pending' | 'processing' | 'completed' | 'error';
  source: 'zoom' | 'teams' | 'dialer' | 'other';
  account_name: string | null;
  primary_stakeholder_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseStakeholder {
  id: string;
  prospect_id: string;
  rep_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  influence_level: 'light_influencer' | 'heavy_influencer' | 'secondary_dm' | 'final_dm' | null;
  champion_score: number | null;
  champion_score_reasoning: string | null;
  is_primary_contact: boolean | null;
  last_interaction_date: string | null;
  ai_extracted_info: StakeholderAIInfo | null;
  created_at: string;
  updated_at: string;
}

export interface StakeholderAIInfo {
  communication_style?: string;
  concerns?: string[];
  priorities?: string[];
}

export interface DatabaseEmailLog {
  id: string;
  prospect_id: string;
  rep_id: string;
  stakeholder_id: string | null;
  direction: 'incoming' | 'outgoing';
  subject: string | null;
  body: string;
  email_date: string;
  contact_name: string | null;
  contact_email: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseFollowUp {
  id: string;
  prospect_id: string;
  rep_id: string;
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | null;
  status: 'pending' | 'completed' | 'dismissed' | null;
  category: string | null;
  ai_reasoning: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseAICallAnalysis {
  id: string;
  call_id: string;
  rep_id: string;
  call_summary: string;
  deal_gaps: DealGaps | null;
  coach_output: CoachOutput | null;
  prospect_intel: ProspectIntel | null;
  strengths: Array<string | { description: string }>;
  opportunities: Array<string | { description: string }>;
  created_at: string;
}

export interface DealGaps {
  critical_missing_info?: string[];
}

export interface CoachOutput {
  heat_signature?: {
    score: number;
  };
  framework_scores?: {
    bant?: { score: number; summary: string };
    gap_selling?: { score: number; summary: string };
    active_listening?: { score: number; summary: string };
  };
}

export interface ProspectIntel {
  pain_points?: string[];
  decision_makers?: string[];
  budget_indicators?: string[];
}

// ============================================================================
// PERFORMANCE MONITORING TYPES
// ============================================================================

export interface PerformanceSummary {
  metric_type: 'query' | 'edge_function';
  metric_name: string;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p90_duration_ms: number;
  p99_duration_ms: number;
  total_count: number;
  error_count: number;
  error_rate: number;
}

export interface PerformanceMetric {
  id: string;
  metric_type: 'query' | 'edge_function';
  metric_name: string;
  duration_ms: number;
  status: 'success' | 'error' | 'timeout';
  created_at: string;
  user_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface AlertConfig {
  id: string;
  user_id: string;
  email: string;
  enabled: boolean;
  alert_on_warning: boolean;
  alert_on_critical: boolean;
  cooldown_hours: number;
  created_at: string;
  updated_at: string;
}

export interface HealthMetric {
  metric_type: 'query' | 'edge_function' | 'error_rate';
  metric_value: number;
  threshold_value: number;
  status: 'healthy' | 'warning' | 'critical';
}

// ============================================================================
// CHAT MESSAGE TYPES
// ============================================================================

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ============================================================================
// AI GATEWAY TYPES
// ============================================================================

export interface LovableAIRequest {
  model: string;
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
  stream?: boolean;
}

export interface LovableAIResponse {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export interface AIError {
  message?: string;
  context?: {
    body?: string;
  };
}

// ============================================================================
// TRANSCRIPT ANALYSIS TYPES
// ============================================================================

export interface TranscriptChunk {
  chunk_index: number;
  chunk_text: string;
  metadata: Record<string, unknown> | null;
}

export interface ChunkSummary {
  chunkIndex: number;
  dateRange: { from: string; to: string };
  callCount: number;
  avgScores: {
    bant: number | null;
    gapSelling: number | null;
    activeListening: number | null;
    heat: number | null;
  };
  dominantTrends: {
    bant: 'improving' | 'stable' | 'declining';
    gapSelling: 'improving' | 'stable' | 'declining';
    activeListening: 'improving' | 'stable' | 'declining';
  };
  topMissingInfo: string[];
  topImprovementAreas: string[];
  keyObservations: string[];
}

// ============================================================================
// ACCOUNT RESEARCH TYPES
// ============================================================================

export interface AccountResearchRequest {
  companyName: string;
  website?: string;
  industry?: string;
  stakeholders?: Array<{
    name: string;
    title?: string;
    role?: string;
  }>;
  productPitch?: string;
  dealStage?: string;
  knownChallenges?: string;
  additionalNotes?: string;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export interface EdgeFunctionError {
  message: string;
  status?: number;
  code?: string;
}
