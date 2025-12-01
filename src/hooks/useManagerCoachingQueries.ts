import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { toProfile, toCoachingSession } from '@/lib/supabaseAdapters';
import { getTeamRepsForManager } from '@/api/prospects';
import type { CoachingSession, Profile } from '@/types/database';

const log = createLogger('useManagerCoachingQueries');

export interface CoachingWithRep extends CoachingSession {
  rep?: Profile;
}

export interface TeamRep {
  id: string;
  name: string;
}

/**
 * Query keys for manager coaching cache management
 */
export const managerCoachingKeys = {
  all: ['manager-coaching'] as const,
  sessions: (managerId: string) => [...managerCoachingKeys.all, 'sessions', managerId] as const,
  teamReps: (managerId: string) => [...managerCoachingKeys.all, 'team-reps', managerId] as const,
};

/**
 * Fetches all coaching sessions for a manager with rep profile information
 */
export function useManagerCoachingSessions(
  managerId: string | undefined
): UseQueryResult<CoachingWithRep[], Error> {
  return useQuery({
    queryKey: managerCoachingKeys.sessions(managerId || ''),
    queryFn: async () => {
      if (!managerId) throw new Error('Manager ID is required');

      // Get all coaching sessions by this manager
      const { data: coachingData, error: coachingError } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('manager_id', managerId)
        .order('session_date', { ascending: false });

      if (coachingError) {
        log.error('Failed to fetch coaching sessions', { error: coachingError });
        throw new Error(`Failed to fetch coaching sessions: ${coachingError.message}`);
      }

      if (!coachingData || coachingData.length === 0) {
        return [];
      }

      // Get unique rep IDs
      const repIds = [...new Set(coachingData.map((c) => c.rep_id))];

      // Fetch rep profiles
      const { data: repProfiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', repIds);

      if (profilesError) {
        log.error('Failed to fetch rep profiles', { error: profilesError });
        throw new Error(`Failed to fetch rep profiles: ${profilesError.message}`);
      }

      // Map profiles to domain objects
      const adaptedProfiles = (repProfiles || []).map(toProfile);
      const profileMap = new Map(adaptedProfiles.map(p => [p.id, p]));

      // Combine data
      const sessionsWithReps: CoachingWithRep[] = coachingData.map((session) => {
        const adaptedSession = toCoachingSession(session);
        return {
          ...adaptedSession,
          rep: profileMap.get(session.rep_id),
        };
      });

      return sessionsWithReps;
    },
    enabled: !!managerId,
    staleTime: 2 * 60 * 1000, // 2 minutes - coaching sessions change frequently
  });
}

/**
 * Fetches team reps for a manager (for dropdown selections)
 * Wraps the existing getTeamRepsForManager function
 */
export function useTeamRepsForManager(
  managerId: string | undefined
): UseQueryResult<TeamRep[], Error> {
  return useQuery({
    queryKey: managerCoachingKeys.teamReps(managerId || ''),
    queryFn: () => {
      if (!managerId) throw new Error('Manager ID is required');
      return getTeamRepsForManager(managerId);
    },
    enabled: !!managerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
