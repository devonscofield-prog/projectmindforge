import { useQuery } from '@tanstack/react-query';
import { 
  fetchAdminCoachSessions, 
  fetchCoachSessionStats,
  fetchUsersWithCoachSessions,
} from '@/api/adminSalesCoachSessions';

export function useAdminCoachSessions(options?: {
  userId?: string;
  searchQuery?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ['admin-coach-sessions', options],
    queryFn: () => fetchAdminCoachSessions(options),
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}

export function useCoachSessionStats() {
  return useQuery({
    queryKey: ['coach-session-stats'],
    queryFn: fetchCoachSessionStats,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUsersWithCoachSessions() {
  return useQuery({
    queryKey: ['users-with-coach-sessions'],
    queryFn: fetchUsersWithCoachSessions,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}
