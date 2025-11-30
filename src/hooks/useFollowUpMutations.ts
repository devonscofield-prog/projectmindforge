import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  AccountFollowUp,
  AccountFollowUpWithProspect,
  completeFollowUp,
  reopenFollowUp,
  dismissFollowUp,
  restoreFollowUp,
} from '@/api/accountFollowUps';

interface OptimisticContext {
  previousFollowUps?: AccountFollowUp[];
  previousAllFollowUps?: AccountFollowUpWithProspect[];
}

/**
 * Hook for completing a follow-up with optimistic update
 */
export function useCompleteFollowUp(prospectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: completeFollowUp,
    
    onMutate: async (followUpId: string): Promise<OptimisticContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['follow-ups', prospectId] });
      await queryClient.cancelQueries({ queryKey: ['all-follow-ups'] });

      // Snapshot previous values
      const previousFollowUps = queryClient.getQueryData<AccountFollowUp[]>(
        ['follow-ups', prospectId, 'pending']
      );
      const previousAllFollowUps = queryClient.getQueryData<AccountFollowUpWithProspect[]>(
        ['all-follow-ups']
      );

      // Optimistically update pending list - remove completed item
      if (previousFollowUps) {
        queryClient.setQueryData<AccountFollowUp[]>(
          ['follow-ups', prospectId, 'pending'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      // Update all follow-ups list
      if (previousAllFollowUps) {
        queryClient.setQueryData<AccountFollowUpWithProspect[]>(
          ['all-follow-ups'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      return { previousFollowUps, previousAllFollowUps };
    },

    onError: (_err, _followUpId, context) => {
      // Rollback on error
      if (context?.previousFollowUps) {
        queryClient.setQueryData(
          ['follow-ups', prospectId, 'pending'],
          context.previousFollowUps
        );
      }
      if (context?.previousAllFollowUps) {
        queryClient.setQueryData(['all-follow-ups'], context.previousAllFollowUps);
      }
      toast.error('Failed to complete follow-up');
    },

    onSuccess: () => {
      toast.success('Follow-up completed');
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['follow-ups', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
    },
  });
}

/**
 * Hook for reopening a follow-up with optimistic update
 */
export function useReopenFollowUp(prospectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: reopenFollowUp,

    onMutate: async (followUpId: string): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: ['follow-ups', prospectId] });

      const previousFollowUps = queryClient.getQueryData<AccountFollowUp[]>(
        ['follow-ups', prospectId, 'completed']
      );

      // Optimistically remove from completed list
      if (previousFollowUps) {
        queryClient.setQueryData<AccountFollowUp[]>(
          ['follow-ups', prospectId, 'completed'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      return { previousFollowUps };
    },

    onError: (_err, _followUpId, context) => {
      if (context?.previousFollowUps) {
        queryClient.setQueryData(
          ['follow-ups', prospectId, 'completed'],
          context.previousFollowUps
        );
      }
      toast.error('Failed to reopen follow-up');
    },

    onSuccess: () => {
      toast.success('Follow-up reopened');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
    },
  });
}

/**
 * Hook for dismissing a follow-up with optimistic update
 */
export function useDismissFollowUp(prospectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: dismissFollowUp,

    onMutate: async (followUpId: string): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: ['follow-ups', prospectId] });
      await queryClient.cancelQueries({ queryKey: ['all-follow-ups'] });

      const previousFollowUps = queryClient.getQueryData<AccountFollowUp[]>(
        ['follow-ups', prospectId, 'pending']
      );
      const previousAllFollowUps = queryClient.getQueryData<AccountFollowUpWithProspect[]>(
        ['all-follow-ups']
      );

      // Optimistically remove from pending
      if (previousFollowUps) {
        queryClient.setQueryData<AccountFollowUp[]>(
          ['follow-ups', prospectId, 'pending'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      if (previousAllFollowUps) {
        queryClient.setQueryData<AccountFollowUpWithProspect[]>(
          ['all-follow-ups'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      return { previousFollowUps, previousAllFollowUps };
    },

    onError: (_err, _followUpId, context) => {
      if (context?.previousFollowUps) {
        queryClient.setQueryData(
          ['follow-ups', prospectId, 'pending'],
          context.previousFollowUps
        );
      }
      if (context?.previousAllFollowUps) {
        queryClient.setQueryData(['all-follow-ups'], context.previousAllFollowUps);
      }
      toast.error('Failed to dismiss follow-up');
    },

    onSuccess: () => {
      toast.success('Follow-up dismissed');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
    },
  });
}

/**
 * Hook for restoring a dismissed follow-up with optimistic update
 */
export function useRestoreFollowUp(prospectId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: restoreFollowUp,

    onMutate: async (followUpId: string): Promise<OptimisticContext> => {
      await queryClient.cancelQueries({ queryKey: ['follow-ups', prospectId] });

      const previousFollowUps = queryClient.getQueryData<AccountFollowUp[]>(
        ['follow-ups', prospectId, 'dismissed']
      );

      // Optimistically remove from dismissed list
      if (previousFollowUps) {
        queryClient.setQueryData<AccountFollowUp[]>(
          ['follow-ups', prospectId, 'dismissed'],
          (old) => old?.filter((f) => f.id !== followUpId) ?? []
        );
      }

      return { previousFollowUps };
    },

    onError: (_err, _followUpId, context) => {
      if (context?.previousFollowUps) {
        queryClient.setQueryData(
          ['follow-ups', prospectId, 'dismissed'],
          context.previousFollowUps
        );
      }
      toast.error('Failed to restore follow-up');
    },

    onSuccess: () => {
      toast.success('Follow-up restored');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['follow-ups', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['all-follow-ups'] });
    },
  });
}
