import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('followUps');

export type FollowUpStatus = 'pending' | 'completed' | 'dismissed';
export type FollowUpPriority = 'high' | 'medium' | 'low';
export type FollowUpCategory = 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
export type FollowUpSource = 'ai' | 'manual';

export interface AccountFollowUp {
  id: string;
  prospect_id: string;
  rep_id: string;
  title: string;
  description: string | null;
  priority: FollowUpPriority | string | null;
  category: FollowUpCategory | string | null;
  status: FollowUpStatus | string | null;
  completed_at: string | null;
  generated_from_call_ids: string[] | null;
  ai_reasoning: string | null;
  source: FollowUpSource | string | null;
  due_date: string | null;
  reminder_enabled: boolean | null;
  reminder_sent_at: string | null;
  source_call_id: string | null;
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
    log.error('Error fetching follow-ups', { prospectId, error });
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
    log.error('Error completing follow-up', { followUpId, error });
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
    log.error('Error reopening follow-up', { followUpId, error });
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
    log.error('Error dismissing follow-up', { followUpId, error });
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Restore a dismissed follow-up back to pending
 */
export async function restoreFollowUp(followUpId: string): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .update({
      status: 'pending'
    })
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    log.error('Error restoring follow-up', { followUpId, error });
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Trigger regeneration of follow-ups for a prospect
 */
export async function refreshFollowUps(prospectId: string): Promise<{ success: boolean; count?: number; error?: string; isRateLimited?: boolean }> {
  const { data, error } = await supabase.functions.invoke('generate-account-follow-ups', {
    body: { prospect_id: prospectId }
  });

  if (error) {
    log.error('Error refreshing follow-ups', { prospectId, error });
    // Check for rate limit in error message
    const isRateLimited = error.message?.toLowerCase().includes('rate limit') || 
                          error.message?.includes('429');
    return { success: false, error: error.message, isRateLimited };
  }

  // Check if the response itself indicates rate limiting
  if (data?.error?.toLowerCase().includes('rate limit')) {
    return { success: false, error: data.error, isRateLimited: true };
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
    log.error('Error fetching generation status', { prospectId, error });
    throw error;
  }

  return {
    status: data?.follow_ups_generation_status || null,
    lastGeneratedAt: data?.follow_ups_last_generated_at || null
  };
}

export interface AccountFollowUpWithProspect extends AccountFollowUp {
  prospect_name?: string;
  account_name?: string;
}

/**
 * List all pending follow-ups for a rep across all accounts
 */
export async function listAllPendingFollowUpsForRep(repId: string): Promise<AccountFollowUpWithProspect[]> {
  // Get all pending follow-ups
  const { data: followUps, error } = await supabase
    .from('account_follow_ups')
    .select('*')
    .eq('rep_id', repId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Error fetching all follow-ups', { repId, error });
    throw error;
  }

  if (!followUps || followUps.length === 0) {
    return [];
  }

  // Get unique prospect IDs
  const prospectIds = [...new Set(followUps.map(f => f.prospect_id))];

  // Fetch prospect details
  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, prospect_name, account_name')
    .in('id', prospectIds);

  const prospectMap = (prospects || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { prospect_name: string; account_name: string | null }>);

  // Sort by priority (high first, then medium, then low), then by due date
  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };
  
  return followUps.map(f => ({
    ...f,
    prospect_name: prospectMap[f.prospect_id]?.prospect_name,
    account_name: prospectMap[f.prospect_id]?.account_name || undefined,
  })).sort((a, b) => {
    // First sort by due date (overdue first, then upcoming, then no date)
    const aHasDue = !!a.due_date;
    const bHasDue = !!b.due_date;
    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;
    if (aHasDue && bHasDue) {
      const dateDiff = new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
      if (dateDiff !== 0) return dateDiff;
    }
    // Then by priority
    const priorityDiff = priorityOrder[a.priority as FollowUpPriority] - priorityOrder[b.priority as FollowUpPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) as AccountFollowUpWithProspect[];
}

/**
 * Create a manual follow-up task
 */
export interface CreateManualFollowUpParams {
  prospectId: string;
  repId: string;
  title: string;
  description?: string;
  priority?: FollowUpPriority;
  category?: FollowUpCategory;
  dueDate?: string;
  reminderEnabled?: boolean;
  sourceCallId?: string;
}

export async function createManualFollowUp(params: CreateManualFollowUpParams): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .insert({
      prospect_id: params.prospectId,
      rep_id: params.repId,
      title: params.title,
      description: params.description || null,
      priority: params.priority || 'medium',
      category: params.category || null,
      source: 'manual',
      due_date: params.dueDate || null,
      reminder_enabled: params.reminderEnabled || false,
      source_call_id: params.sourceCallId || null,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    log.error('Error creating manual follow-up', { params, error });
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * Create multiple manual follow-up tasks at once
 */
export async function createManualFollowUps(tasks: CreateManualFollowUpParams[]): Promise<AccountFollowUp[]> {
  if (tasks.length === 0) return [];
  
  const inserts = tasks.map(params => ({
    prospect_id: params.prospectId,
    rep_id: params.repId,
    title: params.title,
    description: params.description || null,
    priority: params.priority || 'medium',
    category: params.category || null,
    source: 'manual' as const,
    due_date: params.dueDate || null,
    reminder_enabled: params.reminderEnabled || false,
    source_call_id: params.sourceCallId || null,
    status: 'pending' as const,
  }));

  const { data, error } = await supabase
    .from('account_follow_ups')
    .insert(inserts)
    .select();

  if (error) {
    log.error('Error creating manual follow-ups', { count: tasks.length, error });
    throw error;
  }

  return (data || []) as AccountFollowUp[];
}

/**
 * Update due date and reminder settings for a follow-up
 */
export async function updateFollowUpReminder(
  followUpId: string,
  dueDate: string | null,
  reminderEnabled: boolean
): Promise<AccountFollowUp> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .update({
      due_date: dueDate,
      reminder_enabled: reminderEnabled,
      reminder_sent_at: null, // Reset when reminder settings change
    })
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    log.error('Error updating follow-up reminder', { followUpId, error });
    throw error;
  }

  return data as AccountFollowUp;
}
