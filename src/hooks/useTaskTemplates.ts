import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTaskTemplates,
  createTaskTemplate,
  updateTaskTemplate,
  deleteTaskTemplate,
  getAutoCreateSetting,
  setAutoCreateSetting,
  type CreateTaskTemplateParams,
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
