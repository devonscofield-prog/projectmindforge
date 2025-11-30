import { CallType } from '@/constants/callTypes';

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
export interface CreateCallTranscriptParams {
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  stakeholderName: string;
  accountName: string;
  salesforceAccountLink?: string;
  potentialRevenue?: number;
  rawText: string;
  prospectId?: string;
  stakeholderId?: string;
}

export interface CallTranscript {
  id: string;
  rep_id: string;
  manager_id: string | null;
  call_date: string;
  source: string;
  raw_text: string;
  notes: string | null;
  analysis_status: 'pending' | 'processing' | 'completed' | 'error';
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
}

export interface CallTranscriptWithHeat extends CallTranscript {
  heat_score: number | null;
}

export type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error';

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

// ============= COACH OUTPUT TYPES =============
export interface CoachOutput {
  call_type: string | null;
  duration_minutes: number | null;
  framework_scores: {
    bant: { score: number; summary: string };
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  };
  bant_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  critical_info_missing: Array<{ info: string; missed_opportunity: string }> | string[];
  recommended_follow_up_questions: Array<{ question: string; timing_example: string }> | string[];
  heat_signature: {
    score: number;
    explanation: string;
  };
}

export interface CallAnalysis {
  id: string;
  call_id: string;
  rep_id: string;
  model_name: string;
  prompt_version: string;
  confidence: number | null;
  call_summary: string;
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
  coach_output?: CoachOutput | null;
  created_at: string;
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
    bant: number | null;
    gap_selling: number | null;
    active_listening: number | null;
    effectiveness: number | null;
  }>;
  recurringPatterns: {
    criticalInfoMissing: Array<{ item: string; count: number }>;
    followUpQuestions: Array<{ item: string; count: number }>;
    bantImprovements: Array<{ item: string; count: number }>;
    gapSellingImprovements: Array<{ item: string; count: number }>;
    activeListeningImprovements: Array<{ item: string; count: number }>;
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
export interface FrameworkTrend {
  trend: 'improving' | 'stable' | 'declining';
  startingAvg: number;
  endingAvg: number;
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
    bant: FrameworkTrend;
    gapSelling: FrameworkTrend;
    activeListening: FrameworkTrend;
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

export interface FormattedCall {
  date: string;
  framework_scores: {
    bant: { score: number; summary: string };
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  } | null;
  bant_improvements: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
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
    bant: number | null;
    gapSelling: number | null;
    activeListening: number | null;
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
