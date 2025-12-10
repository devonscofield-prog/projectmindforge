import { CallType } from '@/constants/callTypes';
import type { BehaviorScore, CallMetadata, StrategyAudit, DealHeat, PsychologyProfile, CoachingSynthesis, PricingDiscipline, SalesAssets } from '@/utils/analysis-schemas';
import type { StakeholderInfluenceLevel } from '@/api/stakeholders';

// Re-export for convenience
export type { BehaviorScore, CallMetadata, StrategyAudit, DealHeat, PsychologyProfile, CoachingSynthesis, PricingDiscipline, SalesAssets } from '@/utils/analysis-schemas';

// ============= ANALYSIS TIER TYPES =============
export type AnalysisTier = 'direct' | 'sampled' | 'hierarchical';

export interface AnalysisMetadata {
  tier: AnalysisTier;
  totalCalls: number;
  analyzedCalls: number;
  samplingInfo?: {
    method: 'stratified';
    originalCount: number;
    sampledCount: number;
  };
  hierarchicalInfo?: {
    chunksAnalyzed: number;
    callsPerChunk: number[];
  };
}

// ============= CALL TRANSCRIPT TYPES =============
export interface ProductEntry {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  promotionNotes?: string;
}

// Stakeholder entry for call submission with multiple stakeholders
export interface StakeholderEntry {
  stakeholderId: string | null;
  stakeholderName: string;
  influenceLevel: StakeholderInfluenceLevel;
}

export interface CreateCallTranscriptParams {
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  // Multiple stakeholders support
  stakeholders: StakeholderEntry[];
  accountName: string;
  salesforceAccountLink?: string;
  potentialRevenue?: number;
  rawText: string;
  prospectId?: string;
  products?: Omit<ProductEntry, 'productName'>[];
  managerOnCall?: boolean;
  additionalSpeakers?: string[];
}

export interface CallTranscript {
  id: string;
  rep_id: string;
  rep_name: string | null;
  manager_id: string | null;
  call_date: string;
  source: string;
  raw_text: string;
  notes: string | null;
  analysis_status: 'pending' | 'processing' | 'completed' | 'error' | 'skipped';
  analysis_error: string | null;
  analysis_version: string;
  created_at: string;
  updated_at: string;
  primary_stakeholder_name: string | null;
  account_name: string | null;
  salesforce_demo_link: string | null;
  potential_revenue: number | null;
  call_type: CallType | null;
  call_type_other: string | null;
  prospect_id: string | null;
  additional_speakers: string[] | null;
}

export interface CallTranscriptWithHeat extends CallTranscript {
  heat_score: number | null;
  coach_grade: string | null;
}

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error' | 'skipped';

export type HeatRange = 'hot' | 'warm' | 'cold';

export interface CallHistoryFilters {
  search?: string;
  callTypes?: CallType[];
  statuses?: AnalysisStatus[];
  dateFrom?: string;
  dateTo?: string;
  heatRange?: HeatRange;
  sortBy?: 'call_date' | 'account_name' | 'created_at' | 'heat_score';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface AnalyzeCallResponse {
  success?: boolean;
  call_id?: string;
  analysis_id?: string;
  error?: string;
  isRateLimited?: boolean;
}

// ============================================================
// LEGACY TYPES - ANALYSIS 2.0 CLEANUP
// 
// These types are retained for backward compatibility with
// existing database records. They will be replaced by new
// modular types in the Analysis 2.0 implementation.
// ============================================================

// ============= MEDDPICC TYPES (LEGACY) =============
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

// ============= COACH OUTPUT TYPES (LEGACY) =============
/** @deprecated Part of Analysis 1.0 - will be replaced in 2.0 */
export interface CoachOutput {
  call_type: string | null;
  duration_minutes: number | null;
  framework_scores: {
    meddpicc: MEDDPICCScores;
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
    bant?: { score: number; summary: string };
  };
  meddpicc_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  bant_improvements?: string[];
  critical_info_missing: Array<{ info: string; missed_opportunity: string }> | string[];
  recommended_follow_up_questions: Array<{ question: string; timing_example: string }> | string[];
  heat_signature: {
    score: number;
    explanation: string;
  };
}

// ============= CALL ANALYSIS =============
/**
 * Combined analysis result including legacy fields and new Analysis 2.0 fields.
 */
export interface CallAnalysis {
  id: string;
  call_id: string;
  rep_id: string;
  model_name: string;
  prompt_version: string;
  confidence: number | null;
  call_summary: string;
  // Legacy skill scores (deprecated, set to 0 for new analyses)
  discovery_score: number | null;
  objection_handling_score: number | null;
  rapport_communication_score: number | null;
  product_knowledge_score: number | null;
  deal_advancement_score: number | null;
  call_effectiveness_score: number | null;
  trend_indicators: Record<string, unknown> | null;
  deal_gaps: Record<string, unknown> | null;
  strengths: Array<Record<string, unknown>> | null;
  opportunities: Array<Record<string, unknown>> | null;
  skill_tags: string[] | null;
  deal_tags: string[] | null;
  meta_tags: string[] | null;
  call_notes: string | null;
  recap_email_draft: string | null;
  raw_json: Record<string, unknown> | null;
  /** @deprecated Use analysis_metadata, analysis_behavior, analysis_strategy instead */
  coach_output?: CoachOutput | null;
  created_at: string;
  // Analysis 2.0 fields
  analysis_pipeline_version: string | null;
  analysis_metadata: CallMetadata | null;
  analysis_behavior: BehaviorScore | null;
  analysis_strategy: StrategyAudit | null;
  analysis_psychology: PsychologyProfile | null;
  analysis_pricing: PricingDiscipline | null;
  analysis_coaching: CoachingSynthesis | null;
  deal_heat_analysis: DealHeat | null;
  // Sales assets fields
  sales_assets: SalesAssets | null;
  sales_assets_generated_at: string | null;
}

// ============= AI SCORE STATS =============
export interface AiScoreStats {
  latestScore: number | null;
  latestDate: string | null;
  avgScore30Days: number | null;
  callCount30Days: number;
}

// ============= COACHING SUMMARY TYPES (legacy) =============
export interface CoachingSummary {
  totalCalls: number;
  dateRange: { from: string; to: string };
  frameworkTrends: Array<{
    date: string;
    meddpicc: number | null;
    gap_selling: number | null;
    active_listening: number | null;
    effectiveness: number | null;
    // Legacy BANT field for backward compatibility
    bant?: number | null;
  }>;
  recurringPatterns: {
    criticalInfoMissing: Array<{ item: string; count: number }>;
    followUpQuestions: Array<{ item: string; count: number }>;
    meddpiccImprovements: Array<{ item: string; count: number }>;
    gapSellingImprovements: Array<{ item: string; count: number }>;
    activeListeningImprovements: Array<{ item: string; count: number }>;
    // Legacy BANT improvements for backward compatibility
    bantImprovements?: Array<{ item: string; count: number }>;
  };
  aggregatedTags: {
    skillTags: Array<{ tag: string; count: number }>;
    dealTags: Array<{ tag: string; count: number }>;
  };
  strengthsAndOpportunities: {
    topStrengths: Array<{ area: string; count: number; examples: string[] }>;
    topOpportunities: Array<{ area: string; count: number; examples: string[] }>;
  };
  heatScoreStats: {
    average: number | null;
    trend: 'improving' | 'declining' | 'stable';
    recentScores: Array<{ date: string; score: number }>;
  };
}

// ============= COACHING TREND ANALYSIS TYPES =============

// Legacy framework trend type (kept for backward compatibility)
export interface FrameworkTrend {
  trend: 'improving' | 'stable' | 'declining';
  startingAvg: number;
  endingAvg: number;
  keyInsight: string;
  evidence: string[];
  recommendation: string;
}

// ============= ANALYSIS 2.0 TREND TYPES =============

/** Patience trend from Behavior analysis - tracks interruption patterns */
export interface PatienceTrend {
  trend: 'improving' | 'stable' | 'declining';
  startingAvg: number; // Avg Patience Score (0-30) from first half
  endingAvg: number;   // Avg Patience Score (0-30) from second half
  avgInterruptions: number; // Average interruption count per call
  keyInsight: string;
  evidence: string[];
  recommendation: string;
}

/** Strategic Threading trend from Strategy analysis - tracks pain-to-pitch alignment */
export interface StrategicThreadingTrend {
  trend: 'improving' | 'stable' | 'declining';
  startingAvg: number; // Avg strategic threading score (0-100) from first half
  endingAvg: number;   // Avg strategic threading score (0-100) from second half
  avgRelevanceRatio: number; // Average % of pitches that were relevant to pains
  avgMissedOpportunities: number; // Average missed opportunities per call
  keyInsight: string;
  evidence: string[];
  recommendation: string;
}

/** Monologue Violations trend from Behavior analysis - tracks talk time discipline */
export interface MonologueTrend {
  trend: 'improving' | 'stable' | 'declining';
  totalViolations: number; // Total monologue violations across all calls
  avgPerCall: number; // Average violations per call
  avgLongestTurn: number; // Average longest turn word count
  keyInsight: string;
  evidence: string[];
  recommendation: string;
}

export interface PersistentGap {
  gap: string;
  frequency: string;
  trend: 'improving' | 'stable' | 'worse';
}

export interface CoachingTrendAnalysis {
  summary: string;
  periodAnalysis: {
    totalCalls: number;
    averageHeatScore: number;
    heatScoreTrend: 'improving' | 'stable' | 'declining';
  };
  trendAnalysis: {
    // Analysis 2.0 primary metrics
    patience: PatienceTrend;
    strategicThreading: StrategicThreadingTrend;
    monologueViolations: MonologueTrend;
    // MEDDPICC (from Strategy analysis)
    meddpicc: FrameworkTrend;
    // Legacy metrics (fallback for backward compatibility)
    gapSelling: FrameworkTrend;
    activeListening: FrameworkTrend;
    bant?: FrameworkTrend;
  };
  patternAnalysis: {
    criticalInfoMissing: {
      persistentGaps: PersistentGap[];
      newIssues: string[];
      resolvedIssues: string[];
      recommendation: string;
    };
    followUpQuestions: {
      recurringThemes: string[];
      qualityTrend: 'improving' | 'stable' | 'declining';
      recommendation: string;
    };
  };
  topPriorities: Array<{
    area: string;
    reason: string;
    actionItem: string;
  }>;
}

export interface CoachingTrendAnalysisWithMeta {
  analysis: CoachingTrendAnalysis;
  metadata: AnalysisMetadata;
}

// ============= CHUNK SUMMARY TYPES =============
export interface ChunkSummary {
  chunkIndex: number;
  dateRange: { from: string; to: string };
  callCount: number;
  avgScores: {
    meddpicc: number | null;
    gapSelling: number | null;
    activeListening: number | null;
    heat: number | null;
    // Legacy BANT field for backward compatibility
    bant?: number | null;
  };
  dominantTrends: {
    meddpicc: 'improving' | 'stable' | 'declining';
    gapSelling: 'improving' | 'stable' | 'declining';
    activeListening: 'improving' | 'stable' | 'declining';
    // Legacy BANT field for backward compatibility
    bant?: 'improving' | 'stable' | 'declining';
  };
  topMissingInfo: string[];
  topImprovementAreas: string[];
  keyObservations: string[];
}

export interface FormattedCall {
  date: string;
  // Analysis 2.0 fields (primary)
  analysis_behavior?: BehaviorScore | null;
  analysis_strategy?: StrategyAudit | null;
  // Legacy fields (fallback for backward compatibility)
  framework_scores: {
    meddpicc: MEDDPICCScores;
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
    bant?: { score: number; summary: string };
  } | null;
  meddpicc_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  bant_improvements?: string[];
  critical_info_missing: Array<{ info: string; missed_opportunity: string }> | string[];
  follow_up_questions: Array<{ question: string; timing_example: string }> | string[];
  heat_score: number | null;
}

// ============= AGGREGATE ANALYSIS TYPES =============
export interface RepContributionData {
  repId: string;
  repName: string;
  teamName?: string;
  callCount: number;
  percentageOfTotal: number;
  averageHeatScore: number | null;
  frameworkScores: {
    meddpicc: number | null;
    gapSelling: number | null;
    activeListening: number | null;
    // Legacy BANT field - optional for new MEDDPICC-based analyses
    bant?: number | null;
  };
}

export interface AggregateAnalysisMetadata extends AnalysisMetadata {
  scope: 'organization' | 'team' | 'rep';
  teamId?: string;
  repsIncluded: number;
  repContributions?: RepContributionData[];
}

export interface AggregateCoachingTrendAnalysisWithMeta {
  analysis: CoachingTrendAnalysis;
  metadata: AggregateAnalysisMetadata;
}

export interface AggregateAnalysisParams {
  scope: 'organization' | 'team' | 'rep';
  teamId?: string;
  repId?: string;
  dateRange: { from: Date; to: Date };
  options?: { forceRefresh?: boolean };
}
