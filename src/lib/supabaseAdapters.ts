/**
 * Supabase Row → Domain Type Adapters
 * 
 * These functions transform raw Supabase Row types into properly typed domain objects.
 * This eliminates the need for `as unknown as Type` casts throughout the codebase.
 */

import type { Database, Json } from '@/integrations/supabase/types';
import type { 
  Prospect, 
  ProspectWithRep, 
  ProspectIntel,
  OpportunityDetails, 
  ProspectActivity,
  ProspectStatus,
  ProspectActivityType,
} from '@/api/prospects';
import type { 
  Stakeholder, 
  StakeholderIntel, 
  StakeholderMention,
  StakeholderInfluenceLevel,
} from '@/api/stakeholders';
import type { 
  CallAnalysis, 
  CallTranscript,
  CoachOutput,
  CoachingTrendAnalysis,
  BehaviorScore,
  CallMetadata,
  StrategyAudit,
  DealHeat,
} from '@/api/aiCallAnalysis/types';
import type { UserActivityLog, UserActivityType } from '@/api/userActivityLogs';
import { parseJsonField, isObject, isString, isStringArray, isNumber } from './typeUtils';

// ============= ROW TYPE ALIASES =============
type ProspectRow = Database['public']['Tables']['prospects']['Row'];
type ProspectActivityRow = Database['public']['Tables']['prospect_activities']['Row'];
type StakeholderRow = Database['public']['Tables']['stakeholders']['Row'];
type CallStakeholderMentionRow = Database['public']['Tables']['call_stakeholder_mentions']['Row'];
type CallTranscriptRow = Database['public']['Tables']['call_transcripts']['Row'];
type AiCallAnalysisRow = Database['public']['Tables']['ai_call_analysis']['Row'];
type UserActivityLogRow = Database['public']['Tables']['user_activity_logs']['Row'];
type CoachingTrendAnalysisRow = Database['public']['Tables']['coaching_trend_analyses']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type TeamRow = Database['public']['Tables']['teams']['Row'];
type CoachingSessionRow = Database['public']['Tables']['coaching_sessions']['Row'];

// ============= TYPE GUARDS =============

/**
 * Type guard for OpportunityDetails
 */
export function isOpportunityDetails(value: unknown): value is OpportunityDetails {
  if (!isObject(value)) return false;
  return true;
}

/**
 * Type guard for ProspectIntel
 */
export function isProspectIntel(value: unknown): value is ProspectIntel {
  if (!isObject(value)) return false;
  // ProspectIntel has all optional fields, so any object is valid
  return true;
}

/**
 * Type guard for StakeholderIntel
 */
export function isStakeholderIntel(value: unknown): value is StakeholderIntel {
  if (!isObject(value)) return false;
  return true;
}

/**
 * Type guard for CoachOutput
 */
export function isCoachOutput(value: unknown): value is CoachOutput {
  if (!isObject(value)) return false;
  // Check for key structural properties
  return 'framework_scores' in value || 'heat_signature' in value;
}

/**
 * Type guard for BehaviorScore (Analysis 2.0)
 */
export function isBehaviorScore(value: unknown): value is BehaviorScore {
  if (!isObject(value)) return false;
  return 'overall_score' in value && 'grade' in value && 'metrics' in value;
}

/**
 * Type guard for CallMetadata (Analysis 2.0)
 */
export function isCallMetadata(value: unknown): value is CallMetadata {
  if (!isObject(value)) return false;
  return 'summary' in value && 'participants' in value;
}

/**
 * Type guard for StrategyAudit (Analysis 2.0)
 * Supports both legacy MEDDPICC and new critical_gaps format
 */
export function isStrategyAudit(value: unknown): value is StrategyAudit {
  if (!isObject(value)) return false;
  // Must have strategic_threading, and either meddpicc (legacy) or critical_gaps (v2)
  return 'strategic_threading' in value && ('meddpicc' in value || 'critical_gaps' in value);
}

/**
 * Type guard for DealHeat (Analysis 2.0)
 */
export function isDealHeat(value: unknown): value is DealHeat {
  if (!isObject(value)) return false;
  return 'heat_score' in value && 'temperature' in value && 'key_factors' in value;
}

/**
 * Type guard for CoachingTrendAnalysis
 */
export function isCoachingTrendAnalysis(value: unknown): value is CoachingTrendAnalysis {
  if (!isObject(value)) return false;
  return 'summary' in value && 'trendAnalysis' in value;
}

// ============= PROSPECT ADAPTERS =============

/**
 * Converts a Supabase prospect row to a Prospect domain object.
 */
export function toProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    rep_id: row.rep_id,
    prospect_name: row.prospect_name,
    account_name: row.account_name,
    salesforce_link: row.salesforce_link,
    potential_revenue: row.potential_revenue,
    active_revenue: row.active_revenue ?? null,
    status: row.status as ProspectStatus,
    industry: row.industry,
    website: row.website,
    ai_extracted_info: parseJsonField<ProspectIntel>(row.ai_extracted_info, isProspectIntel),
    opportunity_details: parseJsonField<OpportunityDetails>(row.opportunity_details, isOpportunityDetails),
    suggested_follow_ups: row.suggested_follow_ups as string[] | null,
    last_contact_date: row.last_contact_date,
    heat_score: row.heat_score,
    follow_ups_generation_status: row.follow_ups_generation_status,
    follow_ups_last_generated_at: row.follow_ups_last_generated_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Converts a Supabase prospect row with rep info to a ProspectWithRep domain object.
 */
export function toProspectWithRep(row: ProspectRow, repName: string): ProspectWithRep {
  return {
    ...toProspect(row),
    rep_name: repName,
  };
}

/**
 * Converts a Supabase prospect activity row to a ProspectActivity domain object.
 */
export function toProspectActivity(row: ProspectActivityRow): ProspectActivity {
  return {
    id: row.id,
    prospect_id: row.prospect_id,
    rep_id: row.rep_id,
    activity_type: row.activity_type as ProspectActivityType,
    description: row.description,
    activity_date: row.activity_date,
    created_at: row.created_at,
  };
}

// ============= STAKEHOLDER ADAPTERS =============

/**
 * Converts a Supabase stakeholder row to a Stakeholder domain object.
 */
export function toStakeholder(row: StakeholderRow): Stakeholder {
  return {
    id: row.id,
    prospect_id: row.prospect_id,
    rep_id: row.rep_id,
    name: row.name,
    job_title: row.job_title,
    email: row.email,
    phone: row.phone,
    influence_level: (row.influence_level || 'light_influencer') as StakeholderInfluenceLevel,
    champion_score: row.champion_score,
    champion_score_reasoning: row.champion_score_reasoning,
    ai_extracted_info: parseJsonField<StakeholderIntel>(row.ai_extracted_info, isStakeholderIntel),
    is_primary_contact: row.is_primary_contact ?? false,
    last_interaction_date: row.last_interaction_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Converts a Supabase call stakeholder mention row to a StakeholderMention domain object.
 */
export function toStakeholderMention(row: CallStakeholderMentionRow): StakeholderMention {
  return {
    id: row.id,
    call_id: row.call_id,
    stakeholder_id: row.stakeholder_id,
    was_present: row.was_present ?? true,
    context_notes: row.context_notes,
    created_at: row.created_at,
  };
}

// ============= CALL TRANSCRIPT ADAPTERS =============

/**
 * Converts a Supabase call transcript row to a CallTranscript domain object.
 */
export function toCallTranscript(row: CallTranscriptRow, repName?: string | null): CallTranscript {
  return {
    id: row.id,
    rep_id: row.rep_id,
    rep_name: repName ?? null,
    manager_id: row.manager_id,
    call_date: row.call_date,
    source: row.source,
    raw_text: row.raw_text,
    notes: row.notes,
    analysis_status: row.analysis_status,
    analysis_error: row.analysis_error,
    analysis_version: row.analysis_version,
    created_at: row.created_at,
    updated_at: row.updated_at,
    primary_stakeholder_name: row.primary_stakeholder_name,
    account_name: row.account_name,
    salesforce_demo_link: row.salesforce_demo_link,
    potential_revenue: row.potential_revenue,
    call_type: row.call_type as CallTranscript['call_type'],
    call_type_other: row.call_type_other,
    prospect_id: row.prospect_id,
  };
}

// ============= AI ANALYSIS ADAPTERS =============

/**
 * Converts a Supabase AI call analysis row to a CallAnalysis domain object.
 */
export function toCallAnalysis(row: AiCallAnalysisRow): CallAnalysis {
  return {
    id: row.id,
    call_id: row.call_id,
    rep_id: row.rep_id,
    model_name: row.model_name,
    prompt_version: row.prompt_version,
    confidence: row.confidence,
    call_summary: row.call_summary,
    discovery_score: row.discovery_score,
    objection_handling_score: row.objection_handling_score,
    rapport_communication_score: row.rapport_communication_score,
    product_knowledge_score: row.product_knowledge_score,
    deal_advancement_score: row.deal_advancement_score,
    call_effectiveness_score: row.call_effectiveness_score,
    trend_indicators: row.trend_indicators as Record<string, unknown> | null,
    deal_gaps: row.deal_gaps as Record<string, unknown> | null,
    strengths: row.strengths as Array<Record<string, unknown>> | null,
    opportunities: row.opportunities as Array<Record<string, unknown>> | null,
    skill_tags: row.skill_tags,
    deal_tags: row.deal_tags,
    meta_tags: row.meta_tags,
    call_notes: row.call_notes,
    recap_email_draft: row.recap_email_draft,
    raw_json: row.raw_json as Record<string, unknown> | null,
    coach_output: parseJsonField<CoachOutput>(row.coach_output, isCoachOutput),
    created_at: row.created_at,
    // Analysis 2.0 fields
    analysis_pipeline_version: row.analysis_pipeline_version,
    analysis_metadata: parseJsonField<CallMetadata>(row.analysis_metadata, isCallMetadata),
    analysis_behavior: parseJsonField<BehaviorScore>(row.analysis_behavior, isBehaviorScore),
    analysis_strategy: parseJsonField<StrategyAudit>(row.analysis_strategy, isStrategyAudit),
    deal_heat_analysis: parseJsonField<DealHeat>(row.deal_heat_analysis, isDealHeat),
  };
}

/**
 * Extracts CoachOutput from a raw JSON field.
 */
export function toCoachOutput(json: Json | null): CoachOutput | null {
  return parseJsonField<CoachOutput>(json, isCoachOutput);
}

// ============= COACHING TREND ADAPTERS =============

/**
 * Converts cached coaching trend analysis data to a CoachingTrendAnalysis domain object.
 */
export function toCoachingTrendAnalysis(json: Json | null): CoachingTrendAnalysis | null {
  return parseJsonField<CoachingTrendAnalysis>(json, isCoachingTrendAnalysis);
}

// ============= USER ACTIVITY ADAPTERS =============

/**
 * Converts a Supabase user activity log row to a UserActivityLog domain object.
 */
export function toUserActivityLog(row: UserActivityLogRow): UserActivityLog {
  return {
    id: row.id,
    user_id: row.user_id,
    activity_type: row.activity_type as UserActivityType,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

// ============= IMPLEMENTED RECOMMENDATIONS ADAPTERS =============

export interface BaselineMetrics {
  avgQueryTime: number;
  avgEdgeFunctionTime: number;
  errorRate: number;
  p99Latency: number;
  timestamp: string;
}

export interface ImplementedRecommendation {
  id: string;
  user_id: string;
  recommendation_title: string;
  recommendation_category: string;
  recommendation_priority: string;
  recommendation_action: string;
  baseline_metrics: BaselineMetrics;
  post_metrics: BaselineMetrics | null;
  improvement_percent: number | null;
  implemented_at: string;
  measured_at: string | null;
  status: string;
  notes: string | null;
  affected_operations: string[] | null;
  created_at: string;
  updated_at: string;
}

/**
 * Type guard for BaselineMetrics
 */
export function isBaselineMetrics(value: unknown): value is BaselineMetrics {
  if (!isObject(value)) return false;
  return (
    'avgQueryTime' in value &&
    'avgEdgeFunctionTime' in value &&
    'errorRate' in value &&
    'p99Latency' in value &&
    'timestamp' in value
  );
}

/**
 * Converts a Supabase implemented recommendation row to domain object.
 */
export function toImplementedRecommendation(row: Database['public']['Tables']['implemented_recommendations']['Row']): ImplementedRecommendation {
  const baselineMetrics = parseJsonField<BaselineMetrics>(row.baseline_metrics, isBaselineMetrics) ?? {
    avgQueryTime: 0,
    avgEdgeFunctionTime: 0,
    errorRate: 0,
    p99Latency: 0,
    timestamp: row.implemented_at,
  };
  
  // Ensure timestamp is always present
  if (!baselineMetrics.timestamp) {
    baselineMetrics.timestamp = row.implemented_at;
  }
  
  const postMetrics = parseJsonField<BaselineMetrics>(row.post_metrics, isBaselineMetrics);
  
  return {
    id: row.id,
    user_id: row.user_id,
    recommendation_title: row.recommendation_title,
    recommendation_category: row.recommendation_category,
    recommendation_priority: row.recommendation_priority,
    recommendation_action: row.recommendation_action,
    baseline_metrics: baselineMetrics,
    post_metrics: postMetrics,
    improvement_percent: row.improvement_percent,
    implemented_at: row.implemented_at,
    measured_at: row.measured_at,
    status: row.status,
    notes: row.notes,
    affected_operations: row.affected_operations,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============= ANALYSIS SESSION ADAPTERS =============

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AnalysisSession {
  id: string;
  user_id: string;
  transcript_ids: string[];
  messages: ChatMessage[];
  analysis_mode: string | null;
  use_rag: boolean | null;
  title: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Type guard for ChatMessage
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (!isObject(value)) return false;
  return (
    ('role' in value && (value.role === 'user' || value.role === 'assistant')) &&
    ('content' in value && isString(value.content))
  );
}

/**
 * Type guard for ChatMessage array
 */
export function isChatMessageArray(value: unknown): value is ChatMessage[] {
  if (!Array.isArray(value)) return false;
  return value.every(isChatMessage);
}

/**
 * Converts a Supabase analysis session row to domain object.
 */
export function toAnalysisSession(row: Database['public']['Tables']['analysis_sessions']['Row']): AnalysisSession {
  const messages = parseJsonField<ChatMessage[]>(row.messages, isChatMessageArray) ?? [];
  return {
    id: row.id,
    user_id: row.user_id,
    transcript_ids: row.transcript_ids,
    messages,
    analysis_mode: row.analysis_mode,
    use_rag: row.use_rag,
    title: row.title,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============= COACHING TREND HISTORY ADAPTERS =============

export interface CoachingTrendHistoryItem {
  id: string;
  rep_id: string;
  date_range_from: string;
  date_range_to: string;
  call_count: number;
  created_at: string;
  updated_at: string;
  title: string | null;
  is_snapshot: boolean;
  analysis_data: CoachingTrendAnalysis;
}

/**
 * Converts a Supabase coaching trend analysis row to domain object.
 */
export function toCoachingTrendHistoryItem(row: CoachingTrendAnalysisRow): CoachingTrendHistoryItem | null {
  const analysisData = toCoachingTrendAnalysis(row.analysis_data);
  if (!analysisData) return null;
  
  return {
    id: row.id,
    rep_id: row.rep_id,
    date_range_from: row.date_range_from,
    date_range_to: row.date_range_to,
    call_count: row.call_count,
    created_at: row.created_at,
    updated_at: row.updated_at,
    title: row.title,
    is_snapshot: row.is_snapshot,
    analysis_data: analysisData,
  };
}

// ============= ADMIN STATS ADAPTERS =============

export interface CachedAdminStats {
  totalUsers: number;
  totalTeams: number;
  totalCalls: number;
  totalProspects: number;
  roleDistribution: {
    admin: number;
    manager: number;
    rep: number;
  };
}

/**
 * Type guard for CachedAdminStats
 */
export function isCachedAdminStats(value: unknown): value is CachedAdminStats {
  if (!isObject(value)) return false;
  return (
    'totalUsers' in value &&
    'totalTeams' in value &&
    'totalCalls' in value &&
    'totalProspects' in value &&
    'roleDistribution' in value
  );
}

export interface CachedProspectStats {
  total: number;
  active: number;
  hotProspects: number;
  pipelineValue: number;
}

/**
 * Type guard for CachedProspectStats
 */
export function isCachedProspectStats(value: unknown): value is CachedProspectStats {
  if (!isObject(value)) return false;
  return (
    'total' in value &&
    'active' in value &&
    'hotProspects' in value &&
    'pipelineValue' in value
  );
}

// ============= PROFILE ADAPTERS =============

import type { Profile, Team, CoachingSession } from '@/types/database';

/**
 * Converts a Supabase profile row to a Profile domain object.
 */
export function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    team_id: row.team_id,
    hire_date: row.hire_date,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============= TEAM ADAPTERS =============

/**
 * Converts a Supabase team row to a Team domain object.
 */
export function toTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    manager_id: row.manager_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ============= COACHING SESSION ADAPTERS =============

/**
 * Converts a Supabase coaching session row to a CoachingSession domain object.
 */
export function toCoachingSession(row: CoachingSessionRow): CoachingSession {
  return {
    id: row.id,
    rep_id: row.rep_id,
    manager_id: row.manager_id,
    session_date: row.session_date,
    focus_area: row.focus_area,
    notes: row.notes,
    action_items: row.action_items,
    follow_up_date: row.follow_up_date,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
