import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Team {
  id: string;
  name: string;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamBasic {
  id: string;
  name: string;
}

/**
 * Fetch all teams (basic info: id and name only)
 */
export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return (data || []) as TeamBasic[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetch all teams with full details
 */
export function useTeamsFull() {
  return useQuery({
    queryKey: ['teams-full'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as Team[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch a single team by ID
 */
export function useTeam(teamId: string | null | undefined) {
  return useQuery({
    queryKey: ['team', teamId],
    queryFn: async () => {
      if (!teamId) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .maybeSingle();
      if (error) throw error;
      return data as Team | null;
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Fetch teams managed by a specific manager
 */
export function useManagerTeams(managerId: string | null | undefined) {
  return useQuery({
    queryKey: ['manager-teams', managerId],
    queryFn: async () => {
      if (!managerId) return [];
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('manager_id', managerId)
        .order('name');
      if (error) throw error;
      return (data || []) as TeamBasic[];
    },
    enabled: !!managerId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Get team member counts
 */
export function useTeamMemberCounts() {
  return useQuery({
    queryKey: ['team-member-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('team_id')
        .not('team_id', 'is', null);
      if (error) throw error;
      
      const counts = new Map<string, number>();
      (data || []).forEach(p => {
        if (p.team_id) {
          counts.set(p.team_id, (counts.get(p.team_id) || 0) + 1);
        }
      });
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });
}
