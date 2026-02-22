import { useMemo } from 'react';
import type { CallAnalysis } from '@/api/aiCallAnalysis';
import {
  BehaviorScoreSchema,
  StrategyAuditSchema,
  CallMetadataSchema,
  DealHeatSchema,
  PsychologyProfileSchema,
  CallClassificationSchema,
  CoachingSynthesisSchema,
  type BehaviorScore,
  type StrategyAudit,
  type CallMetadata,
  type DealHeat,
  type PsychologyProfile,
  type CallClassification,
  type CoachingSynthesis
} from '@/utils/analysis-schemas';

export function useCallAnalysisData(analysis: CallAnalysis | null) {
  const { behaviorData, strategyData, metadataData, psychologyData, callClassificationData, coachingData, parseError } = useMemo(() => {
    if (!analysis) {
      return { behaviorData: null, strategyData: null, metadataData: null, dealHeatData: null, psychologyData: null, callClassificationData: null, coachingData: null, parseError: null };
    }

    try {
      const behaviorResult = analysis.analysis_behavior
        ? BehaviorScoreSchema.safeParse(analysis.analysis_behavior)
        : { success: false, data: null };

      const strategyResult = analysis.analysis_strategy
        ? StrategyAuditSchema.safeParse(analysis.analysis_strategy)
        : { success: false, data: null };

      const metadataResult = analysis.analysis_metadata
        ? CallMetadataSchema.safeParse(analysis.analysis_metadata)
        : { success: false, data: null };

      const dealHeatResult = analysis.deal_heat_analysis
        ? DealHeatSchema.safeParse(analysis.deal_heat_analysis)
        : { success: false, data: null };

      const psychologyResult = analysis.analysis_psychology
        ? PsychologyProfileSchema.safeParse(analysis.analysis_psychology)
        : { success: false, data: null };

      const coachingResult = analysis.analysis_coaching
        ? CoachingSynthesisSchema.safeParse(analysis.analysis_coaching)
        : { success: false, data: null };

      const rawJson = analysis.raw_json as { call_classification?: unknown } | null;
      const callClassificationResult = rawJson?.call_classification
        ? CallClassificationSchema.safeParse(rawJson.call_classification)
        : { success: false, data: null };

      if (!behaviorResult.success && analysis.analysis_behavior) {
        console.warn('BehaviorScore validation failed:', 'error' in behaviorResult ? behaviorResult.error : 'unknown');
      }
      if (!strategyResult.success && analysis.analysis_strategy) {
        console.warn('StrategyAudit validation failed:', 'error' in strategyResult ? strategyResult.error : 'unknown');
      }

      const behavior = behaviorResult.success ? behaviorResult.data : null;
      const strategy = strategyResult.success ? strategyResult.data : null;
      const metadata = metadataResult.success ? metadataResult.data : null;
      const dealHeat = dealHeatResult.success ? dealHeatResult.data : null;
      const psychology = psychologyResult.success ? psychologyResult.data : null;
      const callClassification = callClassificationResult.success ? callClassificationResult.data : null;
      const coaching = coachingResult.success ? coachingResult.data : null;

      const hasCriticalError = analysis.analysis_behavior && analysis.analysis_strategy
        && !behavior && !strategy;

      return {
        behaviorData: behavior as BehaviorScore | null,
        strategyData: strategy as StrategyAudit | null,
        metadataData: metadata as CallMetadata | null,
        dealHeatData: dealHeat as DealHeat | null,
        psychologyData: psychology as PsychologyProfile | null,
        callClassificationData: callClassification as CallClassification | null,
        coachingData: coaching as CoachingSynthesis | null,
        parseError: hasCriticalError ? 'Analysis data could not be parsed' : null
      };
    } catch (err) {
      console.error('Error parsing analysis data:', err);
      return {
        behaviorData: null,
        strategyData: null,
        metadataData: null,
        dealHeatData: null,
        psychologyData: null,
        callClassificationData: null,
        coachingData: null,
        parseError: 'Unexpected error parsing analysis data'
      };
    }
  }, [analysis]);

  const behaviorScore = behaviorData?.overall_score ?? 0;
  const strategyScore = strategyData?.strategic_threading?.score ?? 0;

  const stats = useMemo(() => {
    const itUsers = metadataData?.user_counts?.it_users ?? '-';
    const endUsers = metadataData?.user_counts?.end_users ?? '-';
    const sourceQuote = metadataData?.user_counts?.source_quote ?? null;
    const duration = metadataData?.logistics?.duration_minutes
      ? `${metadataData.logistics.duration_minutes} min`
      : '-';
    const platform = metadataData?.logistics?.platform ?? null;
    const videoOn = metadataData?.logistics?.video_on ?? null;

    return { itUsers, endUsers, sourceQuote, duration, platform, videoOn };
  }, [metadataData]);

  const summary = metadataData?.summary || null;
  const topics = metadataData?.topics || [];
  const participants = metadataData?.participants ?? [];

  return {
    behaviorData,
    strategyData,
    metadataData,
    psychologyData,
    callClassificationData,
    coachingData,
    parseError,
    behaviorScore,
    strategyScore,
    stats,
    summary,
    topics,
    participants,
  };
}
