import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RepBasic {
  id: string;
  name: string;
  team_id: string | null;
}

export interface RepWithEmail extends RepBasic {
  email: string;
}

export interface RepFull {
  id: string;
  name: string;
  email: string;
  team_id: string | null;
  is_active: boolean;
  hire_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

interface UseRepsOptions {
  teamId?: string | null;
  activeOnly?: boolean;
}

/**
 * Fetch all reps (basic info)
 */
export function useReps(options: UseRepsOptions = {}): UseQueryResult<RepBasic[], Error> {
  const { teamId, activeOnly = true } = options;
  
  return useQuery({
    queryKey: ['reps', teamId || 'all', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('user_with_role')
        .select('id, name, team_id')
        .eq('role', 'rep');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      if (teamId && teamId !== 'all') {
        query = query.eq('team_id', teamId);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as RepBasic[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch all reps with email
 */
export function useRepsWithEmail(options: UseRepsOptions = {}): UseQueryResult<RepWithEmail[], Error> {
  const { teamId, activeOnly = true } = options;
  
  return useQuery({
    queryKey: ['reps-with-email', teamId || 'all', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('user_with_role')
        .select('id, name, email, team_id')
        .eq('role', 'rep');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      if (teamId && teamId !== 'all') {
        query = query.eq('team_id', teamId);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return (data || []) as RepWithEmail[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch rep count
 */
export function useRepCount(options: UseRepsOptions = {}): UseQueryResult<number, Error> {
  const { teamId, activeOnly = true } = options;
  
  return useQuery({
    queryKey: ['rep-count', teamId || 'all', activeOnly],
    queryFn: async () => {
      let query = supabase
        .from('user_with_role')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'rep');
      
      if (activeOnly) {
        query = query.eq('is_active', true);
      }
      
      if (teamId && teamId !== 'all') {
        query = query.eq('team_id', teamId);
      }
      
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch reps in a team (by team ID)
 */
export function useTeamReps(teamId: string | null | undefined): UseQueryResult<RepBasic[], Error> {
  return useQuery({
    queryKey: ['team-reps', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .eq('team_id', teamId)
        .order('name');
      if (error) throw error;
      return (data || []) as RepBasic[];
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch rep IDs for a team (useful for filtering)
 */
export function useTeamRepIds(teamId: string | null | undefined): UseQueryResult<string[], Error> {
  return useQuery({
    queryKey: ['team-rep-ids', teamId],
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', teamId);
      if (error) throw error;
      return (data || []).map(r => r.id);
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}
