import { supabase } from '@/integrations/supabase/client';
import { CallType } from '@/constants/callTypes';
import { getOrCreateProspect, linkCallToProspect, updateProspect, type ProspectIntel } from '@/api/prospects';

// ============= ANALYSIS TIER CONSTANTS =============
// Tier 1: Direct analysis (optimal quality)
export const DIRECT_ANALYSIS_MAX = 50;
// Tier 2: Smart sampling (good quality, representative sample)
export const SAMPLING_MAX = 100;
// Tier 3: Hierarchical analysis (100+ calls - two-stage process)

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

export interface CoachingTrendAnalysisWithMeta {
  analysis: CoachingTrendAnalysis;
  metadata: AnalysisMetadata;
}

interface CreateCallTranscriptParams {
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  stakeholderName: string;
  accountName: string;
  salesforceAccountLink?: string;
  potentialRevenue?: number;
  rawText: string;
  // Optional: if user selected an existing prospect/stakeholder
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
  // New fields
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

type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error';

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

interface AnalyzeCallResponse {
  success?: boolean;
  call_id?: string;
  analysis_id?: string;
  error?: string;
}

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

interface CallAnalysis {
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

/**
 * Creates a call transcript and triggers AI analysis.
 * @param params - The transcript parameters
 * @returns The inserted transcript row and the analyze_call response
 */
export async function createCallTranscriptAndAnalyze(params: CreateCallTranscriptParams): Promise<{
  transcript: CallTranscript;
  analyzeResponse: AnalyzeCallResponse;
}> {
  const { 
    repId, 
    callDate, 
    callType,
    callTypeOther,
    stakeholderName,
    accountName,
    salesforceAccountLink,
    potentialRevenue,
    rawText,
    prospectId: existingProspectId,
    stakeholderId: existingStakeholderId,
  } = params;

  // Insert new call transcript
  const { data: transcript, error: insertError } = await supabase
    .from('call_transcripts')
    .insert({
      rep_id: repId,
      call_date: callDate,
      source: 'other', // Keep source for backward compatibility
      raw_text: rawText,
      notes: null,
      analysis_status: 'pending',
      // New fields
      primary_stakeholder_name: stakeholderName,
      account_name: accountName,
      salesforce_demo_link: salesforceAccountLink || null,
      potential_revenue: potentialRevenue ?? null,
      call_type: callType,
      call_type_other: callType === 'other' ? callTypeOther : null,
    })
    .select()
    .single();

  if (insertError) {
    console.error('[createCallTranscriptAndAnalyze] Insert error:', insertError);
    throw new Error(`Failed to create call transcript: ${insertError.message}`);
  }

  if (!transcript) {
    throw new Error('Failed to create call transcript: No data returned');
  }

  console.log('[createCallTranscriptAndAnalyze] Transcript created:', transcript.id);

  // Get or create prospect and link to call
  let prospectId: string | null = existingProspectId || null;
  try {
    if (!prospectId) {
      // No existing prospect selected, create or find one
      const { prospect } = await getOrCreateProspect({
        repId,
        prospectName: stakeholderName,
        accountName,
        salesforceLink: salesforceAccountLink,
        potentialRevenue,
      });
      prospectId = prospect.id;
    }
    
    // Link the call to the prospect
    await linkCallToProspect(transcript.id, prospectId);
    console.log('[createCallTranscriptAndAnalyze] Linked call to prospect:', prospectId);
  } catch (prospectError) {
    console.error('[createCallTranscriptAndAnalyze] Failed to create/link prospect:', prospectError);
    // Don't throw - continue with analysis even if prospect creation fails
  }

  // Call the analyze_call edge function
  const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke('analyze-call', {
    body: { call_id: transcript.id }
  });

  if (analyzeError) {
    console.error('[createCallTranscriptAndAnalyze] Analyze function error:', analyzeError);
    // Don't throw here - the transcript was created, analysis might still be processing
    return {
      transcript: transcript as CallTranscript,
      analyzeResponse: { error: analyzeError.message }
    };
  }

  console.log('[createCallTranscriptAndAnalyze] Analysis response:', analyzeData);

  return {
    transcript: transcript as CallTranscript,
    analyzeResponse: analyzeData as AnalyzeCallResponse
  };
}

/**
 * Lists recent call transcripts for a specific rep.
 * @param repId - The rep's user ID
 * @returns Array of call transcript rows ordered by date
 */
export async function listCallTranscriptsForRep(repId: string): Promise<CallTranscript[]> {
  const { data, error } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('rep_id', repId)
    .order('call_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[listCallTranscriptsForRep] Error:', error);
    throw new Error(`Failed to list call transcripts: ${error.message}`);
  }

  return (data || []) as CallTranscript[];
}

/**
 * Lists call transcripts for a rep with comprehensive filtering.
 * Includes heat_score from ai_call_analysis.
 * @param repId - The rep's user ID
 * @param filters - Filter options
 * @returns Object with data array (with heat scores) and total count
 */
export async function listCallTranscriptsForRepWithFilters(
  repId: string,
  filters: CallHistoryFilters
): Promise<{ data: CallTranscriptWithHeat[]; count: number }> {
  const needsHeatFiltering = !!filters.heatRange;
  const needsHeatSorting = filters.sortBy === 'heat_score';
  
  // If we need heat filtering/sorting, we must fetch all data first, then filter/sort client-side
  const shouldFetchAll = needsHeatFiltering || needsHeatSorting;

  let query = supabase
    .from('call_transcripts')
    .select('*', { count: shouldFetchAll ? undefined : 'exact' })
    .eq('rep_id', repId);

  // Text search across multiple columns
  if (filters.search) {
    const searchTerm = `%${filters.search}%`;
    query = query.or(
      `primary_stakeholder_name.ilike.${searchTerm},account_name.ilike.${searchTerm},call_type_other.ilike.${searchTerm},notes.ilike.${searchTerm}`
    );
  }

  // Filter by call types
  if (filters.callTypes && filters.callTypes.length > 0) {
    query = query.in('call_type', filters.callTypes);
  }

  // Filter by analysis status
  if (filters.statuses && filters.statuses.length > 0) {
    query = query.in('analysis_status', filters.statuses);
  }

  // Date range filters
  if (filters.dateFrom) {
    query = query.gte('call_date', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('call_date', filters.dateTo);
  }

  // Only apply DB sorting if not sorting by heat_score
  if (!needsHeatSorting) {
    const sortBy = filters.sortBy || 'call_date';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Secondary sort by created_at for consistency
    if (sortBy !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }
  } else {
    // Default ordering for consistent results before client-side sort
    query = query.order('call_date', { ascending: false });
  }

  // Only apply pagination if not doing heat filtering/sorting
  if (!shouldFetchAll) {
    if (filters.limit) {
      query = query.limit(filters.limit);
    }
    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[listCallTranscriptsForRepWithFilters] Error:', error);
    throw new Error(`Failed to list call transcripts: ${error.message}`);
  }

  const transcripts = (data || []) as CallTranscript[];

  if (transcripts.length === 0) {
    return { data: [], count: 0 };
  }

  // Fetch heat scores from ai_call_analysis for all transcripts
  const callIds = transcripts.map(t => t.id);
  const { data: analyses, error: analysisError } = await supabase
    .from('ai_call_analysis')
    .select('call_id, coach_output')
    .in('call_id', callIds);

  if (analysisError) {
    console.error('[listCallTranscriptsForRepWithFilters] Analysis fetch error:', analysisError);
    // Continue without heat scores if fetch fails
    return {
      data: transcripts.map(t => ({ ...t, heat_score: null })),
      count: count || transcripts.length,
    };
  }

  // Create a map of call_id -> heat_score
  const heatMap = new Map<string, number | null>();
  analyses?.forEach(a => {
    const coachOutput = a.coach_output as unknown as CoachOutput | null;
    const heatScore = coachOutput?.heat_signature?.score ?? null;
    heatMap.set(a.call_id, heatScore);
  });

  // Merge heat scores into transcripts
  let transcriptsWithHeat: CallTranscriptWithHeat[] = transcripts.map(t => ({
    ...t,
    heat_score: heatMap.get(t.id) ?? null,
  }));

  // Apply heat range filter if specified
  if (filters.heatRange) {
    transcriptsWithHeat = transcriptsWithHeat.filter(t => {
      const score = t.heat_score;
      switch (filters.heatRange) {
        case 'hot':
          return score !== null && score >= 7;
        case 'warm':
          return score !== null && score >= 4 && score < 7;
        case 'cold':
          return score === null || score < 4;
        default:
          return true;
      }
    });
  }

  // Apply heat score sorting if specified
  if (needsHeatSorting) {
    const sortOrder = filters.sortOrder || 'desc';
    transcriptsWithHeat.sort((a, b) => {
      const aScore = a.heat_score ?? -1; // Treat null as lowest
      const bScore = b.heat_score ?? -1;
      return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
    });
  }

  // Calculate total count after filtering
  const totalCount = shouldFetchAll ? transcriptsWithHeat.length : (count || 0);

  // Apply pagination for heat filtering/sorting
  if (shouldFetchAll) {
    const offset = filters.offset || 0;
    const limit = filters.limit || 50;
    transcriptsWithHeat = transcriptsWithHeat.slice(offset, offset + limit);
  }

  return {
    data: transcriptsWithHeat,
    count: totalCount,
  };
}

/**
 * Gets a single call transcript by ID with its analysis.
 * @param callId - The call transcript ID
 * @returns The transcript with analysis or null if not found
 */
export async function getCallWithAnalysis(callId: string): Promise<{
  transcript: CallTranscript;
  analysis: CallAnalysis | null;
} | null> {
  // Fetch transcript
  const { data: transcript, error: transcriptError } = await supabase
    .from('call_transcripts')
    .select('*')
    .eq('id', callId)
    .maybeSingle();

  if (transcriptError) {
    console.error('[getCallWithAnalysis] Transcript error:', transcriptError);
    throw new Error(`Failed to fetch call: ${transcriptError.message}`);
  }

  if (!transcript) {
    return null;
  }

  // Fetch analysis
  const { data: analysis, error: analysisError } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle();

  if (analysisError) {
    console.error('[getCallWithAnalysis] Analysis error:', analysisError);
    // Don't throw - transcript exists but analysis might not
  }

  return {
    transcript: transcript as CallTranscript,
    analysis: analysis as unknown as CallAnalysis | null,
  };
}

/**
 * Gets the AI analysis for a specific call.
 * @param callId - The call transcript ID
 * @returns The analysis row or null if not found
 */
export async function getAnalysisForCall(callId: string): Promise<CallAnalysis | null> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .eq('call_id', callId)
    .maybeSingle();

  if (error) {
    console.error('[getAnalysisForCall] Error:', error);
    throw new Error(`Failed to get call analysis: ${error.message}`);
  }

  return data as unknown as CallAnalysis | null;
}

/**
 * Gets the most recent AI analysis for a rep.
 * @param repId - The rep's user ID
 * @param limit - Number of results to return (default 1)
 * @returns Array of analysis rows ordered by created_at desc
 */
export async function listRecentAiAnalysisForRep(repId: string, limit: number = 1): Promise<CallAnalysis[]> {
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .eq('rep_id', repId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[listRecentAiAnalysisForRep] Error:', error);
    throw new Error(`Failed to list AI analyses: ${error.message}`);
  }

  return (data || []) as unknown as CallAnalysis[];
}

/**
 * Gets the most recent AI analysis for multiple reps in a batch.
 * Returns a map of repId -> most recent CallAnalysis (or null)
 * @param repIds - Array of rep user IDs
 * @returns Map of repId to their most recent analysis
 */
export async function getLatestAiAnalysisForReps(repIds: string[]): Promise<Map<string, CallAnalysis | null>> {
  if (repIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('*')
    .in('rep_id', repIds)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getLatestAiAnalysisForReps] Error:', error);
    throw new Error(`Failed to fetch AI analyses: ${error.message}`);
  }

  // Group by rep_id and take the most recent for each
  const result = new Map<string, CallAnalysis | null>();
  repIds.forEach(id => result.set(id, null));

  if (data) {
    for (const analysis of data as unknown as CallAnalysis[]) {
      if (!result.get(analysis.rep_id)) {
        result.set(analysis.rep_id, analysis);
      }
    }
  }

  return result;
}

/**
 * Edits a recap email draft using AI based on instructions.
 * @param originalDraft - The original recap email draft text
 * @param editInstructions - Instructions for how to modify the email
 * @param callSummary - Optional call summary for additional context
 * @returns The updated recap email draft
 */
export async function editRecapEmail(
  originalDraft: string,
  editInstructions: string,
  callSummary?: string
): Promise<string> {
  // Validate inputs
  if (!originalDraft || originalDraft.trim().length === 0) {
    throw new Error('Original draft cannot be empty');
  }
  if (!editInstructions || editInstructions.trim().length === 0) {
    throw new Error('Edit instructions cannot be empty');
  }

  console.log('[editRecapEmail] Calling edit-recap-email edge function');

  const { data, error } = await supabase.functions.invoke('edit-recap-email', {
    body: {
      original_recap_email_draft: originalDraft,
      edit_instructions: editInstructions,
      call_summary: callSummary ?? null
    }
  });

  if (error) {
    console.error('[editRecapEmail] Edge function error:', error);
    throw new Error(`Failed to edit recap email: ${error.message}`);
  }

  if (!data || typeof data.updated_recap_email_draft !== 'string') {
    console.error('[editRecapEmail] Invalid response:', data);
    throw new Error('Invalid response from edit-recap-email function');
  }

  console.log('[editRecapEmail] Successfully received updated email');
  return data.updated_recap_email_draft;
}

/**
 * Gets call counts for the last 30 days for multiple reps in a batch.
 * @param repIds - Array of rep user IDs
 * @returns Map of repId to their call count in last 30 days
 */
export async function getCallCountsLast30DaysForReps(repIds: string[]): Promise<Record<string, number>> {
  if (repIds.length === 0) {
    return {};
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data, error } = await supabase
    .from('call_transcripts')
    .select('rep_id, call_date')
    .in('rep_id', repIds)
    .gte('call_date', thirtyDaysAgo.toISOString().split('T')[0]);

  if (error) {
    console.error('[getCallCountsLast30DaysForReps] Error:', error);
    throw new Error(`Failed to fetch call counts: ${error.message}`);
  }

  // Aggregate by rep_id into a map { [repId]: count }
  const counts: Record<string, number> = {};
  for (const repId of repIds) {
    counts[repId] = 0;
  }
  for (const row of data ?? []) {
    counts[row.rep_id] = (counts[row.rep_id] ?? 0) + 1;
  }
  
  return counts;
}

export interface AiScoreStats {
  latestScore: number | null;
  latestDate: string | null;
  avgScore30Days: number | null;
  callCount30Days: number;
}

/**
 * Gets AI score stats (latest + 30-day average) for multiple reps in a batch.
 * @param repIds - Array of rep user IDs
 * @returns Map of repId to their AI score stats
 */
export async function getAiScoreStatsForReps(repIds: string[]): Promise<Map<string, AiScoreStats>> {
  const result = new Map<string, AiScoreStats>();
  
  // Initialize with empty stats for all reps
  repIds.forEach(id => result.set(id, {
    latestScore: null,
    latestDate: null,
    avgScore30Days: null,
    callCount30Days: 0,
  }));

  if (repIds.length === 0) {
    return result;
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch all analyses for these reps from the last 30 days
  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('rep_id, call_effectiveness_score, created_at')
    .in('rep_id', repIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[getAiScoreStatsForReps] Error:', error);
    throw new Error(`Failed to fetch AI score stats: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return result;
  }

  // Group analyses by rep
  const analysesByRep = new Map<string, Array<{ score: number | null; date: string }>>();
  
  for (const row of data) {
    if (!analysesByRep.has(row.rep_id)) {
      analysesByRep.set(row.rep_id, []);
    }
    analysesByRep.get(row.rep_id)!.push({
      score: row.call_effectiveness_score,
      date: row.created_at,
    });
  }

  // Calculate stats for each rep
  for (const [repId, analyses] of analysesByRep) {
    const scoresWithValues = analyses
      .map(a => a.score)
      .filter((s): s is number => s != null);
    
    const latestWithScore = analyses.find(a => a.score != null);
    
    const avgScore = scoresWithValues.length > 0
      ? scoresWithValues.reduce((sum, s) => sum + s, 0) / scoresWithValues.length
      : null;

    result.set(repId, {
      latestScore: latestWithScore?.score ?? null,
      latestDate: latestWithScore?.date ?? null,
      avgScore30Days: avgScore,
      callCount30Days: scoresWithValues.length,
    });
  }

  return result;
}

// Coaching Summary Types (legacy - kept for compatibility)
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

// AI-Powered Coaching Trend Analysis Types
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
      a.strengths.forEach((s: any) => {
        const area = s.area?.toLowerCase() || 'unknown';
        if (!strengthsMap.has(area)) {
          strengthsMap.set(area, { count: 0, examples: [] });
        }
        const entry = strengthsMap.get(area)!;
        entry.count++;
        if (s.example && entry.examples.length < 3) {
          entry.examples.push(s.example);
        }
      });
    }
    if (a.opportunities && Array.isArray(a.opportunities)) {
      a.opportunities.forEach((o: any) => {
        const area = o.area?.toLowerCase() || 'unknown';
        if (!opportunitiesMap.has(area)) {
          opportunitiesMap.set(area, { count: 0, examples: [] });
        }
        const entry = opportunitiesMap.get(area)!;
        entry.count++;
        if (o.example && entry.examples.length < 3) {
          entry.examples.push(o.example);
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

// ============= HELPER FUNCTIONS FOR TIERED ANALYSIS =============

/**
 * Determines the analysis tier based on call count
 */
export function determineAnalysisTier(callCount: number): AnalysisTier {
  if (callCount <= DIRECT_ANALYSIS_MAX) return 'direct';
  if (callCount <= SAMPLING_MAX) return 'sampled';
  return 'hierarchical';
}

/**
 * Performs stratified sampling across the date range.
 * Groups calls by week and samples proportionally to maintain temporal distribution.
 */
function stratifiedSample<T extends { date: string }>(
  calls: T[],
  targetSize: number = DIRECT_ANALYSIS_MAX
): { sampled: T[]; originalCount: number } {
  if (calls.length <= targetSize) {
    return { sampled: calls, originalCount: calls.length };
  }

  // Group calls by week
  const weekGroups = new Map<string, T[]>();
  calls.forEach(call => {
    const date = new Date(call.date);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  // Calculate proportional sample size per week
  const totalCalls = calls.length;
  const sampled: T[] = [];
  
  // Sort weeks chronologically
  const sortedWeeks = Array.from(weekGroups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  
  for (const [weekKey, weekCalls] of sortedWeeks) {
    const proportion = weekCalls.length / totalCalls;
    let sampleSize = Math.round(proportion * targetSize);
    
    // Ensure at least 1 call per week if week has calls
    sampleSize = Math.max(1, Math.min(sampleSize, weekCalls.length));
    
    // Sort by date and take evenly distributed samples
    const sorted = weekCalls.sort((a, b) => a.date.localeCompare(b.date));
    if (sampleSize >= sorted.length) {
      sampled.push(...sorted);
    } else {
      const step = sorted.length / sampleSize;
      for (let i = 0; i < sampleSize; i++) {
        sampled.push(sorted[Math.floor(i * step)]);
      }
    }
  }

  // If we're still over target, trim from the middle (preserve recent and oldest)
  if (sampled.length > targetSize) {
    const sorted = sampled.sort((a, b) => a.date.localeCompare(b.date));
    const keepStart = Math.floor(targetSize * 0.3);
    const keepEnd = Math.floor(targetSize * 0.4);
    const result = [
      ...sorted.slice(0, keepStart),
      ...sorted.slice(sorted.length - keepEnd)
    ];
    // Fill remaining from middle, evenly spaced
    const middle = sorted.slice(keepStart, sorted.length - keepEnd);
    const remaining = targetSize - result.length;
    const middleStep = middle.length / remaining;
    for (let i = 0; i < remaining && i * middleStep < middle.length; i++) {
      result.splice(keepStart + i, 0, middle[Math.floor(i * middleStep)]);
    }
    return { sampled: result.slice(0, targetSize), originalCount: calls.length };
  }

  return { sampled, originalCount: calls.length };
}

/**
 * Splits calls into weekly chunks for hierarchical analysis
 */
function splitIntoWeeklyChunks<T extends { date: string }>(
  calls: T[],
  minChunkSize: number = 5,
  maxChunkSize: number = 25
): T[][] {
  // Group by week
  const weekGroups = new Map<string, T[]>();
  calls.forEach(call => {
    const date = new Date(call.date);
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    if (!weekGroups.has(weekKey)) {
      weekGroups.set(weekKey, []);
    }
    weekGroups.get(weekKey)!.push(call);
  });

  // Sort weeks and create chunks
  const sortedWeeks = Array.from(weekGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, calls]) => calls);

  // Merge small weeks together, split large weeks
  const chunks: T[][] = [];
  let currentChunk: T[] = [];

  for (const weekCalls of sortedWeeks) {
    if (weekCalls.length > maxChunkSize) {
      // Flush current chunk if non-empty
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = [];
      } else if (currentChunk.length > 0) {
        // Add to beginning of large week
        weekCalls.unshift(...currentChunk);
        currentChunk = [];
      }
      
      // Split large week into multiple chunks
      for (let i = 0; i < weekCalls.length; i += maxChunkSize) {
        const slice = weekCalls.slice(i, i + maxChunkSize);
        if (slice.length >= minChunkSize) {
          chunks.push(slice);
        } else {
          currentChunk = slice;
        }
      }
    } else if (currentChunk.length + weekCalls.length <= maxChunkSize) {
      currentChunk.push(...weekCalls);
    } else {
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
      }
      currentChunk = weekCalls;
    }
  }

  // Handle remaining chunk
  if (currentChunk.length > 0) {
    if (currentChunk.length >= minChunkSize || chunks.length === 0) {
      chunks.push(currentChunk);
    } else {
      // Merge with last chunk
      chunks[chunks.length - 1].push(...currentChunk);
    }
  }

  return chunks;
}

interface ChunkSummary {
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

/**
 * Performs hierarchical analysis by analyzing chunks and then synthesizing
 */
async function analyzeHierarchically(
  formattedCalls: FormattedCall[],
  dateRange: { from: string; to: string }
): Promise<{ analysis: CoachingTrendAnalysis; chunksAnalyzed: number; callsPerChunk: number[] }> {
  const chunks = splitIntoWeeklyChunks(formattedCalls);
  console.log(`[analyzeHierarchically] Split ${formattedCalls.length} calls into ${chunks.length} chunks`);

  // Analyze each chunk
  const chunkSummaries: ChunkSummary[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const chunkDates = chunk.map(c => c.date).sort();
    
    console.log(`[analyzeHierarchically] Analyzing chunk ${i + 1}/${chunks.length} with ${chunk.length} calls`);
    
    const response = await supabase.functions.invoke('generate-coaching-chunk-summary', {
      body: {
        calls: chunk,
        chunkIndex: i,
        dateRange: {
          from: chunkDates[0],
          to: chunkDates[chunkDates.length - 1]
        }
      }
    });

    if (response.error) {
      console.error(`[analyzeHierarchically] Chunk ${i} error:`, response.error);
      throw new Error(`Failed to analyze chunk ${i + 1}: ${response.error.message}`);
    }

    chunkSummaries.push(response.data as ChunkSummary);
  }

  console.log(`[analyzeHierarchically] All ${chunks.length} chunks analyzed, synthesizing...`);

  // Send chunk summaries to main function for synthesis
  const response = await supabase.functions.invoke('generate-coaching-trends', {
    body: {
      hierarchicalMode: true,
      chunkSummaries,
      dateRange,
      totalCalls: formattedCalls.length
    }
  });

  if (response.error) {
    throw new Error(`Failed to synthesize hierarchical analysis: ${response.error.message}`);
  }

  return {
    analysis: response.data as CoachingTrendAnalysis,
    chunksAnalyzed: chunks.length,
    callsPerChunk: chunks.map(c => c.length)
  };
}

interface FormattedCall {
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

/**
 * Generates AI-powered coaching trend analysis for a rep over a date range.
 * This sends call analyses to an AI model which synthesizes trends and patterns.
 * 
 * Supports three analysis tiers based on call count:
 * - Direct (1-50 calls): All calls analyzed directly
 * - Sampled (51-100 calls): Stratified sampling to ~50 representative calls
 * - Hierarchical (100+ calls): Two-stage analysis with chunk summaries
 * 
 * @param repId - The rep's user ID
 * @param dateRange - Date range with from and to dates
 * @param options - Optional settings (forceRefresh to bypass cache)
 * @returns AI-generated trend analysis with insights, recommendations, and metadata
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
      // Reconstruct metadata from cached data
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
    // Tier 1: Direct analysis
    console.log(`[generateCoachingTrends] Direct analysis of ${formattedCalls.length} calls`);
    
    const response = await invokeCoachingTrendsFunction(formattedCalls, { from: fromDate, to: toDate });
    trendData = response;
    metadata = {
      tier: 'direct',
      totalCalls: callCount,
      analyzedCalls: formattedCalls.length,
    };
  } else if (tier === 'sampled') {
    // Tier 2: Smart sampling
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
    // Tier 3: Hierarchical analysis
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

  // 6. Save to cache - check if exists first, then update or insert
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
 * Helper to invoke the coaching trends edge function
 */
async function invokeCoachingTrendsFunction(
  calls: FormattedCall[],
  dateRange: { from: string; to: string }
): Promise<CoachingTrendAnalysis> {
  try {
    const response = await supabase.functions.invoke('generate-coaching-trends', {
      body: { calls, dateRange }
    });

    if (response.error) {
      const errorMessage = response.error.message?.toLowerCase() || '';
      const errorContext = (response.error as any).context?.body?.toLowerCase() || '';
      
      if (errorMessage.includes('429') || errorMessage.includes('rate') || errorContext.includes('rate limit')) {
        throw new Error('AI service is temporarily busy. Please wait a moment and try again.');
      }
      if (errorMessage.includes('402') || errorMessage.includes('quota') || errorContext.includes('quota')) {
        throw new Error('AI usage quota exceeded. Please contact support or try again later.');
      }
      if (errorMessage.includes('503') || errorMessage.includes('unavailable')) {
        throw new Error('AI service is temporarily unavailable. Please try again in a few minutes.');
      }
      
      throw new Error(`AI trend analysis failed: ${response.error.message}`);
    }

    if (!response.data || response.data.error) {
      throw new Error(response.data?.error || 'Unknown error from AI');
    }

    return response.data as CoachingTrendAnalysis;
  } catch (err: any) {
    if (err.message?.includes('temporarily') || err.message?.includes('quota') || err.message?.includes('unavailable')) {
      throw err;
    }
    throw new Error(`AI trend analysis failed: ${err.message || 'Unknown error'}`);
  }
}

// ============= AGGREGATE ANALYSIS FOR ADMIN =============

export interface AggregateAnalysisMetadata extends AnalysisMetadata {
  scope: 'organization' | 'team' | 'rep';
  teamId?: string;
  repsIncluded: number;
}

export interface AggregateCoachingTrendAnalysisWithMeta {
  analysis: CoachingTrendAnalysis;
  metadata: AggregateAnalysisMetadata;
}

interface AggregateAnalysisParams {
  scope: 'organization' | 'team' | 'rep';
  teamId?: string;
  repId?: string;
  dateRange: { from: Date; to: Date };
  options?: { forceRefresh?: boolean };
}

/**
 * Generates AI-powered coaching trend analysis across multiple reps.
 * Supports organization-wide, team-level, or individual rep analysis.
 * 
 * @param params - Analysis parameters including scope, filters, and date range
 * @returns AI-generated trend analysis with insights and metadata
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

  // Get rep IDs based on scope
  let repIds: string[] = [];
  
  if (scope === 'team' && teamId) {
    const { data: teamReps, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('team_id', teamId);
    
    if (error) throw new Error(`Failed to fetch team reps: ${error.message}`);
    repIds = (teamReps || []).map(r => r.id);
  } else {
    // Organization scope - get all active reps
    const { data: allReps, error } = await supabase
      .from('user_with_role')
      .select('id')
      .eq('role', 'rep')
      .eq('is_active', true);
    
    if (error) throw new Error(`Failed to fetch reps: ${error.message}`);
    repIds = (allReps || []).map(r => r.id);
  }

  if (repIds.length === 0) {
    throw new Error('No reps found for the selected scope');
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
    };
  }

  console.log('[generateAggregateCoachingTrends] Successfully received AI trend analysis');

  return { analysis: trendData, metadata };
}

// Export types for use in components
export type { CallAnalysis, AnalyzeCallResponse };
