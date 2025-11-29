import { supabase } from '@/integrations/supabase/client';

export type FollowUpStatus = 'pending' | 'completed' | 'dismissed';
export type FollowUpPriority = 'high' | 'medium' | 'low';
export type FollowUpCategory = 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';

export interface AccountFollowUp {
  id: string;
  prospect_id: string;
  rep_id: string;
  title: string;
  description: string | null;
  priority: FollowUpPriority;
  category: FollowUpCategory | null;
  status: FollowUpStatus;
  completed_at: string | null;
  generated_from_call_ids: string[] | null;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * List follow-ups for a prospect with optional status filter
 */
export async function listFollowUpsForProspect(
  prospectId: string,
  status?: FollowUpStatus | FollowUpStatus[]
): Promise<AccountFollowUp[]> {
  let query = supabase
    .from('account_follow_ups')
    .select('*')
    .eq('prospect_id', prospectId)
    .order('priority', { ascending: true }) // high, low, medium alphabetically - we'll sort in JS
    .order('created_at', { ascending: false });

  if (status) {
    if (Array.isArray(status)) {
      query = query.in('status', status);
    } else {
      query = query.eq('status', status);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching follow-ups:', error);
    throw error;
  }

  // Sort by priority (high first, then medium, then low)
  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };
  return (data || []).sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority as FollowUpPriority] - priorityOrder[b.priority as FollowUpPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) as AccountFollowUp[];
}

/**
 * Complete a follow-up
 */
export async function completeFollowUp(followUpId: string): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    console.error('Error completing follow-up:', error);
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Reopen a completed follow-up
 */
export async function reopenFollowUp(followUpId: string): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .update({
      status: 'pending',
      completed_at: null
    })
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    console.error('Error reopening follow-up:', error);
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Dismiss a follow-up (mark as not applicable)
 */
export async function dismissFollowUp(followUpId: string): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .update({
      status: 'dismissed'
    })
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    console.error('Error dismissing follow-up:', error);
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Trigger regeneration of follow-ups for a prospect
 */
export async function refreshFollowUps(prospectId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke('generate-account-follow-ups', {
    body: { prospect_id: prospectId }
  });

  if (error) {
    console.error('Error refreshing follow-ups:', error);
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Get the generation status for a prospect's follow-ups
 */
export async function getFollowUpGenerationStatus(prospectId: string): Promise<{
  status: string | null;
  lastGeneratedAt: string | null;
}> {
  const { data, error } = await supabase
    .from('prospects')
    .select('follow_ups_generation_status, follow_ups_last_generated_at')
    .eq('id', prospectId)
    .single();

  if (error) {
    console.error('Error fetching generation status:', error);
    throw error;
  }

  return {
    status: data?.follow_ups_generation_status || null,
    lastGeneratedAt: data?.follow_ups_last_generated_at || null
  };
}
