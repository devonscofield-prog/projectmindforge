import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toProfile, toTeam } from '@/lib/supabaseAdapters';
import type { Profile, Team } from '@/types/database';

const log = createLogger('useAdminTeamsQueries');

export interface TeamWithManager extends Team {
  manager?: Profile;
  memberCount: number;
}

export interface ManagerOption {
  id: string;
  name: string;
}

/**
 * Query keys for admin teams cache management
 */
export const adminTeamsKeys = {
  all: ['admin-teams'] as const,
  teams: () => [...adminTeamsKeys.all, 'teams'] as const,
  managers: () => [...adminTeamsKeys.all, 'managers'] as const,
};

/**
 * Fetches all teams with their manager info and member counts
 */
export function useAdminTeams(): UseQueryResult<TeamWithManager[], Error> {
  return useQuery({
    queryKey: adminTeamsKeys.teams(),
    queryFn: async () => {
      // Fetch all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) {
        log.error('Failed to fetch teams', { error: teamsError });
        throw new Error(`Failed to fetch teams: ${teamsError.message}`);
      }

      if (!teamsData || teamsData.length === 0) {
        return [];
      }

      // Get manager IDs
      const managerIds = teamsData
        .filter((t) => t.manager_id)
        .map((t) => t.manager_id as string);

      // Fetch manager profiles
      let managerProfiles: Profile[] = [];
      if (managerIds.length > 0) {
        const { data: managerData, error: managerError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', managerIds);

        if (managerError) {
          log.error('Failed to fetch manager profiles', { error: managerError });
          throw new Error(`Failed to fetch manager profiles: ${managerError.message}`);
        }

        managerProfiles = (managerData || []).map(toProfile);
      }

      // Fetch member counts
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('team_id')
        .not('team_id', 'is', null);

      if (profilesError) {
        log.error('Failed to fetch profiles for member counts', { error: profilesError });
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      }

      const memberCounts: Record<string, number> = {};
      profiles?.forEach((p) => {
        if (p.team_id) {
          memberCounts[p.team_id] = (memberCounts[p.team_id] || 0) + 1;
        }
      });

      // Combine data
      const teamsWithManagers: TeamWithManager[] = teamsData.map((team) => {
        const adaptedTeam = toTeam(team);
        return {
          ...adaptedTeam,
          manager: managerProfiles.find((m) => m.id === team.manager_id),
          memberCount: memberCounts[team.id] || 0,
        };
      });

      return teamsWithManagers;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - shorter because teams/members change more frequently
  });
}

/**
 * Fetches all users with manager role for manager selection dropdown
 */
export function useManagerOptions(): UseQueryResult<ManagerOption[], Error> {
  return useQuery({
    queryKey: adminTeamsKeys.managers(),
    queryFn: async () => {
      // Fetch all users with manager role
      const { data: managerRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'manager');

      if (rolesError) {
        log.error('Failed to fetch manager roles', { error: rolesError });
        throw new Error(`Failed to fetch manager roles: ${rolesError.message}`);
      }

      if (!managerRoles || managerRoles.length === 0) {
        return [];
      }

      const managerUserIds = managerRoles.map((r) => r.user_id);
      const { data: managerUsers, error: usersError } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', managerUserIds)
        .order('name');

      if (usersError) {
        log.error('Failed to fetch manager users', { error: usersError });
        throw new Error(`Failed to fetch manager users: ${usersError.message}`);
      }

      return (managerUsers || []) as ManagerOption[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
