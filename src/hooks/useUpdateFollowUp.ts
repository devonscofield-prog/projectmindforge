import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateFollowUp, type UpdateFollowUpParams } from '@/api/accountFollowUps';

/**
 * Hook for updating a follow-up with cache invalidation
 */
export function useUpdateFollowUp() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: UpdateFollowUpParams }) =>
      updateFollowUp(id, fields),

    onSuccess: () => {
      toast.success('Task updated');
    },

    onError: () => {
      toast.error('Failed to update task');
    },

    onSettled: () => {
      // Invalidate all follow-up queries
      queryClient.invalidateQueries({ queryKey: ['follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['manual-follow-ups'] });
      queryClient.invalidateQueries({ queryKey: ['rep-tasks'] });
    },
  });
}
