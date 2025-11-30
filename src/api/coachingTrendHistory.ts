import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { CoachingTrendAnalysis } from './aiCallAnalysis';

const log = createLogger('coachingHistory');

export interface CoachingTrendHistoryItem {
  id: string;
  rep_id: string;
  date_range_from: string;
  date_range_to: string;
  call_count: number;
  created_at: string;
  updated_at: string;
  title: string | null;
  is_snapshot: boolean;
  analysis_data: CoachingTrendAnalysis;
}

/**
 * Lists all coaching trend analyses for a rep, ordered by creation date.
 * @param repId - The rep's user ID
 * @param options - Optional filters
 * @returns Array of coaching trend history items
 */
export async function listCoachingTrendHistory(
  repId: string,
  options?: { snapshotsOnly?: boolean; limit?: number }
): Promise<CoachingTrendHistoryItem[]> {
  let query = supabase
    .from('coaching_trend_analyses')
    .select('*')
    .eq('rep_id', repId)
    .order('created_at', { ascending: false });

  if (options?.snapshotsOnly) {
    query = query.eq('is_snapshot', true);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    log.error('Failed to fetch coaching trend history', { error });
    throw new Error(`Failed to fetch coaching trend history: ${error.message}`);
  }

  return (data || []).map(item => ({
    ...item,
    analysis_data: item.analysis_data as unknown as CoachingTrendAnalysis,
  })) as CoachingTrendHistoryItem[];
}

/**
 * Gets a specific coaching trend analysis by ID.
 * @param analysisId - The analysis ID
 * @returns The coaching trend analysis or null
 */
export async function getCoachingTrendAnalysis(
  analysisId: string
): Promise<CoachingTrendHistoryItem | null> {
  const { data, error } = await supabase
    .from('coaching_trend_analyses')
    .select('*')
    .eq('id', analysisId)
    .maybeSingle();

  if (error) {
    log.error('Failed to fetch coaching trend analysis', { error });
    throw new Error(`Failed to fetch coaching trend analysis: ${error.message}`);
  }

  if (!data) return null;

  return {
    ...data,
    analysis_data: data.analysis_data as unknown as CoachingTrendAnalysis,
  } as CoachingTrendHistoryItem;
}

/**
 * Saves a coaching trend analysis as a snapshot with an optional title.
 * @param analysisId - The analysis ID to save as snapshot
 * @param title - Optional title for the snapshot
 * @returns The updated analysis
 */
export async function saveCoachingTrendSnapshot(
  analysisId: string,
  title?: string
): Promise<CoachingTrendHistoryItem> {
  const { data, error } = await supabase
    .from('coaching_trend_analyses')
    .update({
      is_snapshot: true,
      title: title || null,
    })
    .eq('id', analysisId)
    .select()
    .single();

  if (error) {
    log.error('Failed to save snapshot', { error });
    throw new Error(`Failed to save snapshot: ${error.message}`);
  }

  return {
    ...data,
    analysis_data: data.analysis_data as unknown as CoachingTrendAnalysis,
  } as CoachingTrendHistoryItem;
}

/**
 * Updates the title of a coaching trend snapshot.
 * @param analysisId - The analysis ID
 * @param title - New title for the snapshot
 * @returns The updated analysis
 */
export async function updateSnapshotTitle(
  analysisId: string,
  title: string
): Promise<CoachingTrendHistoryItem> {
  const { data, error } = await supabase
    .from('coaching_trend_analyses')
    .update({ title })
    .eq('id', analysisId)
    .select()
    .single();

  if (error) {
    log.error('Failed to update snapshot title', { error });
    throw new Error(`Failed to update snapshot title: ${error.message}`);
  }

  return {
    ...data,
    analysis_data: data.analysis_data as unknown as CoachingTrendAnalysis,
  } as CoachingTrendHistoryItem;
}

/**
 * Removes a coaching trend analysis from snapshots (sets is_snapshot to false).
 * @param analysisId - The analysis ID
 */
export async function removeFromSnapshots(analysisId: string): Promise<void> {
  const { error } = await supabase
    .from('coaching_trend_analyses')
    .update({ is_snapshot: false, title: null })
    .eq('id', analysisId);

  if (error) {
    log.error('Failed to remove snapshot', { error });
    throw new Error(`Failed to remove snapshot: ${error.message}`);
  }
}

/**
 * Deletes a coaching trend analysis entirely.
 * @param analysisId - The analysis ID
 */
export async function deleteCoachingTrendAnalysis(analysisId: string): Promise<void> {
  const { error } = await supabase
    .from('coaching_trend_analyses')
    .delete()
    .eq('id', analysisId);

  if (error) {
    log.error('Failed to delete analysis', { error });
    throw new Error(`Failed to delete analysis: ${error.message}`);
  }
}
