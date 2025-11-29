import { supabase } from '@/integrations/supabase/client';
import { CallType } from '@/constants/callTypes';
import { getOrCreateProspect, linkCallToProspect, updateProspect, type ProspectIntel } from '@/api/prospects';

interface CreateCallTranscriptParams {
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  prospectName: string;
  accountName: string;
  salesforceDemoLink: string;
  potentialRevenue?: number;
  rawText: string;
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
  prospect_name: string | null;
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
  critical_info_missing: string[];
  recommended_follow_up_questions: string[];
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
    prospectName,
    accountName,
    salesforceDemoLink,
    potentialRevenue,
    rawText 
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
      prospect_name: prospectName,
      account_name: accountName,
      salesforce_demo_link: salesforceDemoLink,
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
  let prospectId: string | null = null;
  try {
    const { prospect } = await getOrCreateProspect({
      repId,
      prospectName,
      accountName,
      salesforceLink: salesforceDemoLink,
      potentialRevenue,
    });
    prospectId = prospect.id;
    
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
      `prospect_name.ilike.${searchTerm},account_name.ilike.${searchTerm},call_type_other.ilike.${searchTerm},notes.ilike.${searchTerm}`
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

// Export types for use in components
export type { CallAnalysis, AnalyzeCallResponse };
