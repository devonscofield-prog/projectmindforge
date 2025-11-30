import { supabase } from '@/integrations/supabase/client';
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
    console.error('[getCoachingSummaryForRep] Error:', error);
    throw new Error(`Failed to fetch coaching summary: ${error.message}`);
  }

  const analyses = (data || []) as unknown as CallAnalysis[];
  
  // Build framework trends
  const frameworkTrends = analyses.map(a => ({
    date: a.created_at,
    bant: a.coach_output?.framework_scores?.bant?.score ?? null,
    gap_selling: a.coach_output?.framework_scores?.gap_selling?.score ?? null,
    active_listening: a.coach_output?.framework_scores?.active_listening?.score ?? null,
    effectiveness: a.call_effectiveness_score,
  }));

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

  // Aggregate improvements
  const allBantImprovements: string[] = [];
  const allGapSellingImprovements: string[] = [];
  const allActiveListeningImprovements: string[] = [];
  
  analyses.forEach(a => {
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
      a.strengths.forEach((s: Record<string, unknown>) => {
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
      a.opportunities.forEach((o: Record<string, unknown>) => {
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
      bantImprovements: countOccurrences(allBantImprovements),
      gapSellingImprovements: countOccurrences(allGapSellingImprovements),
      activeListeningImprovements: countOccurrences(allActiveListeningImprovements),
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
 */
export async function generateCoachingTrends(
  repId: string,
  dateRange: { from: Date; to: Date },
  options?: { forceRefresh?: boolean }
): Promise<CoachingTrendAnalysisWithMeta> {
  const fromDate = dateRange.from.toISOString().split('T')[0];
  const toDate = dateRange.to.toISOString().split('T')[0];

  // 1. Get current call count for cache validation and tier determination
  const { count: currentCallCount, error: countError } = await supabase
    .from('ai_call_analysis')
    .select('*', { count: 'exact', head: true })
    .eq('rep_id', repId)
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString());

  if (countError) {
    console.error('[generateCoachingTrends] Error counting analyses:', countError);
  }

  const callCount = currentCallCount || 0;
  const tier = determineAnalysisTier(callCount);
  
  console.log(`[generateCoachingTrends] ${callCount} calls found, using tier: ${tier}`);

  // 2. Check cache (unless force refresh)
  if (!options?.forceRefresh) {
    const { data: cached, error: cacheError } = await supabase
      .from('coaching_trend_analyses')
      .select('*')
      .eq('rep_id', repId)
      .eq('date_range_from', fromDate)
      .eq('date_range_to', toDate)
      .maybeSingle();

    if (!cacheError && cached && cached.call_count === callCount && cached.analysis_data) {
      console.log('[generateCoachingTrends] Using cached analysis');
      const cachedAnalysis = cached.analysis_data as unknown as CoachingTrendAnalysis;
      return {
        analysis: cachedAnalysis,
        metadata: {
          tier,
          totalCalls: callCount,
          analyzedCalls: cachedAnalysis.periodAnalysis?.totalCalls || callCount,
        }
      };
    }
  }

  // 3. Fetch all call analyses in date range
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .eq('rep_id', repId)
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[generateCoachingTrends] Error fetching analyses:', error);
    throw new Error(`Failed to fetch call analyses: ${error.message}`);
  }

  const analyses = (data || []) as unknown as CallAnalysis[];

  if (analyses.length === 0) {
    throw new Error('No analyzed calls found in the selected period');
  }

  // 4. Format calls for AI
  const formattedCalls: FormattedCall[] = analyses.map(a => ({
    date: a.created_at.split('T')[0],
    framework_scores: a.coach_output?.framework_scores ?? null,
    bant_improvements: a.coach_output?.bant_improvements ?? [],
    gap_selling_improvements: a.coach_output?.gap_selling_improvements ?? [],
    active_listening_improvements: a.coach_output?.active_listening_improvements ?? [],
    critical_info_missing: a.coach_output?.critical_info_missing ?? [],
    follow_up_questions: a.coach_output?.recommended_follow_up_questions ?? [],
    heat_score: a.coach_output?.heat_signature?.score ?? null,
  }));

  let trendData: CoachingTrendAnalysis;
  let metadata: AnalysisMetadata;

  // 5. Execute analysis based on tier
  if (tier === 'direct') {
    console.log(`[generateCoachingTrends] Direct analysis of ${formattedCalls.length} calls`);
    
    const response = await invokeCoachingTrendsFunction(formattedCalls, { from: fromDate, to: toDate });
    trendData = response;
    metadata = {
      tier: 'direct',
      totalCalls: callCount,
      analyzedCalls: formattedCalls.length,
    };
  } else if (tier === 'sampled') {
    const { sampled, originalCount } = stratifiedSample(formattedCalls, DIRECT_ANALYSIS_MAX);
    console.log(`[generateCoachingTrends] Sampled ${sampled.length} from ${originalCount} calls`);
    
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
    console.log(`[generateCoachingTrends] Hierarchical analysis of ${formattedCalls.length} calls`);
    
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

  console.log('[generateCoachingTrends] Successfully received AI trend analysis');

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
      console.warn('[generateCoachingTrends] Failed to update cache:', updateError);
    } else {
      console.log('[generateCoachingTrends] Analysis cache updated successfully');
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
      console.warn('[generateCoachingTrends] Failed to insert cache:', insertError);
    } else {
      console.log('[generateCoachingTrends] Analysis cached successfully');
    }
  }

  return { analysis: trendData, metadata };
}

/**
 * Generates AI-powered coaching trend analysis across multiple reps.
 */
export async function generateAggregateCoachingTrends(
  params: AggregateAnalysisParams
): Promise<AggregateCoachingTrendAnalysisWithMeta> {
  const { scope, teamId, repId, dateRange, options } = params;
  const fromDate = dateRange.from.toISOString().split('T')[0];
  const toDate = dateRange.to.toISOString().split('T')[0];

  // If individual rep, delegate to existing function
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

  // Get rep profiles with team info based on scope
  let repProfiles: { id: string; name: string; team_id: string | null }[] = [];
  
  if (scope === 'team' && teamId) {
    const { data: teamReps, error } = await supabase
      .from('profiles')
      .select('id, name, team_id')
      .eq('team_id', teamId);
    
    if (error) throw new Error(`Failed to fetch team reps: ${error.message}`);
    repProfiles = teamReps || [];
  } else {
    const { data: allReps, error } = await supabase
      .from('user_with_role')
      .select('id, name, team_id')
      .eq('role', 'rep')
      .eq('is_active', true);
    
    if (error) throw new Error(`Failed to fetch reps: ${error.message}`);
    repProfiles = (allReps || []).map(r => ({ 
      id: r.id!, 
      name: r.name || 'Unknown', 
      team_id: r.team_id 
    }));
  }

  const repIds = repProfiles.map(r => r.id);

  if (repIds.length === 0) {
    throw new Error('No reps found for the selected scope');
  }

  // Fetch team names if organization scope
  const teamMap = new Map<string, string>();
  if (scope === 'organization') {
    const { data: teams } = await supabase
      .from('teams')
      .select('id, name');
    teams?.forEach(t => teamMap.set(t.id, t.name));
  }

  console.log(`[generateAggregateCoachingTrends] Analyzing ${repIds.length} reps for ${scope} scope`);

  // Fetch all call analyses across selected reps
  const { data, error, count } = await supabase
    .from('ai_call_analysis')
    .select('*', { count: 'exact' })
    .in('rep_id', repIds)
    .gte('created_at', dateRange.from.toISOString())
    .lte('created_at', dateRange.to.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[generateAggregateCoachingTrends] Error fetching analyses:', error);
    throw new Error(`Failed to fetch call analyses: ${error.message}`);
  }

  const analyses = (data || []) as unknown as CallAnalysis[];
  const callCount = count || analyses.length;

  if (analyses.length === 0) {
    throw new Error('No analyzed calls found for the selected scope and period');
  }

  // Calculate rep contributions
  const repContributions = calculateRepContributions(
    analyses, 
    repProfiles, 
    teamMap, 
    callCount
  );

  const tier = determineAnalysisTier(callCount);
  console.log(`[generateAggregateCoachingTrends] ${callCount} calls found, using tier: ${tier}`);

  // Format calls for AI
  const formattedCalls: FormattedCall[] = analyses.map(a => ({
    date: a.created_at.split('T')[0],
    framework_scores: a.coach_output?.framework_scores ?? null,
    bant_improvements: a.coach_output?.bant_improvements ?? [],
    gap_selling_improvements: a.coach_output?.gap_selling_improvements ?? [],
    active_listening_improvements: a.coach_output?.active_listening_improvements ?? [],
    critical_info_missing: a.coach_output?.critical_info_missing ?? [],
    follow_up_questions: a.coach_output?.recommended_follow_up_questions ?? [],
    heat_score: a.coach_output?.heat_signature?.score ?? null,
  }));

  let trendData: CoachingTrendAnalysis;
  let metadata: AggregateAnalysisMetadata;

  // Execute analysis based on tier
  if (tier === 'direct') {
    console.log(`[generateAggregateCoachingTrends] Direct analysis of ${formattedCalls.length} calls`);
    
    const response = await invokeCoachingTrendsFunction(formattedCalls, { from: fromDate, to: toDate });
    trendData = response;
    metadata = {
      tier: 'direct',
      totalCalls: callCount,
      analyzedCalls: formattedCalls.length,
      scope,
      teamId,
      repsIncluded: repIds.length,
      repContributions,
    };
  } else if (tier === 'sampled') {
    const { sampled, originalCount } = stratifiedSample(formattedCalls, DIRECT_ANALYSIS_MAX);
    console.log(`[generateAggregateCoachingTrends] Sampled ${sampled.length} from ${originalCount} calls`);
    
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
      scope,
      teamId,
      repsIncluded: repIds.length,
      repContributions,
    };
  } else {
    console.log(`[generateAggregateCoachingTrends] Hierarchical analysis of ${formattedCalls.length} calls`);
    
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
      scope,
      teamId,
      repsIncluded: repIds.length,
      repContributions,
    };
  }

  console.log('[generateAggregateCoachingTrends] Successfully received AI trend analysis');

  return { analysis: trendData, metadata };
}
