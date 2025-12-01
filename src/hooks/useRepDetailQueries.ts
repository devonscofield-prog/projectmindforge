import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toProfile, toCoachingSession } from '@/lib/supabaseAdapters';
import { Profile, CoachingSession } from '@/types/database';
import { createLogger } from '@/lib/logger';

const log = createLogger('repDetailQueries');

/**
 * Query keys for rep detail data
 */
export const repDetailKeys = {
  all: ['repDetail'] as const,
  profile: (repId: string) => [...repDetailKeys.all, 'profile', repId] as const,
  coaching: (repId: string) => [...repDetailKeys.all, 'coaching', repId] as const,
};

/**
 * Fetch a specific rep's profile
 */
export function useRepProfile(repId: string | undefined) {
  return useQuery({
    queryKey: repDetailKeys.profile(repId || ''),
    queryFn: async () => {
      log.info('Fetching rep profile', { repId });
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', repId!)
        .maybeSingle();

      if (error) {
        log.error('Failed to fetch rep profile', { error, repId });
        throw error;
      }

      return data ? toProfile(data) : null;
    },
    enabled: !!repId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch coaching sessions for a specific rep
 */
export function useCoachingSessions(repId: string | undefined) {
  return useQuery({
    queryKey: repDetailKeys.coaching(repId || ''),
    queryFn: async () => {
      log.info('Fetching coaching sessions', { repId });
      
      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('rep_id', repId!)
        .order('session_date', { ascending: false });

      if (error) {
        log.error('Failed to fetch coaching sessions', { error, repId });
        throw error;
      }

      return data ? data.map(toCoachingSession) : [];
    },
    enabled: !!repId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Mutation to create a new coaching session
 */
export function useCreateCoachingSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      rep_id: string;
      manager_id: string;
      session_date: string;
      focus_area: string;
      notes: string | null;
      action_items: string | null;
      follow_up_date: string | null;
    }) => {
      log.info('Creating coaching session', { repId: params.rep_id });
      
      const { data, error } = await supabase
        .from('coaching_sessions')
        .insert(params)
        .select()
        .single();

      if (error) {
        log.error('Failed to create coaching session', { error });
        throw error;
      }

      return toCoachingSession(data);
    },
    onSuccess: (_, variables) => {
      // Invalidate coaching sessions for this rep
      queryClient.invalidateQueries({ 
        queryKey: repDetailKeys.coaching(variables.rep_id) 
      });
      
      log.info('Coaching session created successfully');
    },
  });
}
