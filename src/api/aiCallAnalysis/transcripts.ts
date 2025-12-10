import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { getOrCreateProspect, linkCallToProspect } from '@/api/prospects';
import { getOrCreateStakeholder, createCallStakeholderMention } from '@/api/stakeholders';
import { toCallTranscript, toCallAnalysis, toCoachOutput } from '@/lib/supabaseAdapters';
import { insertCallProducts, updateProspectActiveRevenue } from '@/api/callProducts';
import type {
  CreateCallTranscriptParams,
  CallTranscript,
  CallTranscriptWithHeat,
  CallHistoryFilters,
  AnalyzeCallResponse,
  CallAnalysis,
} from './types';

const log = createLogger('transcripts');

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
    stakeholders,
    accountName,
    salesforceAccountLink,
    potentialRevenue,
    rawText,
    prospectId: existingProspectId,
    managerOnCall,
  } = params;

  // Get primary stakeholder name (first in array) for backward compatibility
  const primaryStakeholderName = stakeholders.length > 0 ? stakeholders[0].stakeholderName : '';

  // If manager was on the call, look up the rep's team manager
  let managerId: string | null = null;
  if (managerOnCall) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('team_id')
      .eq('id', repId)
      .maybeSingle();
    
    if (profile?.team_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('manager_id')
        .eq('id', profile.team_id)
        .maybeSingle();
      
      managerId = team?.manager_id || null;
    }
  }

  // Insert new call transcript
  const { data: transcript, error: insertError } = await supabase
    .from('call_transcripts')
    .insert({
      rep_id: repId,
      call_date: callDate,
      source: 'other',
      raw_text: rawText,
      notes: null,
      analysis_status: 'pending',
      primary_stakeholder_name: primaryStakeholderName,
      account_name: accountName,
      salesforce_demo_link: salesforceAccountLink || null,
      potential_revenue: potentialRevenue ?? null,
      call_type: callType,
      call_type_other: callType === 'other' ? callTypeOther : null,
      manager_id: managerId,
      additional_speakers: params.additionalSpeakers || [],
    })
    .select()
    .single();

  if (insertError) {
    log.error('Insert error', { error: insertError });
    throw new Error(`Failed to create call transcript: ${insertError.message}`);
  }

  if (!transcript) {
    throw new Error('Failed to create call transcript: No data returned');
  }

  log.info('Transcript created', { transcriptId: transcript.id });

  // Get or create prospect and link to call
  let prospectId: string | null = existingProspectId || null;
  try {
    if (!prospectId) {
      const { prospect } = await getOrCreateProspect({
        repId,
        prospectName: primaryStakeholderName,
        accountName,
        salesforceLink: salesforceAccountLink,
        potentialRevenue,
      });
      prospectId = prospect.id;
    }
    
    await linkCallToProspect(transcript.id, prospectId);
    log.debug('Linked call to prospect', { prospectId });

    // Create or update all stakeholders with their influence levels and link to call
    for (const stakeholderEntry of stakeholders) {
      try {
        const { stakeholder, isNew } = await getOrCreateStakeholder({
          prospectId,
          repId,
          name: stakeholderEntry.stakeholderName,
          influenceLevel: stakeholderEntry.influenceLevel,
        });
        
        // Create mention linking stakeholder to this call
        await createCallStakeholderMention({
          callId: transcript.id,
          stakeholderId: stakeholder.id,
          wasPresent: true,
        });
        
        log.info('Stakeholder linked to call', { 
          stakeholderId: stakeholder.id, 
          isNew, 
          influenceLevel: stakeholderEntry.influenceLevel 
        });
      } catch (stakeholderError) {
        log.error('Failed to create/link stakeholder', { 
          error: stakeholderError,
          stakeholderName: stakeholderEntry.stakeholderName 
        });
        // Non-fatal: continue with other stakeholders even if one fails
      }
    }
  } catch (prospectError) {
    log.error('Failed to create/link prospect', { error: prospectError });
  }

  // Insert call products if provided
  if (params.products && params.products.length > 0) {
    try {
      await insertCallProducts(transcript.id, params.products);
      log.info('Inserted call products', { 
        callId: transcript.id, 
        count: params.products.length 
      });

      // Update prospect's active revenue if linked to a prospect
      if (prospectId) {
        await updateProspectActiveRevenue(prospectId);
        log.info('Updated prospect active revenue', { 
          prospectId 
        });
      }
    } catch (productError) {
      log.error('Failed to insert call products', { error: productError });
      // Don't throw - transcript is already created, products are optional
    }
  }

  // Call the analyze_call edge function with retry logic
  log.info('Invoking analyze-call edge function', { callId: transcript.id });
  
  let analyzeData: unknown;
  let analyzeError: Error | null = null;
  
  const MAX_RETRIES = 2;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await supabase.functions.invoke('analyze-call', {
        body: { call_id: transcript.id }
      });
      analyzeData = result.data;
      analyzeError = result.error;
      
      log.info('Analyze-call invoke completed', { 
        callId: transcript.id, 
        attempt: attempt + 1,
        hasData: !!result.data, 
        hasError: !!result.error,
        errorMessage: result.error?.message 
      });
      
      // If successful or rate limited, don't retry
      if (!result.error || result.error.message?.toLowerCase().includes('rate limit')) {
        break;
      }
      
      // Retry on transient failures
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * (attempt + 1); // 1s, 2s backoff
        log.warn('Retrying analyze-call', { callId: transcript.id, attempt: attempt + 1, delay });
        await new Promise(r => setTimeout(r, delay));
      }
    } catch (invokeErr) {
      log.error('Analyze-call invoke threw exception', { 
        callId: transcript.id, 
        attempt: attempt + 1,
        error: invokeErr instanceof Error ? invokeErr.message : String(invokeErr)
      });
      analyzeError = invokeErr instanceof Error ? invokeErr : new Error(String(invokeErr));
      
      // Retry on exceptions
      if (attempt < MAX_RETRIES) {
        const delay = 1000 * (attempt + 1);
        log.warn('Retrying after exception', { callId: transcript.id, attempt: attempt + 1, delay });
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }

  if (analyzeError) {
    log.error('Analyze function error', { error: analyzeError });
    const isRateLimited = analyzeError.message?.toLowerCase().includes('rate limit') ||
                          analyzeError.message?.includes('429');
    
    // Update transcript status to error so it shows retry button
    const { error: statusUpdateError } = await supabase
      .from('call_transcripts')
      .update({
        analysis_status: 'error',
        analysis_error: analyzeError.message || 'Analysis failed - please retry',
      })
      .eq('id', transcript.id);
    
    if (statusUpdateError) {
      log.error('Failed to update transcript status to error', { 
        callId: transcript.id, 
        error: statusUpdateError 
      });
    }
    
    return {
      transcript: toCallTranscript(transcript),
      analyzeResponse: { error: analyzeError.message, isRateLimited }
    };
  }

  // Check if the response indicates rate limiting
  const responseData = analyzeData as { error?: string } | undefined;
  if (responseData?.error?.toLowerCase().includes('rate limit')) {
    return {
      transcript: toCallTranscript(transcript),
      analyzeResponse: { error: responseData.error, isRateLimited: true }
    };
  }

  log.debug('Analysis response received', { transcriptId: transcript.id });

  return {
    transcript: toCallTranscript(transcript),
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
    log.error('Error listing transcripts', { repId, error });
    throw new Error(`Failed to list call transcripts: ${error.message}`);
  }

  return (data || []).map(row => toCallTranscript(row));
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
  const needsGradeSorting = filters.sortBy === 'coach_grade';
  const shouldFetchAll = needsHeatFiltering || needsHeatSorting || needsGradeSorting;

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

  // Only apply DB sorting if not sorting by heat_score or coach_grade
  if (!needsHeatSorting && !needsGradeSorting) {
    const sortBy = filters.sortBy || 'call_date';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    if (sortBy !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }
  } else {
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
    log.error('Error listing transcripts with filters', { repId, error });
    throw new Error(`Failed to list call transcripts: ${error.message}`);
  }

  const transcripts = (data || []).map(row => toCallTranscript(row));

  if (transcripts.length === 0) {
    return { data: [], count: 0 };
  }

  // Fetch heat scores and coach grades from ai_call_analysis
  const callIds = transcripts.map(t => t.id);
  const { data: analyses, error: analysisError } = await supabase
    .from('ai_call_analysis')
    .select('call_id, deal_heat_analysis, coach_output, analysis_coaching')
    .in('call_id', callIds);

  if (analysisError) {
    log.error('Analysis fetch error', { error: analysisError });
    return {
      data: transcripts.map(t => ({ ...t, heat_score: null, coach_grade: null })),
      count: count || transcripts.length,
    };
  }

  // Create maps for call_id -> heat_score and coach_grade
  const heatMap = new Map<string, number | null>();
  const gradeMap = new Map<string, string | null>();
  analyses?.forEach(a => {
    // Heat score: prefer new deal_heat_analysis (0-100 scale)
    const dealHeat = a.deal_heat_analysis as { heat_score?: number } | null;
    if (dealHeat?.heat_score != null) {
      heatMap.set(a.call_id, dealHeat.heat_score);
    } else {
      // Fallback to legacy coach_output.heat_signature.score (0-10 scale, convert to 0-100)
      const coachOutput = toCoachOutput(a.coach_output);
      const legacyScore = coachOutput?.heat_signature?.score ?? null;
      heatMap.set(a.call_id, legacyScore != null ? legacyScore * 10 : null);
    }
    
    // Coach grade from analysis_coaching
    const coaching = a.analysis_coaching as { overall_grade?: string } | null;
    gradeMap.set(a.call_id, coaching?.overall_grade ?? null);
  });

  // Merge heat scores and grades into transcripts
  let transcriptsWithHeat: CallTranscriptWithHeat[] = transcripts.map(t => ({
    ...t,
    heat_score: heatMap.get(t.id) ?? null,
    coach_grade: gradeMap.get(t.id) ?? null,
  }));

  // Apply heat range filter if specified (using 0-100 scale)
  if (filters.heatRange) {
    transcriptsWithHeat = transcriptsWithHeat.filter(t => {
      const score = t.heat_score;
      switch (filters.heatRange) {
        case 'hot':
          return score !== null && score >= 70;
        case 'warm':
          return score !== null && score >= 40 && score < 70;
        case 'cold':
          return score === null || score < 40;
        default:
          return true;
      }
    });
  }

  // Apply heat score sorting if specified
  if (needsHeatSorting) {
    const sortOrder = filters.sortOrder || 'desc';
    transcriptsWithHeat.sort((a, b) => {
      const aScore = a.heat_score ?? -1;
      const bScore = b.heat_score ?? -1;
      return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
    });
  }

  // Apply grade sorting if specified
  if (needsGradeSorting) {
    const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    const getGradeRank = (grade: string | null): number => {
      if (!grade) return -1;
      const index = GRADE_ORDER.indexOf(grade);
      return index === -1 ? -1 : GRADE_ORDER.length - index;
    };
    const sortOrder = filters.sortOrder || 'desc';
    transcriptsWithHeat.sort((a, b) => {
      const aRank = getGradeRank(a.coach_grade);
      const bRank = getGradeRank(b.coach_grade);
      return sortOrder === 'desc' ? bRank - aRank : aRank - bRank;
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
  // Fetch transcript with rep profile
  const { data: transcript, error: transcriptError } = await supabase
    .from('call_transcripts')
    .select(`
      *,
      rep:profiles!call_transcripts_rep_id_fkey(id, name)
    `)
    .eq('id', callId)
    .maybeSingle();

  if (transcriptError) {
    log.error('Transcript fetch error', { callId, error: transcriptError });
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
    log.error('Analysis fetch error', { callId, error: analysisError });
  }

  // Extract rep name from joined data
  const repName = (transcript.rep as { id: string; name: string } | null)?.name ?? null;

  return {
    transcript: toCallTranscript(transcript, repName),
    analysis: analysis ? toCallAnalysis(analysis) : null,
  };
}

/**
 * Retries analysis for a failed call by resetting status and re-invoking analyze-call.
 * @param callId - The call transcript ID
 * @returns Success status and any error message
 */
export async function retryCallAnalysis(callId: string): Promise<{ success: boolean; error?: string; isRateLimited?: boolean }> {
  log.info('Retrying analysis', { callId });

  // Reset status to pending and clear error
  const { error: updateError } = await supabase
    .from('call_transcripts')
    .update({
      analysis_status: 'pending',
      analysis_error: null,
    })
    .eq('id', callId);

  if (updateError) {
    log.error('Failed to reset transcript status', { callId, error: updateError });
    return { success: false, error: updateError.message };
  }

  // Invoke analyze-call edge function with force flag to bypass deduplication
  const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke('analyze-call', {
    body: { call_id: callId, force_reanalyze: true }
  });

  if (analyzeError) {
    log.error('Analyze function error on retry', { callId, error: analyzeError });
    const isRateLimited = analyzeError.message?.toLowerCase().includes('rate limit') ||
                          analyzeError.message?.includes('429');
    return { success: false, error: analyzeError.message, isRateLimited };
  }

  // Check if the response indicates rate limiting
  if (analyzeData?.error?.toLowerCase().includes('rate limit')) {
    return { success: false, error: analyzeData.error, isRateLimited: true };
  }

  log.info('Analysis retry initiated successfully', { callId });
  return { success: true };
}

/**
 * Hard-deletes a failed transcript so the rep can resubmit fresh.
 * Only allows deletion of transcripts with error or pending status.
 * Deletes related records first (ai_call_analysis, call_products, call_stakeholder_mentions, transcript_chunks).
 * @param callId - The call transcript ID
 * @returns Success status and any error message
 */
export async function deleteFailedTranscript(callId: string): Promise<{ success: boolean; error?: string }> {
  log.info('Deleting failed transcript (hard delete)', { callId });

  // First verify the transcript has error or pending status
  const { data: transcript, error: fetchError } = await supabase
    .from('call_transcripts')
    .select('analysis_status')
    .eq('id', callId)
    .single();

  if (fetchError) {
    log.error('Failed to fetch transcript for deletion', { callId, error: fetchError });
    return { success: false, error: fetchError.message };
  }

  if (transcript.analysis_status !== 'error' && transcript.analysis_status !== 'pending') {
    log.warn('Attempted to delete non-error/pending transcript', { callId, status: transcript.analysis_status });
    return { success: false, error: 'Can only delete transcripts with failed or pending analysis' };
  }

  // Delete related records first (foreign key constraints)
  const deleteOperations = [
    supabase.from('ai_call_analysis').delete().eq('call_id', callId),
    supabase.from('call_products').delete().eq('call_id', callId),
    supabase.from('call_stakeholder_mentions').delete().eq('call_id', callId),
    supabase.from('transcript_chunks').delete().eq('transcript_id', callId),
  ];

  const results = await Promise.all(deleteOperations);
  const failedOps = results.filter(r => r.error);
  if (failedOps.length > 0) {
    log.warn('Some related record deletions failed', { callId, errors: failedOps.map(r => r.error) });
    // Continue anyway - the main delete might still work
  }

  // Hard delete the transcript
  const { error: deleteError } = await supabase
    .from('call_transcripts')
    .delete()
    .eq('id', callId);

  if (deleteError) {
    log.error('Failed to delete transcript', { callId, error: deleteError });
    return { success: false, error: deleteError.message };
  }

  log.info('Transcript deleted successfully (hard delete)', { callId });
  return { success: true };
}

/**
 * Updates editable fields on a call transcript.
 * @param callId - The call transcript ID
 * @param updates - The fields to update
 * @returns Success status and any error message
 */
export interface UpdateCallTranscriptParams {
  call_date?: string;
  call_type?: string;
  call_type_other?: string | null;
  primary_stakeholder_name?: string | null;
  account_name?: string | null;
  salesforce_demo_link?: string | null;
  potential_revenue?: number | null;
  notes?: string | null;
  manager_id?: string | null;
}

export async function updateCallTranscript(
  callId: string, 
  updates: UpdateCallTranscriptParams
): Promise<{ success: boolean; error?: string }> {
  log.info('Updating call transcript', { callId, updates });

  const { error: updateError } = await supabase
    .from('call_transcripts')
    .update(updates)
    .eq('id', callId);

  if (updateError) {
    log.error('Failed to update transcript', { callId, error: updateError });
    return { success: false, error: updateError.message };
  }

  log.info('Transcript updated successfully', { callId });
  return { success: true };
}

/**
 * Extended transcript type with rep name for team views.
 */
export interface CallTranscriptWithHeatAndRep extends CallTranscriptWithHeat {
  rep_name: string | null;
}

/**
 * Lists call transcripts for multiple reps (team view) with comprehensive filtering.
 * Includes heat_score from ai_call_analysis and rep_name from profiles.
 * @param repIds - Array of rep user IDs
 * @param filters - Filter options (with optional repId to filter to specific rep)
 * @returns Object with data array (with heat scores and rep names) and total count
 */
export async function listCallTranscriptsForTeamWithFilters(
  repIds: string[],
  filters: CallHistoryFilters & { repId?: string }
): Promise<{ data: CallTranscriptWithHeatAndRep[]; count: number }> {
  if (repIds.length === 0) {
    return { data: [], count: 0 };
  }

  // If filtering to a specific rep, use only that rep
  const targetRepIds = filters.repId ? [filters.repId] : repIds;

  const needsHeatFiltering = !!filters.heatRange;
  const needsHeatSorting = filters.sortBy === 'heat_score';
  const needsGradeSorting = filters.sortBy === 'coach_grade';
  const shouldFetchAll = needsHeatFiltering || needsHeatSorting || needsGradeSorting;

  let query = supabase
    .from('call_transcripts')
    .select('*, rep:profiles!call_transcripts_rep_id_fkey(id, name)', { count: shouldFetchAll ? undefined : 'exact' })
    .in('rep_id', targetRepIds);

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

  // Only apply DB sorting if not sorting by heat_score or coach_grade
  if (!needsHeatSorting && !needsGradeSorting) {
    const sortBy = filters.sortBy || 'call_date';
    const sortOrder = filters.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    if (sortBy !== 'created_at') {
      query = query.order('created_at', { ascending: false });
    }
  } else {
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
    log.error('Error listing team transcripts with filters', { repIds, error });
    throw new Error(`Failed to list team call transcripts: ${error.message}`);
  }

  // Extract rep names and convert to transcripts
  const transcripts = (data || []).map(row => {
    const repData = row.rep as { id: string; name: string } | null;
    return {
      ...toCallTranscript(row),
      rep_name: repData?.name ?? null,
    };
  });

  if (transcripts.length === 0) {
    return { data: [], count: 0 };
  }

  // Fetch heat scores and coach grades from ai_call_analysis
  const callIds = transcripts.map(t => t.id);
  const { data: analyses, error: analysisError } = await supabase
    .from('ai_call_analysis')
    .select('call_id, deal_heat_analysis, coach_output, analysis_coaching')
    .in('call_id', callIds);

  if (analysisError) {
    log.error('Analysis fetch error', { error: analysisError });
    return {
      data: transcripts.map(t => ({ ...t, heat_score: null, coach_grade: null })),
      count: count || transcripts.length,
    };
  }

  // Create maps for call_id -> heat_score and coach_grade
  const heatMap = new Map<string, number | null>();
  const gradeMap = new Map<string, string | null>();
  analyses?.forEach(a => {
    const dealHeat = a.deal_heat_analysis as { heat_score?: number } | null;
    if (dealHeat?.heat_score != null) {
      heatMap.set(a.call_id, dealHeat.heat_score);
    } else {
      const coachOutput = toCoachOutput(a.coach_output);
      const legacyScore = coachOutput?.heat_signature?.score ?? null;
      heatMap.set(a.call_id, legacyScore != null ? legacyScore * 10 : null);
    }
    
    // Coach grade from analysis_coaching
    const coaching = a.analysis_coaching as { overall_grade?: string } | null;
    gradeMap.set(a.call_id, coaching?.overall_grade ?? null);
  });

  // Merge heat scores and grades into transcripts
  let transcriptsWithHeat: CallTranscriptWithHeatAndRep[] = transcripts.map(t => ({
    ...t,
    heat_score: heatMap.get(t.id) ?? null,
    coach_grade: gradeMap.get(t.id) ?? null,
  }));

  // Apply heat range filter if specified
  if (filters.heatRange) {
    transcriptsWithHeat = transcriptsWithHeat.filter(t => {
      const score = t.heat_score;
      switch (filters.heatRange) {
        case 'hot':
          return score !== null && score >= 70;
        case 'warm':
          return score !== null && score >= 40 && score < 70;
        case 'cold':
          return score === null || score < 40;
        default:
          return true;
      }
    });
  }

  // Apply heat score sorting if specified
  if (needsHeatSorting) {
    const sortOrder = filters.sortOrder || 'desc';
    transcriptsWithHeat.sort((a, b) => {
      const aScore = a.heat_score ?? -1;
      const bScore = b.heat_score ?? -1;
      return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
    });
  }

  // Apply grade sorting if specified
  if (needsGradeSorting) {
    const GRADE_ORDER = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F'];
    const getGradeRank = (grade: string | null): number => {
      if (!grade) return -1;
      const index = GRADE_ORDER.indexOf(grade);
      return index === -1 ? -1 : GRADE_ORDER.length - index;
    };
    const sortOrder = filters.sortOrder || 'desc';
    transcriptsWithHeat.sort((a, b) => {
      const aRank = getGradeRank(a.coach_grade);
      const bRank = getGradeRank(b.coach_grade);
      return sortOrder === 'desc' ? bRank - aRank : aRank - bRank;
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
 * Admin function to delete any call transcript regardless of status.
 * This performs a hard delete of the transcript and all related records.
 * Only admins can use this function (enforced by RLS).
 * @param callId - The call transcript ID to delete
 * @returns Success status and any error message
 */
export async function adminDeleteCall(
  callId: string
): Promise<{ success: boolean; error?: string }> {
  log.info('Admin deleting call transcript', { callId });

  // Delete related records first (these have foreign key constraints)
  const deleteOperations = [
    supabase.from('ai_call_analysis').delete().eq('call_id', callId),
    supabase.from('call_products').delete().eq('call_id', callId),
    supabase.from('call_stakeholder_mentions').delete().eq('call_id', callId),
    supabase.from('transcript_chunks').delete().eq('transcript_id', callId),
  ];

  const results = await Promise.all(deleteOperations);
  const failedOps = results.filter(r => r.error);
  if (failedOps.length > 0) {
    log.warn('Some related record deletions failed', { callId, errors: failedOps.map(r => r.error) });
    // Continue anyway - the main delete might still work
  }

  // Hard delete the transcript
  const { error: deleteError } = await supabase
    .from('call_transcripts')
    .delete()
    .eq('id', callId);

  if (deleteError) {
    log.error('Admin failed to delete transcript', { callId, error: deleteError });
    return { success: false, error: deleteError.message };
  }

  log.info('Admin deleted transcript successfully', { callId });
  return { success: true };
}
