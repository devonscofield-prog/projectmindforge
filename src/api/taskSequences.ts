import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';

const log = createLogger('taskSequences');

export interface TaskSequence {
  id: string;
  rep_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  template_count?: number;
}

export interface CreateTaskSequenceParams {
  name: string;
  description?: string;
}

export async function fetchTaskSequences(repId: string): Promise<TaskSequence[]> {
  const { data, error } = await supabase
    .from('rep_task_sequences')
    .select('*, rep_task_templates(count)')
    .eq('rep_id', repId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    log.error('Error fetching task sequences', { repId, error });
    throw error;
  }

  return (data || []).map((row: any) => ({
    ...row,
    template_count: row.rep_task_templates?.[0]?.count ?? 0,
    rep_task_templates: undefined,
  })) as TaskSequence[];
}

export async function fetchActiveTaskSequences(repId: string): Promise<TaskSequence[]> {
  const { data, error } = await supabase
    .from('rep_task_sequences')
    .select('*')
    .eq('rep_id', repId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) {
    log.error('Error fetching active sequences', { repId, error });
    throw error;
  }

  return (data || []) as TaskSequence[];
}

export async function createTaskSequence(repId: string, params: CreateTaskSequenceParams): Promise<TaskSequence> {
  const { data: existing } = await supabase
    .from('rep_task_sequences')
    .select('sort_order')
    .eq('rep_id', repId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('rep_task_sequences')
    .insert({
      rep_id: repId,
      name: params.name,
      description: params.description || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    log.error('Error creating task sequence', { repId, error });
    throw error;
  }

  return data as TaskSequence;
}

export async function updateTaskSequence(
  id: string,
  params: Partial<CreateTaskSequenceParams & { is_active?: boolean }>
): Promise<TaskSequence> {
  const updateData: Record<string, unknown> = {};
  if (params.name !== undefined) updateData.name = params.name;
  if (params.description !== undefined) updateData.description = params.description || null;
  if (params.is_active !== undefined) updateData.is_active = params.is_active;

  const { data, error } = await supabase
    .from('rep_task_sequences')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    log.error('Error updating task sequence', { id, error });
    throw error;
  }

  return data as TaskSequence;
}

export async function deleteTaskSequence(id: string): Promise<void> {
  const { error } = await supabase
    .from('rep_task_sequences')
    .delete()
    .eq('id', id);

  if (error) {
    log.error('Error deleting task sequence', { id, error });
    throw error;
  }
}

export async function reorderTaskSequences(updates: { id: string; sort_order: number }[]): Promise<void> {
  const promises = updates.map(({ id, sort_order }) =>
    supabase.from('rep_task_sequences').update({ sort_order }).eq('id', id)
  );

  const results = await Promise.all(promises);
  const error = results.find(r => r.error)?.error;
  if (error) {
    log.error('Error reordering sequences', { error });
    throw error;
  }
}
