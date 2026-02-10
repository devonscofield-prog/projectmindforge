import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchTaskSequences,
  fetchActiveTaskSequences,
  createTaskSequence,
  updateTaskSequence,
  deleteTaskSequence,
  reorderTaskSequences,
  type CreateTaskSequenceParams,
  type TaskSequence,
} from '@/api/taskSequences';
import { toast } from 'sonner';

export function useTaskSequences() {
  const { user } = useAuth();
  const repId = user?.id || '';

  return useQuery({
    queryKey: ['task-sequences', repId],
    queryFn: () => fetchTaskSequences(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });
}

export function useActiveTaskSequences() {
  const { user } = useAuth();
  const repId = user?.id || '';

  return useQuery({
    queryKey: ['task-sequences-active', repId],
    queryFn: () => fetchActiveTaskSequences(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });
}

export function useCreateTaskSequence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (params: CreateTaskSequenceParams) => createTaskSequence(repId, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-sequences', repId] });
      toast.success('Sequence created');
    },
    onError: () => toast.error('Failed to create sequence'),
  });
}

export function useUpdateTaskSequence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: ({ id, params }: { id: string; params: Partial<CreateTaskSequenceParams & { is_active?: boolean }> }) =>
      updateTaskSequence(id, params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-sequences', repId] });
    },
    onError: () => toast.error('Failed to update sequence'),
  });
}

export function useDeleteTaskSequence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (id: string) => deleteTaskSequence(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task-sequences', repId] });
      qc.invalidateQueries({ queryKey: ['task-templates', repId] });
      toast.success('Sequence deleted');
    },
    onError: () => toast.error('Failed to delete sequence'),
  });
}

export function useReorderTaskSequences() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const repId = user?.id || '';

  return useMutation({
    mutationFn: (updates: { id: string; sort_order: number }[]) => reorderTaskSequences(updates),
    onMutate: async (updates) => {
      await qc.cancelQueries({ queryKey: ['task-sequences', repId] });
      const prev = qc.getQueryData<TaskSequence[]>(['task-sequences', repId]);
      if (prev) {
        const sorted = [...prev].map(s => {
          const update = updates.find(u => u.id === s.id);
          return update ? { ...s, sort_order: update.sort_order } : s;
        }).sort((a, b) => a.sort_order - b.sort_order);
        qc.setQueryData(['task-sequences', repId], sorted);
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      qc.setQueryData(['task-sequences', repId], ctx?.prev);
      toast.error('Failed to reorder sequences');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['task-sequences', repId] }),
  });
}
