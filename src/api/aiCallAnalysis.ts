import { supabase } from '@/integrations/supabase/client';
import { CallType } from '@/constants/callTypes';
import { getOrCreateProspect, linkCallToProspect, updateProspect, type ProspectIntel } from '@/api/prospects';

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

type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface CallHistoryFilters {
  search?: string;
  callTypes?: CallType[];
  statuses?: AnalysisStatus[];
  dateFrom?: string;
  dateTo?: string;
  sortBy?: 'call_date' | 'account_name' | 'created_at';
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
 * @param repId - The rep's user ID
 * @param filters - Filter options
 * @returns Object with data array and total count
 */
export async function listCallTranscriptsForRepWithFilters(
  repId: string,
  filters: CallHistoryFilters
): Promise<{ data: CallTranscript[]; count: number }> {
  let query = supabase
    .from('call_transcripts')
    .select('*', { count: 'exact' })
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

  // Sorting
  const sortBy = filters.sortBy || 'call_date';
  const sortOrder = filters.sortOrder || 'desc';
  query = query.order(sortBy, { ascending: sortOrder === 'asc' });

  // Secondary sort by created_at for consistency
  if (sortBy !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  // Pagination
  if (filters.limit) {
    query = query.limit(filters.limit);
  }
  if (filters.offset) {
    query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('[listCallTranscriptsForRepWithFilters] Error:', error);
    throw new Error(`Failed to list call transcripts: ${error.message}`);
  }

  return {
    data: (data || []) as CallTranscript[],
    count: count || 0,
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

/**
 * Generates AI-powered coaching trend analysis for a rep over a date range.
 * This sends all call analyses to an AI model which synthesizes trends and patterns.
 * @param repId - The rep's user ID
 * @param dateRange - Date range with from and to dates
 * @returns AI-generated trend analysis with insights and recommendations
 */
export async function generateCoachingTrends(
  repId: string,
  dateRange: { from: Date; to: Date }
): Promise<CoachingTrendAnalysis> {
  // 1. Fetch all call analyses in date range
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

  console.log(`[generateCoachingTrends] Found ${analyses.length} analyses, sending to AI`);

  // 2. Format only the relevant fields for AI
  const formattedCalls = analyses.map(a => ({
    date: a.created_at.split('T')[0],
    framework_scores: a.coach_output?.framework_scores ?? null,
    bant_improvements: a.coach_output?.bant_improvements ?? [],
    gap_selling_improvements: a.coach_output?.gap_selling_improvements ?? [],
    active_listening_improvements: a.coach_output?.active_listening_improvements ?? [],
    critical_info_missing: a.coach_output?.critical_info_missing ?? [],
    follow_up_questions: a.coach_output?.recommended_follow_up_questions ?? [],
    heat_score: a.coach_output?.heat_signature?.score ?? null,
  }));

  // 3. Call edge function
  const { data: trendData, error: funcError } = await supabase.functions.invoke('generate-coaching-trends', {
    body: { 
      calls: formattedCalls, 
      dateRange: {
        from: dateRange.from.toISOString().split('T')[0],
        to: dateRange.to.toISOString().split('T')[0]
      }
    }
  });

  if (funcError) {
    console.error('[generateCoachingTrends] Edge function error:', funcError);
    throw new Error(`AI trend analysis failed: ${funcError.message}`);
  }

  if (!trendData || trendData.error) {
    const errorMsg = trendData?.error || 'Unknown error from AI';
    console.error('[generateCoachingTrends] AI error:', errorMsg);
    throw new Error(errorMsg);
  }

  console.log('[generateCoachingTrends] Successfully received AI trend analysis');
  return trendData as CoachingTrendAnalysis;
}

// Export types for use in components
export type { CallAnalysis, AnalyzeCallResponse };
