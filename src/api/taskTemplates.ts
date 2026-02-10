import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { createManualFollowUps, type CreateManualFollowUpParams } from '@/api/accountFollowUps';
import { addDays, format } from 'date-fns';

const log = createLogger('taskTemplates');

export interface TaskTemplate {
  id: string;
  rep_id: string;
  title: string;
  description: string | null;
  priority: string;
  category: string | null;
  due_days_offset: number | null;
  reminder_enabled: boolean;
  reminder_time: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskTemplateParams {
  title: string;
  description?: string;
  priority?: string;
  category?: string;
  due_days_offset?: number | null;
  reminder_enabled?: boolean;
  reminder_time?: string;
  sequenceId?: string;
}

export interface TaskTemplateSettings {
  rep_id: string;
  auto_create_enabled: boolean;
  updated_at: string;
}

// --- Template CRUD ---

export async function fetchTaskTemplates(repId: string): Promise<TaskTemplate[]> {
  const { data, error } = await supabase
    .from('rep_task_templates')
    .select('*')
    .eq('rep_id', repId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Error fetching task templates', { repId, error });
    throw error;
  }

  return (data || []) as TaskTemplate[];
}

export async function createTaskTemplate(repId: string, params: CreateTaskTemplateParams): Promise<TaskTemplate> {
  // Get max sort_order for this rep
  const { data: existing } = await supabase
    .from('rep_task_templates')
    .select('sort_order')
    .eq('rep_id', repId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('rep_task_templates')
    .insert({
      rep_id: repId,
      title: params.title,
      description: params.description || null,
      priority: params.priority || 'medium',
      category: params.category || null,
      due_days_offset: params.due_days_offset ?? null,
      reminder_enabled: params.reminder_enabled ?? false,
      reminder_time: params.reminder_time || null,
      sort_order: nextOrder,
      sequence_id: params.sequenceId || null,
    })
    .select()
    .single();

  if (error) {
    log.error('Error creating task template', { repId, error });
    throw error;
  }

  return data as TaskTemplate;
}

export async function updateTaskTemplate(id: string, params: Partial<CreateTaskTemplateParams & { is_active?: boolean }>): Promise<TaskTemplate> {
  const updateData: Record<string, unknown> = {};
  if (params.title !== undefined) updateData.title = params.title;
  if (params.description !== undefined) updateData.description = params.description || null;
  if (params.priority !== undefined) updateData.priority = params.priority;
  if (params.category !== undefined) updateData.category = params.category || null;
  if (params.due_days_offset !== undefined) updateData.due_days_offset = params.due_days_offset;
  if (params.reminder_enabled !== undefined) updateData.reminder_enabled = params.reminder_enabled;
  if (params.reminder_time !== undefined) updateData.reminder_time = params.reminder_time || null;
  if (params.is_active !== undefined) updateData.is_active = params.is_active;

  const { data, error } = await supabase
    .from('rep_task_templates')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    log.error('Error updating task template', { id, error });
    throw error;
  }

  return data as TaskTemplate;
}

export async function deleteTaskTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from('rep_task_templates')
    .delete()
    .eq('id', id);

  if (error) {
    log.error('Error deleting task template', { id, error });
    throw error;
  }
}

// --- Settings ---

export async function getAutoCreateSetting(repId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('rep_task_template_settings')
    .select('auto_create_enabled')
    .eq('rep_id', repId)
    .maybeSingle();

  if (error) {
    log.error('Error fetching auto-create setting', { repId, error });
    throw error;
  }

  // Default to false — auto-create is opt-in
  return data?.auto_create_enabled ?? false;
}

export async function setAutoCreateSetting(repId: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from('rep_task_template_settings')
    .upsert(
      { rep_id: repId, auto_create_enabled: enabled },
      { onConflict: 'rep_id' }
    );

  if (error) {
    log.error('Error setting auto-create', { repId, error });
    throw error;
  }
}

// --- Reorder ---

export async function reorderTaskTemplates(updates: { id: string; sort_order: number }[]): Promise<void> {
  // Batch update sort_order for each template
  const promises = updates.map(({ id, sort_order }) =>
    supabase
      .from('rep_task_templates')
      .update({ sort_order })
      .eq('id', id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  if (error) {
    log.error('Error reordering templates', { error });
    throw error;
  }
}

// --- Apply Templates (called during call submission) ---

export async function applyTaskTemplates(
  repId: string,
  prospectId: string,
  callId: string,
  callDate: string
): Promise<void> {
  // Check if auto-create is enabled
  const enabled = await getAutoCreateSetting(repId);
  if (!enabled) {
    log.debug('Auto-create disabled, skipping templates', { repId });
    return;
  }

  // Fetch active templates
  const templates = await fetchTaskTemplates(repId);
  const activeTemplates = templates.filter(t => t.is_active);

  if (activeTemplates.length === 0) {
    log.debug('No active templates', { repId });
    return;
  }

  // Build follow-up params from templates
  const callDateObj = new Date(callDate);
  const tasks: CreateManualFollowUpParams[] = activeTemplates.map(t => ({
    prospectId,
    repId,
    title: t.title,
    description: t.description || undefined,
    priority: (t.priority as 'high' | 'medium' | 'low') || 'medium',
    category: (t.category as 'phone_call' | 'drip_email' | 'text_message' | 'follow_up_email') || undefined,
    dueDate: t.due_days_offset != null
      ? format(addDays(callDateObj, t.due_days_offset), 'yyyy-MM-dd')
      : undefined,
    reminderEnabled: t.reminder_enabled,
    reminderTime: t.reminder_time || undefined,
    sourceCallId: callId,
  }));

  const created = await createManualFollowUps(tasks);
  log.info('Auto-created tasks from templates', { repId, count: created.length });
}
