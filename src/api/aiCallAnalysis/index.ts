// Re-export all types
export type {
  AnalysisTier,
  AnalysisMetadata,
  CreateCallTranscriptParams,
  ProductEntry,
  StakeholderEntry,
  CallTranscript,
  CallTranscriptWithHeat,
  AnalysisStatus,
  HeatRange,
  CallHistoryFilters,
  AnalyzeCallResponse,
  MEDDPICCElement,
  MEDDPICCScores,
  CoachOutput,
  CallAnalysis,
  AiScoreStats,
  CoachingSummary,
  FrameworkTrend,
  PersistentGap,
  CoachingTrendAnalysis,
  CoachingTrendAnalysisWithMeta,
  ChunkSummary,
  FormattedCall,
  RepContributionData,
  AggregateAnalysisMetadata,
  AggregateCoachingTrendAnalysisWithMeta,
  AggregateAnalysisParams,
} from './types';

// Re-export constants
export { DIRECT_ANALYSIS_MAX, SAMPLING_MAX } from './constants';

// Re-export utility functions
export { determineAnalysisTier } from './utils';

// Re-export framework helpers
export { 
  defaultFrameworkTrend, 
  getPrimaryFrameworkTrend, 
  getPrimaryFrameworkLabel,
  getBantTrend,
  usesMeddpicc 
} from './frameworkHelpers';

// Re-export transcript functions
export {
  createCallTranscriptAndAnalyze,
  listCallTranscriptsForRep,
  listCallTranscriptsForRepWithFilters,
  listCallTranscriptsForTeamWithFilters,
  getCallWithAnalysis,
  retryCallAnalysis,
  deleteFailedTranscript,
  updateCallTranscript,
} from './transcripts';
export type { UpdateCallTranscriptParams, CallTranscriptWithHeatAndRep } from './transcripts';

// Re-export analysis functions
export {
  getAnalysisForCall,
  listRecentAiAnalysisForRep,
  getLatestAiAnalysisForReps,
  editRecapEmail,
  getCallCountsLast30DaysForReps,
  getAiScoreStatsForReps,
  updateAnalysisUserCounts,
} from './analysis';

// Re-export coaching functions
export {
  getCoachingSummaryForRep,
  generateCoachingTrends,
  generateAggregateCoachingTrends,
} from './coaching';
