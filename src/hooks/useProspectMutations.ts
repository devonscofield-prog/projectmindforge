import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Prospect,
  ProspectStatus,
  ProspectIntel,
  updateProspect,
  createProspectActivity,
  ProspectActivity,
  ProspectActivityType,
} from '@/api/prospects';

interface UpdateProspectParams {
  prospectId: string;
  updates: {
    status?: ProspectStatus;
    potential_revenue?: number;
    salesforce_link?: string | null;
    industry?: string | null;
    ai_extracted_info?: ProspectIntel;
    suggested_follow_ups?: string[];
    heat_score?: number;
  };
}

interface OptimisticProspectContext {
  previousProspect?: Prospect;
  previousProspects?: Prospect[];
}

/**
 * Hook for updating a prospect with optimistic update
 */
export function useUpdateProspect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ prospectId, updates }: UpdateProspectParams) =>
      updateProspect(prospectId, updates),

    onMutate: async ({
      prospectId,
      updates,
    }: UpdateProspectParams): Promise<OptimisticProspectContext> => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['prospect', prospectId] });
      await queryClient.cancelQueries({ queryKey: ['prospects'] });

      // Snapshot previous values
      const previousProspect = queryClient.getQueryData<Prospect>([
        'prospect',
        prospectId,
      ]);

      // Optimistically update single prospect
      if (previousProspect) {
        queryClient.setQueryData<Prospect>(['prospect', prospectId], {
          ...previousProspect,
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }

      // Also update in any prospect lists
      queryClient.setQueriesData<Prospect[]>(
        { queryKey: ['prospects'], exact: false },
        (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === prospectId
              ? { ...p, ...updates, updated_at: new Date().toISOString() }
              : p
          );
        }
      );

      return { previousProspect };
    },

    onError: (err, { prospectId }, context) => {
      // Rollback on error
      if (context?.previousProspect) {
        queryClient.setQueryData(['prospect', prospectId], context.previousProspect);
      }
      toast.error('Failed to update account');
      console.error('Update prospect error:', err);
    },

    onSuccess: () => {
      toast.success('Account updated');
    },

    onSettled: (_data, _err, { prospectId }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

/**
 * Hook for updating prospect status with optimistic update
 */
export function useUpdateProspectStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      prospectId,
      status,
    }: {
      prospectId: string;
      status: ProspectStatus;
    }) => updateProspect(prospectId, { status }),

    onMutate: async ({
      prospectId,
      status,
    }): Promise<OptimisticProspectContext> => {
      await queryClient.cancelQueries({ queryKey: ['prospect', prospectId] });

      const previousProspect = queryClient.getQueryData<Prospect>([
        'prospect',
        prospectId,
      ]);

      if (previousProspect) {
        queryClient.setQueryData<Prospect>(['prospect', prospectId], {
          ...previousProspect,
          status,
          updated_at: new Date().toISOString(),
        });
      }

      // Update in lists
      queryClient.setQueriesData<Prospect[]>(
        { queryKey: ['prospects'], exact: false },
        (old) => {
          if (!old) return old;
          return old.map((p) =>
            p.id === prospectId
              ? { ...p, status, updated_at: new Date().toISOString() }
              : p
          );
        }
      );

      return { previousProspect };
    },

    onError: (_err, { prospectId }, context) => {
      if (context?.previousProspect) {
        queryClient.setQueryData(['prospect', prospectId], context.previousProspect);
      }
      toast.error('Failed to update status');
    },

    onSuccess: (_data, { status }) => {
      const statusLabel =
        status === 'active'
          ? 'Active'
          : status === 'won'
          ? 'Won'
          : status === 'lost'
          ? 'Lost'
          : 'Dormant';
      toast.success(`Status updated to ${statusLabel}`);
    },

    onSettled: (_data, _err, { prospectId }) => {
      queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
}

interface CreateActivityParams {
  prospectId: string;
  repId: string;
  activityType: ProspectActivityType;
  description?: string;
  activityDate?: string;
}

interface OptimisticActivityContext {
  previousActivities?: ProspectActivity[];
}

/**
 * Hook for creating a prospect activity with optimistic update
 */
export function useCreateProspectActivity(prospectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: CreateActivityParams) => createProspectActivity(params),

    onMutate: async (params): Promise<OptimisticActivityContext> => {
      await queryClient.cancelQueries({
        queryKey: ['prospect-activities', prospectId],
      });

      const previousActivities = queryClient.getQueryData<ProspectActivity[]>([
        'prospect-activities',
        prospectId,
      ]);

      // Create optimistic activity
      const optimisticActivity: ProspectActivity = {
        id: `temp-${Date.now()}`,
        prospect_id: params.prospectId,
        rep_id: params.repId,
        activity_type: params.activityType,
        description: params.description || null,
        activity_date: params.activityDate || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<ProspectActivity[]>(
        ['prospect-activities', prospectId],
        (old) => [optimisticActivity, ...(old || [])]
      );

      return { previousActivities };
    },

    onError: (_err, _params, context) => {
      if (context?.previousActivities) {
        queryClient.setQueryData(
          ['prospect-activities', prospectId],
          context.previousActivities
        );
      }
      toast.error('Failed to log activity');
    },

    onSuccess: () => {
      toast.success('Activity logged');
    },

    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: ['prospect-activities', prospectId],
      });
      queryClient.invalidateQueries({ queryKey: ['prospect', prospectId] });
    },
  });
}
