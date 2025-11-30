import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toCallAnalysis } from '@/lib/supabaseAdapters';
import type { CallAnalysis, AiScoreStats } from './types';

const log = createLogger('aiAnalysis');

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
    log.error('Failed to get call analysis', { callId, error });
    throw new Error(`Failed to get call analysis: ${error.message}`);
  }

  return data ? toCallAnalysis(data) : null;
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
    log.error('Failed to list AI analyses', { repId, error });
    throw new Error(`Failed to list AI analyses: ${error.message}`);
  }

  return (data || []).map(toCallAnalysis);
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
    log.error('Failed to fetch AI analyses for reps', { repCount: repIds.length, error });
    throw new Error(`Failed to fetch AI analyses: ${error.message}`);
  }

  // Group by rep_id and take the most recent for each
  const result = new Map<string, CallAnalysis | null>();
  repIds.forEach(id => result.set(id, null));

  if (data) {
    for (const row of data) {
      const analysis = toCallAnalysis(row);
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
  if (!originalDraft || originalDraft.trim().length === 0) {
    throw new Error('Original draft cannot be empty');
  }
  if (!editInstructions || editInstructions.trim().length === 0) {
    throw new Error('Edit instructions cannot be empty');
  }

  log.info('Calling edit-recap-email edge function');

  const { data, error } = await supabase.functions.invoke('edit-recap-email', {
    body: {
      original_recap_email_draft: originalDraft,
      edit_instructions: editInstructions,
      call_summary: callSummary ?? null
    }
  });

  if (error) {
    log.error('Edge function error', { error });
    throw new Error(`Failed to edit recap email: ${error.message}`);
  }

  if (!data || typeof data.updated_recap_email_draft !== 'string') {
    log.error('Invalid response from edge function', { data });
    throw new Error('Invalid response from edit-recap-email function');
  }

  log.debug('Successfully received updated email');
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
    log.error('Failed to fetch call counts', { repCount: repIds.length, error });
    throw new Error(`Failed to fetch call counts: ${error.message}`);
  }

  const counts: Record<string, number> = {};
  for (const repId of repIds) {
    counts[repId] = 0;
  }
  for (const row of data ?? []) {
    counts[row.rep_id] = (counts[row.rep_id] ?? 0) + 1;
  }
  
  return counts;
}

/**
 * Gets AI score stats (latest + 30-day average) for multiple reps in a batch.
 * @param repIds - Array of rep user IDs
 * @returns Map of repId to their AI score stats
 */
export async function getAiScoreStatsForReps(repIds: string[]): Promise<Map<string, AiScoreStats>> {
  const result = new Map<string, AiScoreStats>();
  
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

  const { data, error } = await supabase
    .from('ai_call_analysis')
    .select('rep_id, call_effectiveness_score, created_at')
    .in('rep_id', repIds)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Failed to fetch AI score stats', { repCount: repIds.length, error });
    throw new Error(`Failed to fetch AI score stats: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return result;
  }

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
