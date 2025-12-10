import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toCallAnalysis, toCoachingTrendAnalysis } from '@/lib/supabaseAdapters';
import type {
  CallAnalysis,
  CoachingSummary,
  CoachingTrendAnalysis,
  CoachingTrendAnalysisWithMeta,
  AnalysisMetadata,
  AggregateAnalysisParams,
  AggregateCoachingTrendAnalysisWithMeta,
  AggregateAnalysisMetadata,
  FormattedCall,
} from './types';
import { DIRECT_ANALYSIS_MAX } from './constants';
import {
  determineAnalysisTier,
  stratifiedSample,
  analyzeHierarchically,
  invokeCoachingTrendsFunction,
  calculateRepContributions,
} from './utils';

const log = createLogger('coaching');

/**
 * Gets aggregated coaching summary for a rep over a date range.
 * @param repId - The rep's user ID
 * @param dateRange - Date range with from and to dates
 * @returns Aggregated coaching insights
 */
export async function getCoachingSummaryForRep(
  repId: string,
  dateRange: { from: Date; to: Date }
): Promise<CoachingSummary> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .eq('rep_id', repId)
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Failed to fetch coaching summary', { repId, error });
    throw new Error(`Failed to fetch coaching summary: ${error.message}`);
  }

  const analyses = (data || []).map(toCallAnalysis);
  
  // Build framework trends - support both new MEDDPICC and legacy BANT
  const frameworkTrends = analyses.map(a => {
    const fs = a.coach_output?.framework_scores;
    // Use MEDDPICC overall score if available, fall back to BANT for legacy data
    const meddpiccScore = fs?.meddpicc?.overall_score ?? null;
    const bantScore = fs?.bant?.score ?? null;
    
    return {
      date: a.created_at,
      meddpicc: meddpiccScore,
      gap_selling: fs?.gap_selling?.score ?? null,
      active_listening: fs?.active_listening?.score ?? null,
      effectiveness: a.call_effectiveness_score,
      // Keep BANT for backward compatibility with old data
      bant: bantScore,
    };
  });

  // Helper to count occurrences
  const countOccurrences = (items: string[]): Array<{ item: string; count: number }> => {
    const counts = new Map<string, number>();
    items.forEach(item => {
      const normalized = item.toLowerCase().trim();
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([item, count]) => ({ item, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  // Aggregate critical info missing
  const allCriticalInfo: string[] = [];
  analyses.forEach(a => {
    if (a.coach_output?.critical_info_missing) {
      a.coach_output.critical_info_missing.forEach(item => {
        const text = typeof item === 'object' ? item.info : item;
        if (text) allCriticalInfo.push(text);
      });
    }
  });

  // Aggregate follow-up questions
  const allFollowUps: string[] = [];
  analyses.forEach(a => {
    if (a.coach_output?.recommended_follow_up_questions) {
      a.coach_output.recommended_follow_up_questions.forEach(item => {
        const text = typeof item === 'object' ? item.question : item;
        if (text) allFollowUps.push(text);
      });
    }
  });

  // Aggregate improvements - support both MEDDPICC and legacy BANT
  const allMeddpiccImprovements: string[] = [];
  const allBantImprovements: string[] = [];
  const allGapSellingImprovements: string[] = [];
  const allActiveListeningImprovements: string[] = [];
  
  analyses.forEach(a => {
    if (a.coach_output?.meddpicc_improvements) {
      allMeddpiccImprovements.push(...a.coach_output.meddpicc_improvements);
    }
    // Legacy BANT improvements for backward compatibility
    if (a.coach_output?.bant_improvements) {
      allBantImprovements.push(...a.coach_output.bant_improvements);
    }
    if (a.coach_output?.gap_selling_improvements) {
      allGapSellingImprovements.push(...a.coach_output.gap_selling_improvements);
    }
    if (a.coach_output?.active_listening_improvements) {
      allActiveListeningImprovements.push(...a.coach_output.active_listening_improvements);
    }
  });

  // Aggregate tags
  const allSkillTags: string[] = [];
  const allDealTags: string[] = [];
  analyses.forEach(a => {
    if (a.skill_tags) allSkillTags.push(...a.skill_tags);
    if (a.deal_tags) allDealTags.push(...a.deal_tags);
  });

  const countTags = (tags: string[]): Array<{ tag: string; count: number }> => {
    const counts = new Map<string, number>();
    tags.forEach(tag => counts.set(tag, (counts.get(tag) || 0) + 1));
    return Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  // Aggregate strengths and opportunities
  const strengthsMap = new Map<string, { count: number; examples: string[] }>();
  const opportunitiesMap = new Map<string, { count: number; examples: string[] }>();

  analyses.forEach(a => {
    if (a.strengths && Array.isArray(a.strengths)) {
      a.strengths.forEach((s) => {
        const area = (s.area as string)?.toLowerCase() || 'unknown';
        if (!strengthsMap.has(area)) {
          strengthsMap.set(area, { count: 0, examples: [] });
        }
        const entry = strengthsMap.get(area)!;
        entry.count++;
        if (s.example && entry.examples.length < 3) {
          entry.examples.push(s.example as string);
        }
      });
    }
    if (a.opportunities && Array.isArray(a.opportunities)) {
      a.opportunities.forEach((o) => {
        const area = (o.area as string)?.toLowerCase() || 'unknown';
        if (!opportunitiesMap.has(area)) {
          opportunitiesMap.set(area, { count: 0, examples: [] });
        }
        const entry = opportunitiesMap.get(area)!;
        entry.count++;
        if (o.example && entry.examples.length < 3) {
          entry.examples.push(o.example as string);
        }
      });
    }
  });

  const topStrengths = Array.from(strengthsMap.entries())
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const topOpportunities = Array.from(opportunitiesMap.entries())
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Heat score stats
  const heatScores = analyses
    .filter(a => a.coach_output?.heat_signature?.score != null)
    .map(a => ({
      date: a.created_at,
      score: a.coach_output!.heat_signature.score,
    }));

  const avgHeat = heatScores.length > 0
    ? heatScores.reduce((sum, h) => sum + h.score, 0) / heatScores.length
    : null;

  let heatTrend: 'improving' | 'declining' | 'stable' = 'stable';
  if (heatScores.length >= 3) {
    const firstHalf = heatScores.slice(0, Math.floor(heatScores.length / 2));
    const secondHalf = heatScores.slice(Math.floor(heatScores.length / 2));
    const firstAvg = firstHalf.reduce((s, h) => s + h.score, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, h) => s + h.score, 0) / secondHalf.length;
    if (secondAvg - firstAvg > 0.5) heatTrend = 'improving';
    else if (firstAvg - secondAvg > 0.5) heatTrend = 'declining';
  }

  return {
    totalCalls: analyses.length,
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString(),
    },
    frameworkTrends,
    recurringPatterns: {
      criticalInfoMissing: countOccurrences(allCriticalInfo),
      followUpQuestions: countOccurrences(allFollowUps),
      meddpiccImprovements: countOccurrences(allMeddpiccImprovements),
      gapSellingImprovements: countOccurrences(allGapSellingImprovements),
      activeListeningImprovements: countOccurrences(allActiveListeningImprovements),
      // Legacy BANT improvements for backward compatibility
      bantImprovements: countOccurrences(allBantImprovements),
    },
    aggregatedTags: {
      skillTags: countTags(allSkillTags),
      dealTags: countTags(allDealTags),
    },
    strengthsAndOpportunities: {
      topStrengths,
      topOpportunities,
    },
    heatScoreStats: {
      average: avgHeat,
      trend: heatTrend,
      recentScores: heatScores.slice(-10),
    },
  };
}

/**
 * Generates AI-powered coaching trend analysis for a rep over a date range.
 * Optimized: Single query with count, consolidated cache check.
 */
export async function generateCoachingTrends(
  repId: string,
  dateRange: { from: Date; to: Date },
  options?: { forceRefresh?: boolean }
): Promise<CoachingTrendAnalysisWithMeta> {
  const fromDate = dateRange.from.toISOString().split('T')[0];
  const toDate = dateRange.to.toISOString().split('T')[0];

  // 1. Check cache first (unless force refresh) - fast path
  if (!options?.forceRefresh) {
    const { data: cached } = await supabase
      .from('coaching_trend_analyses')
      .select('*')
      .eq('rep_id', repId)
      .eq('date_range_from', fromDate)
      .eq('date_range_to', toDate)
      .maybeSingle();

    if (cached?.analysis_data) {
      // Verify cache is still valid by checking call count
      const { count: currentCount } = await supabase
        .from('ai_call_analysis')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', repId)
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString())
        .is('deleted_at', null);

      if (cached.call_count === (currentCount || 0)) {
        log.debug('Using cached analysis');
        const cachedAnalysis = toCoachingTrendAnalysis(cached.analysis_data);
        if (cachedAnalysis) {
          const tier = determineAnalysisTier(currentCount || 0);
          return {
            analysis: cachedAnalysis,
            metadata: {
              tier,
              totalCalls: currentCount || 0,
              analyzedCalls: cachedAnalysis.periodAnalysis?.totalCalls || currentCount || 0,
            }
          };
        }
      }
    }
  }

  // 2. Fetch all call analyses with count in single query (consolidated)
  const { data, error, count } = await supabase
    .from('ai_call_analysis')
    .select('*', { count: 'exact' })
    .eq('rep_id', repId)
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString())
    .is('deleted_at', null)
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Error fetching analyses', { error });
    throw new Error(`Failed to fetch call analyses: ${error.message}`);
  }

  const analyses = (data || []).map(toCallAnalysis);
  const callCount = count || analyses.length;
  const tier = determineAnalysisTier(callCount);
  
  log.info('Analysis tier determined', { callCount, tier });

  if (analyses.length === 0) {
    throw new Error('No analyzed calls found in the selected period');
  }

  // 4. Format calls for AI - include Analysis 2.0 fields and legacy fallbacks
  const formattedCalls: FormattedCall[] = analyses.map(a => ({
    date: a.created_at.split('T')[0],
    // Analysis 2.0 fields (primary)
    analysis_behavior: a.analysis_behavior ?? null,
    analysis_strategy: a.analysis_strategy ?? null,
    // Legacy fields (fallback for backward compatibility)
    framework_scores: a.coach_output?.framework_scores ?? null,
    meddpicc_improvements: a.coach_output?.meddpicc_improvements ?? [],
    gap_selling_improvements: a.coach_output?.gap_selling_improvements ?? [],
    active_listening_improvements: a.coach_output?.active_listening_improvements ?? [],
    bant_improvements: a.coach_output?.bant_improvements ?? [],
    critical_info_missing: a.coach_output?.critical_info_missing ?? [],
    follow_up_questions: a.coach_output?.recommended_follow_up_questions ?? [],
    heat_score: a.deal_heat_analysis?.heat_score ?? a.coach_output?.heat_signature?.score ?? null,
  }));

  let trendData: CoachingTrendAnalysis;
  let metadata: AnalysisMetadata;

  // 5. Execute analysis based on tier
  if (tier === 'direct') {
    log.info('Direct analysis', { callCount: formattedCalls.length });
    
    const response = await invokeCoachingTrendsFunction(formattedCalls, { from: fromDate, to: toDate });
    trendData = response;
    metadata = {
      tier: 'direct',
      totalCalls: callCount,
      analyzedCalls: formattedCalls.length,
    };
  } else if (tier === 'sampled') {
    const { sampled, originalCount } = stratifiedSample(formattedCalls, DIRECT_ANALYSIS_MAX);
    log.info('Sampled analysis', { sampled: sampled.length, original: originalCount });
    
    const response = await invokeCoachingTrendsFunction(sampled, { from: fromDate, to: toDate });
    trendData = response;
    metadata = {
      tier: 'sampled',
      totalCalls: callCount,
      analyzedCalls: sampled.length,
      samplingInfo: {
        method: 'stratified',
        originalCount,
        sampledCount: sampled.length,
      },
    };
  } else {
    log.info('Hierarchical analysis', { callCount: formattedCalls.length });
    
    const { analysis, chunksAnalyzed, callsPerChunk } = await analyzeHierarchically(
      formattedCalls,
      { from: fromDate, to: toDate }
    );
    trendData = analysis;
    metadata = {
      tier: 'hierarchical',
      totalCalls: callCount,
      analyzedCalls: formattedCalls.length,
      hierarchicalInfo: {
        chunksAnalyzed,
        callsPerChunk,
      },
    };
  }

  log.debug('Successfully received AI trend analysis');

  // 6. Save to cache
  const { data: existing } = await supabase
    .from('coaching_trend_analyses')
    .select('id')
    .eq('rep_id', repId)
    .eq('date_range_from', fromDate)
    .eq('date_range_to', toDate)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from('coaching_trend_analyses')
      .update({
        call_count: analyses.length,
        analysis_data: JSON.parse(JSON.stringify(trendData)),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);
    
    if (updateError) {
      log.warn('Failed to update cache', { error: updateError });
    } else {
      log.debug('Analysis cache updated successfully');
    }
  } else {
    const { error: insertError } = await supabase
      .from('coaching_trend_analyses')
      .insert({
        rep_id: repId,
        date_range_from: fromDate,
        date_range_to: toDate,
        call_count: analyses.length,
        analysis_data: JSON.parse(JSON.stringify(trendData)),
      });
    
    if (insertError) {
      log.warn('Failed to insert cache', { error: insertError });
    } else {
      log.debug('Analysis cached successfully');
    }
  }

  return { analysis: trendData, metadata };
}

/**
 * Generates AI-powered coaching trend analysis across multiple reps.
 * Now delegates to edge function for server-side caching with service role.
 */
export async function generateAggregateCoachingTrends(
  params: AggregateAnalysisParams
): Promise<AggregateCoachingTrendAnalysisWithMeta> {
  const { scope, teamId, repId, dateRange, options } = params;
  const fromDate = dateRange.from.toISOString().split('T')[0];
  const toDate = dateRange.to.toISOString().split('T')[0];

  // If individual rep, delegate to existing function (uses client-side caching which works)
  if (scope === 'rep' && repId) {
    const result = await generateCoachingTrends(repId, dateRange, options);
    return {
      analysis: result.analysis,
      metadata: {
        ...result.metadata,
        scope: 'rep',
        repsIncluded: 1,
      },
    };
  }

  log.info('Invoking aggregate coaching trends edge function', { scope, teamId });

  // Call edge function which handles caching with service role
  const { data, error } = await supabase.functions.invoke('generate-aggregate-coaching-trends', {
    body: {
      scope,
      teamId,
      repId,
      dateRange: { from: fromDate, to: toDate },
      forceRefresh: options?.forceRefresh,
    }
  });

  if (error) {
    const errorMessage = error.message?.toLowerCase() || '';
    
    if (errorMessage.includes('429') || errorMessage.includes('rate')) {
      throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
    }
    if (errorMessage.includes('402') || errorMessage.includes('quota')) {
      throw new Error('AI usage quota exceeded. Please contact support or try again later.');
    }
    
    log.error('Aggregate coaching trends edge function error', { error });
    throw new Error(`Failed to generate aggregate coaching trends: ${error.message}`);
  }

  if (!data || data.error) {
    throw new Error(data?.error || 'Unknown error from aggregate coaching trends');
  }

  // Log cache status
  if (data._cached) {
    log.debug('Used cached aggregate analysis', { cachedAt: data._cachedAt });
  } else {
    log.debug('Generated fresh aggregate analysis');
  }

  return {
    analysis: data.analysis,
    metadata: data.metadata,
  };
}
