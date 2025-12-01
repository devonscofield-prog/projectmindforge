import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toProfile, toTeam } from '@/lib/supabaseAdapters';
import type { Profile, Team, UserRole } from '@/types/database';

const log = createLogger('useAdminUsersQueries');

export interface UserWithDetails extends Profile {
  role?: UserRole;
  team?: Team;
  last_seen_at?: string;
}

/**
 * Query keys for admin users cache management
 */
export const adminUsersKeys = {
  all: ['admin-users'] as const,
  users: () => [...adminUsersKeys.all, 'users'] as const,
  teams: () => [...adminUsersKeys.all, 'teams'] as const,
};

/**
 * Fetches all users with their role and team information
 */
export function useAdminUsers(): UseQueryResult<UserWithDetails[], Error> {
  return useQuery({
    queryKey: adminUsersKeys.users(),
    queryFn: async () => {
      // Fetch all profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('name');

      if (profilesError) {
        log.error('Failed to fetch profiles', { error: profilesError });
        throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
      }

      if (!profiles || profiles.length === 0) {
        return [];
      }

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) {
        log.error('Failed to fetch user roles', { error: rolesError });
        throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
      }

      // Fetch all teams
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (teamsError) {
        log.error('Failed to fetch teams', { error: teamsError });
        throw new Error(`Failed to fetch teams: ${teamsError.message}`);
      }

      const adaptedTeams = (teamsData || []).map(toTeam);

      // Create a map for quick team lookup
      const teamMap = new Map(adaptedTeams.map(t => [t.id, t]));

      // Combine data
      const usersWithDetails: UserWithDetails[] = profiles.map((profile) => {
        const adaptedProfile = toProfile(profile);
        return {
          ...adaptedProfile,
          role: roles?.find((r) => r.user_id === profile.id)?.role as UserRole,
          team: profile.team_id ? teamMap.get(profile.team_id) : undefined,
        };
      });

      return usersWithDetails;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Fetches all teams for team selection dropdown
 */
export function useAdminUsersTeams(): UseQueryResult<Team[], Error> {
  return useQuery({
    queryKey: adminUsersKeys.teams(),
    queryFn: async () => {
      const { data: teamsData, error } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (error) {
        log.error('Failed to fetch teams', { error });
        throw new Error(`Failed to fetch teams: ${error.message}`);
      }

      return (teamsData || []).map(toTeam);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
