import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  reorderTaskTemplates,
  getAutoCreateSetting,
  setAutoCreateSetting,
  type CreateTaskTemplateParams,
  type TaskTemplate,
} from '@/api/taskTemplates';
import { toast } from 'sonner';

export function useTaskTemplates() {
  const { user } = useAuth();
  const repId = user?.id || '';

  return useQuery({
    queryKey: ['task-templates', repId],
    queryFn: () => fetchTaskTemplates(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });
}

export function useAutoCreateSetting() {
  const { user } = useAuth();
  const repId = user?.id || '';

  return useQuery({
    queryKey: ['task-template-settings', repId],
    queryFn: () => getAutoCreateSetting(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });
}

export function useToggleAutoCreate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (enabled: boolean) => setAutoCreateSetting(repId, enabled),
    onMutate: async (enabled) => {
      await qc.cancelQueries({ queryKey: ['task-template-settings', repId] });
      const prev = qc.getQueryData(['task-template-settings', repId]);
      qc.setQueryData(['task-template-settings', repId], enabled);
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['task-template-settings', repId], ctx?.prev);
      toast.error('Failed to update setting');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['task-template-settings', repId] }),
  });
}

export function useCreateTaskTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (params: CreateTaskTemplateParams) => createTaskTemplate(repId, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates', repId] });
      toast.success('Template added');
    },
    onError: () => toast.error('Failed to create template'),
  });
}

export function useUpdateTaskTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Partial<CreateTaskTemplateParams & { is_active?: boolean }> }) =>
      updateTaskTemplate(id, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates', repId] });
    },
    onError: () => toast.error('Failed to update template'),
  });
}

export function useDeleteTaskTemplate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (id: string) => deleteTaskTemplate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-templates', repId] });
      toast.success('Template removed');
    },
    onError: () => toast.error('Failed to delete template'),
  });
}

export function useReorderTaskTemplates() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => reorderTaskTemplates(updates),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['task-templates', repId] });
      const prev = qc.getQueryData<TaskTemplate[]>(['task-templates', repId]);
      if (prev) {
        const sorted = [...prev].map(t => {
          const update = updates.find(u => u.id === t.id);
          return update ? { ...t, sort_order: update.sort_order } : t;
        }).sort((a, b) => a.sort_order - b.sort_order);
        qc.setQueryData(['task-templates', repId], sorted);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['task-templates', repId], ctx?.prev);
      toast.error('Failed to reorder templates');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['task-templates', repId] }),
  });
}
