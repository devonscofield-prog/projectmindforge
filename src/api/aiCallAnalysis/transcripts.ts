import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { getOrCreateProspect, linkCallToProspect } from '@/api/prospects';
import { toCallTranscript, toCallAnalysis, toCoachOutput } from '@/lib/supabaseAdapters';
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
    stakeholderName,
    accountName,
    salesforceAccountLink,
    potentialRevenue,
    rawText,
    prospectId: existingProspectId,
  } = params;

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
        prospectName: stakeholderName,
        accountName,
        salesforceLink: salesforceAccountLink,
        potentialRevenue,
      });
      prospectId = prospect.id;
    }
    
    await linkCallToProspect(transcript.id, prospectId);
    log.debug('Linked call to prospect', { prospectId });
  } catch (prospectError) {
    log.error('Failed to create/link prospect', { error: prospectError });
  }

  // Call the analyze_call edge function
  const { data: analyzeData, error: analyzeError } = await supabase.functions.invoke('analyze-call', {
    body: { call_id: transcript.id }
  });

  if (analyzeError) {
    log.error('Analyze function error', { error: analyzeError });
    const isRateLimited = analyzeError.message?.toLowerCase().includes('rate limit') ||
                          analyzeError.message?.includes('429');
    return {
      transcript: toCallTranscript(transcript),
      analyzeResponse: { error: analyzeError.message, isRateLimited }
    };
  }

  // Check if the response indicates rate limiting
  if (analyzeData?.error?.toLowerCase().includes('rate limit')) {
    return {
      transcript: toCallTranscript(transcript),
      analyzeResponse: { error: analyzeData.error, isRateLimited: true }
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

  return (data || []).map(toCallTranscript);
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

  const transcripts = (data || []).map(toCallTranscript);

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
    log.error('Analysis fetch error', { error: analysisError });
    return {
      data: transcripts.map(t => ({ ...t, heat_score: null })),
      count: count || transcripts.length,
    };
  }

  // Create a map of call_id -> heat_score
  const heatMap = new Map<string, number | null>();
  analyses?.forEach(a => {
    const coachOutput = toCoachOutput(a.coach_output);
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
      const aScore = a.heat_score ?? -1;
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

  return {
    transcript: toCallTranscript(transcript),
    analysis: analysis ? toCallAnalysis(analysis) : null,
  };
}
