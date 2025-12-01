import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toCoachingSession } from '@/lib/supabaseAdapters';
import { getAiScoreStatsForReps, getCallCountsLast30DaysForReps, AiScoreStats } from '@/api/aiCallAnalysis';
import type { Profile, CoachingSession } from '@/types/database';

const log = createLogger('useManagerDashboardQueries');

/**
 * Query keys for manager dashboard cache management
 */
export const managerDashboardKeys = {
  all: ['manager-dashboard'] as const,
  reps: (userId: string, role: string) => [...managerDashboardKeys.all, 'reps', userId, role] as const,
  coachingSessions: (repIds: string[]) => [...managerDashboardKeys.all, 'coaching', repIds.join(',')] as const,
  aiScoreStats: (repIds: string[]) => [...managerDashboardKeys.all, 'ai-scores', repIds.join(',')] as const,
  callCounts: (repIds: string[]) => [...managerDashboardKeys.all, 'call-counts', repIds.join(',')] as const,
};

/**
 * Fetches rep profiles for a manager or admin user.
 * - Admins see all reps
 * - Managers see only their team's reps
 */
export function useManagerReps(
  userId: string | undefined,
  role: string | undefined
): UseQueryResult<Profile[], Error> {
  return useQuery({
    queryKey: managerDashboardKeys.reps(userId || '', role || ''),
    queryFn: async () => {
      if (!userId) throw new Error('User ID is required');

      let repProfiles: Profile[] = [];

      if (role === 'admin') {
        // Admins can see all reps - get all profiles that have 'rep' role
        const { data: repRoles, error: rolesError } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'rep');

        if (rolesError) {
          log.error('Failed to fetch rep roles', { error: rolesError });
          throw new Error(`Failed to fetch rep roles: ${rolesError.message}`);
        }

        if (repRoles && repRoles.length > 0) {
          const repUserIds = repRoles.map((r) => r.user_id);
          const { data: profiles, error: profilesError } = await supabase
            .from('profiles')
            .select('*')
            .in('id', repUserIds)
            .eq('is_active', true);

          if (profilesError) {
            log.error('Failed to fetch rep profiles', { error: profilesError });
            throw new Error(`Failed to fetch rep profiles: ${profilesError.message}`);
          }

          repProfiles = profiles || [];
        }
      } else {
        // Managers only see their team's reps
        const { data: teams, error: teamsError } = await supabase
          .from('teams')
          .select('id')
          .eq('manager_id', userId);

        if (teamsError) {
          log.error('Failed to fetch manager teams', { error: teamsError });
          throw new Error(`Failed to fetch manager teams: ${teamsError.message}`);
        }

        if (!teams || teams.length === 0) {
          return [];
        }

        const teamIds = teams.map((t) => t.id);

        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('*')
          .in('team_id', teamIds)
          .eq('is_active', true);

        if (profilesError) {
          log.error('Failed to fetch team rep profiles', { error: profilesError });
          throw new Error(`Failed to fetch team rep profiles: ${profilesError.message}`);
        }

        repProfiles = profiles || [];
      }

      return repProfiles;
    },
    enabled: !!userId && !!role,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches the most recent coaching session for each rep.
 * Returns a Map of repId -> CoachingSession | null
 */
export function useRepCoachingSessions(
  repIds: string[]
): UseQueryResult<Map<string, CoachingSession | null>, Error> {
  return useQuery({
    queryKey: managerDashboardKeys.coachingSessions(repIds),
    queryFn: async () => {
      const resultMap = new Map<string, CoachingSession | null>();
      repIds.forEach(id => resultMap.set(id, null));

      if (repIds.length === 0) {
        return resultMap;
      }

      const { data, error } = await supabase
        .from('coaching_sessions')
        .select('*')
        .in('rep_id', repIds)
        .order('session_date', { ascending: false });

      if (error) {
        log.error('Failed to fetch coaching sessions', { error });
        throw new Error(`Failed to fetch coaching sessions: ${error.message}`);
      }

      if (data) {
        // Group by rep_id and take the most recent for each
        for (const row of data) {
          if (!resultMap.get(row.rep_id)) {
            resultMap.set(row.rep_id, toCoachingSession(row));
          }
        }
      }

      return resultMap;
    },
    enabled: repIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches AI score statistics for multiple reps.
 * Wraps the existing getAiScoreStatsForReps function.
 */
export function useAiScoreStats(
  repIds: string[]
): UseQueryResult<Map<string, AiScoreStats>, Error> {
  return useQuery({
    queryKey: managerDashboardKeys.aiScoreStats(repIds),
    queryFn: () => getAiScoreStatsForReps(repIds),
    enabled: repIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Fetches call counts for the last 30 days for multiple reps.
 * Wraps the existing getCallCountsLast30DaysForReps function.
 */
export function useRepCallCounts(
  repIds: string[]
): UseQueryResult<Record<string, number>, Error> {
  return useQuery({
    queryKey: managerDashboardKeys.callCounts(repIds),
    queryFn: () => getCallCountsLast30DaysForReps(repIds),
    enabled: repIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
