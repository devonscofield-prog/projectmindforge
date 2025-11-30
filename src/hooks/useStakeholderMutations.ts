import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

export interface Stakeholder {
  id: string;
  prospect_id: string;
  rep_id: string;
  name: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  influence_level: 'light_influencer' | 'heavy_influencer' | 'secondary_dm' | 'final_dm' | null;
  is_primary_contact: boolean | null;
  champion_score: number | null;
  champion_score_reasoning: string | null;
  last_interaction_date: string | null;
  ai_extracted_info: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface CreateStakeholderParams {
  prospectId: string;
  repId: string;
  name: string;
  jobTitle?: string;
  email?: string;
  phone?: string;
  influenceLevel?: Stakeholder['influence_level'];
  isPrimaryContact?: boolean;
}

interface UpdateStakeholderParams {
  stakeholderId: string;
  updates: Partial<Pick<Stakeholder, 'name' | 'job_title' | 'email' | 'phone' | 'influence_level' | 'is_primary_contact'>>;
}

interface OptimisticStakeholderContext {
  previousStakeholders?: Stakeholder[];
  previousStakeholder?: Stakeholder;
}

/**
 * Hook for creating a stakeholder with optimistic update
 */
export function useCreateStakeholder(prospectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateStakeholderParams): Promise<Stakeholder> => {
      const { data, error } = await supabase
        .from('stakeholders')
        .insert({
          prospect_id: params.prospectId,
          rep_id: params.repId,
          name: params.name,
          job_title: params.jobTitle || null,
          email: params.email || null,
          phone: params.phone || null,
          influence_level: params.influenceLevel || null,
          is_primary_contact: params.isPrimaryContact || false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Stakeholder;
    },

    onMutate: async (params): Promise<OptimisticStakeholderContext> => {
      await queryClient.cancelQueries({ queryKey: ['stakeholders', prospectId] });

      const previousStakeholders = queryClient.getQueryData<Stakeholder[]>([
        'stakeholders',
        prospectId,
      ]);

      // Create optimistic stakeholder
      const optimisticStakeholder: Stakeholder = {
        id: `temp-${Date.now()}`,
        prospect_id: params.prospectId,
        rep_id: params.repId,
        name: params.name,
        job_title: params.jobTitle || null,
        email: params.email || null,
        phone: params.phone || null,
        influence_level: params.influenceLevel || null,
        is_primary_contact: params.isPrimaryContact || null,
        champion_score: null,
        champion_score_reasoning: null,
        last_interaction_date: null,
        ai_extracted_info: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Stakeholder[]>(
        ['stakeholders', prospectId],
        (old) => [...(old || []), optimisticStakeholder]
      );

      return { previousStakeholders };
    },

    onError: (_err, _params, context) => {
      if (context?.previousStakeholders) {
        queryClient.setQueryData(
          ['stakeholders', prospectId],
          context.previousStakeholders
        );
      }
      toast.error('Failed to add stakeholder');
    },

    onSuccess: () => {
      toast.success('Stakeholder added');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['stakeholder-counts'] });
    },
  });
}

/**
 * Hook for updating a stakeholder with optimistic update
 */
export function useUpdateStakeholder(prospectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ stakeholderId, updates }: UpdateStakeholderParams): Promise<Stakeholder> => {
      const { data, error } = await supabase
        .from('stakeholders')
        .update(updates)
        .eq('id', stakeholderId)
        .select()
        .single();

      if (error) throw error;
      return data as Stakeholder;
    },

    onMutate: async ({ stakeholderId, updates }): Promise<OptimisticStakeholderContext> => {
      await queryClient.cancelQueries({ queryKey: ['stakeholders', prospectId] });
      await queryClient.cancelQueries({ queryKey: ['stakeholder', stakeholderId] });

      const previousStakeholders = queryClient.getQueryData<Stakeholder[]>([
        'stakeholders',
        prospectId,
      ]);

      const previousStakeholder = queryClient.getQueryData<Stakeholder>([
        'stakeholder',
        stakeholderId,
      ]);

      // Optimistically update in list
      if (previousStakeholders) {
        queryClient.setQueryData<Stakeholder[]>(
          ['stakeholders', prospectId],
          (old) =>
            old?.map((s) =>
              s.id === stakeholderId
                ? { ...s, ...updates, updated_at: new Date().toISOString() }
                : s
            ) ?? []
        );
      }

      // Optimistically update single
      if (previousStakeholder) {
        queryClient.setQueryData<Stakeholder>(['stakeholder', stakeholderId], {
          ...previousStakeholder,
          ...updates,
          updated_at: new Date().toISOString(),
        });
      }

      return { previousStakeholders, previousStakeholder };
    },

    onError: (_err, { stakeholderId }, context) => {
      if (context?.previousStakeholders) {
        queryClient.setQueryData(
          ['stakeholders', prospectId],
          context.previousStakeholders
        );
      }
      if (context?.previousStakeholder) {
        queryClient.setQueryData(
          ['stakeholder', stakeholderId],
          context.previousStakeholder
        );
      }
      toast.error('Failed to update stakeholder');
    },

    onSuccess: () => {
      toast.success('Stakeholder updated');
    },

    onSettled: (_data, _err, { stakeholderId }) => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['stakeholder', stakeholderId] });
    },
  });
}

/**
 * Hook for deleting a stakeholder with optimistic update
 */
export function useDeleteStakeholder(prospectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (stakeholderId: string): Promise<void> => {
      const { error } = await supabase
        .from('stakeholders')
        .delete()
        .eq('id', stakeholderId);

      if (error) throw error;
    },

    onMutate: async (stakeholderId): Promise<OptimisticStakeholderContext> => {
      await queryClient.cancelQueries({ queryKey: ['stakeholders', prospectId] });

      const previousStakeholders = queryClient.getQueryData<Stakeholder[]>([
        'stakeholders',
        prospectId,
      ]);

      // Optimistically remove
      if (previousStakeholders) {
        queryClient.setQueryData<Stakeholder[]>(
          ['stakeholders', prospectId],
          (old) => old?.filter((s) => s.id !== stakeholderId) ?? []
        );
      }

      return { previousStakeholders };
    },

    onError: (_err, _stakeholderId, context) => {
      if (context?.previousStakeholders) {
        queryClient.setQueryData(
          ['stakeholders', prospectId],
          context.previousStakeholders
        );
      }
      toast.error('Failed to delete stakeholder');
    },

    onSuccess: () => {
      toast.success('Stakeholder deleted');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['stakeholders', prospectId] });
      queryClient.invalidateQueries({ queryKey: ['stakeholder-counts'] });
    },
  });
}
