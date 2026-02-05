import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('followUps');

export type FollowUpStatus = 'pending' | 'completed' | 'dismissed';
export type FollowUpPriority = 'high' | 'medium' | 'low';
export type FollowUpCategory = 'phone_call' | 'drip_email' | 'text_message' | 'follow_up_email';
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
  reminder_time: string | null;
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
    .order('priority', { ascending: true })
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

  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };
  return (data || []).sort((a, b) => {
    const priorityDiff = priorityOrder[a.priority as FollowUpPriority] - priorityOrder[b.priority as FollowUpPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) as AccountFollowUp[];
}

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

export async function refreshFollowUps(prospectId: string): Promise<{ success: boolean; count?: number; error?: string; isRateLimited?: boolean }> {
  const { data, error } = await supabase.functions.invoke('generate-account-follow-ups', {
    body: { prospect_id: prospectId }
  });

  if (error) {
    log.error('Error refreshing follow-ups', { prospectId, error });
    const isRateLimited = error.message?.toLowerCase().includes('rate limit') || 
                          error.message?.includes('429');
    return { success: false, error: error.message, isRateLimited };
  }

  if (data?.error?.toLowerCase().includes('rate limit')) {
    return { success: false, error: data.error, isRateLimited: true };
  }

  return data;
}

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

  const prospectIds = [...new Set(followUps.map(f => f.prospect_id))];

  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, prospect_name, account_name')
    .in('id', prospectIds);

  const prospectMap = (prospects || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { prospect_name: string; account_name: string | null }>);

  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };
  
  return followUps.map(f => ({
    ...f,
    prospect_name: prospectMap[f.prospect_id]?.prospect_name,
    account_name: prospectMap[f.prospect_id]?.account_name || undefined,
  })).sort((a, b) => {
    const aHasDue = !!a.due_date;
    const bHasDue = !!b.due_date;
    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;
    if (aHasDue && bHasDue) {
      const dateDiff = new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
      if (dateDiff !== 0) return dateDiff;
    }
    const priorityDiff = priorityOrder[a.priority as FollowUpPriority] - priorityOrder[b.priority as FollowUpPriority];
    if (priorityDiff !== 0) return priorityDiff;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }) as AccountFollowUpWithProspect[];
}

/**
 * List pending follow-ups that the rep manually created (not AI-generated)
 */
export async function listManualPendingFollowUpsForRep(repId: string): Promise<AccountFollowUpWithProspect[]> {
  const { data: followUps, error } = await supabase
    .from('account_follow_ups')
    .select('*')
    .eq('rep_id', repId)
    .eq('status', 'pending')
    .eq('source', 'manual')
    .order('created_at', { ascending: false });

  if (error) {
    log.error('Error fetching manual follow-ups', { repId, error });
    throw error;
  }

  if (!followUps || followUps.length === 0) {
    return [];
  }

  const prospectIds = [...new Set(followUps.map(f => f.prospect_id))];

  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, prospect_name, account_name')
    .in('id', prospectIds);

  const prospectMap = (prospects || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { prospect_name: string; account_name: string | null }>);

  const priorityOrder: Record<FollowUpPriority, number> = { high: 0, medium: 1, low: 2 };
  
  return followUps.map(f => ({
    ...f,
    prospect_name: prospectMap[f.prospect_id]?.prospect_name,
    account_name: prospectMap[f.prospect_id]?.account_name || undefined,
  })).sort((a, b) => {
    const aHasDue = !!a.due_date;
    const bHasDue = !!b.due_date;
    if (aHasDue && !bHasDue) return -1;
    if (!aHasDue && bHasDue) return 1;
    if (aHasDue && bHasDue) {
      const dateDiff = new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime();
      if (dateDiff !== 0) return dateDiff;
    }
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
  reminderTime?: string;
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
      reminder_enabled: params.reminderEnabled ?? false,
      reminder_time: params.reminderTime || null,
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
    reminder_enabled: params.reminderEnabled ?? false,
    reminder_time: params.reminderTime || null,
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
      reminder_sent_at: null,
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

/**
 * General-purpose update for a follow-up task
 */
export interface UpdateFollowUpParams {
  title?: string;
  description?: string | null;
  priority?: FollowUpPriority;
  category?: FollowUpCategory | null;
  due_date?: string | null;
  reminder_enabled?: boolean;
  reminder_time?: string | null;
}

export async function updateFollowUp(followUpId: string, fields: UpdateFollowUpParams): Promise<AccountFollowUp> {
  const updateData: Record<string, unknown> = {};
  
  if (fields.title !== undefined) updateData.title = fields.title;
  if (fields.description !== undefined) updateData.description = fields.description;
  if (fields.priority !== undefined) updateData.priority = fields.priority;
  if (fields.category !== undefined) updateData.category = fields.category;
  if (fields.due_date !== undefined) updateData.due_date = fields.due_date;
  if (fields.reminder_enabled !== undefined) updateData.reminder_enabled = fields.reminder_enabled;
  if (fields.reminder_time !== undefined) updateData.reminder_time = fields.reminder_time;
  
  // Reset reminder_sent_at if reminder settings change
  if (fields.due_date !== undefined || fields.reminder_enabled !== undefined || fields.reminder_time !== undefined) {
    updateData.reminder_sent_at = null;
  }

  const { data, error } = await supabase
    .from('account_follow_ups')
    .update(updateData)
    .eq('id', followUpId)
    .select()
    .single();

  if (error) {
    log.error('Error updating follow-up', { followUpId, error });
    throw error;
  }

  return data as AccountFollowUp;
}

/**
 * List all follow-ups for a rep filtered by status, with prospect details joined
 */
export async function listAllFollowUpsForRepByStatus(
  repId: string, 
  status: FollowUpStatus
): Promise<AccountFollowUpWithProspect[]> {
  const { data: followUps, error } = await supabase
    .from('account_follow_ups')
    .select('*')
    .eq('rep_id', repId)
    .eq('status', status)
    .eq('source', 'manual')
    .order('updated_at', { ascending: false });

  if (error) {
    log.error('Error fetching follow-ups by status', { repId, status, error });
    throw error;
  }

  if (!followUps || followUps.length === 0) {
    return [];
  }

  const prospectIds = [...new Set(followUps.map(f => f.prospect_id))];

  const { data: prospects } = await supabase
    .from('prospects')
    .select('id, prospect_name, account_name')
    .in('id', prospectIds);

  const prospectMap = (prospects || []).reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, { prospect_name: string; account_name: string | null }>);

  return followUps.map(f => ({
    ...f,
    prospect_name: prospectMap[f.prospect_id]?.prospect_name,
    account_name: prospectMap[f.prospect_id]?.account_name || undefined,
  })) as AccountFollowUpWithProspect[];
}
