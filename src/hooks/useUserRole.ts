import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { UserRole } from '@/types/database';

/**
 * Cached hook for fetching user role.
 * Uses staleTime: Infinity because roles don't change during a session.
 * This reduces redundant database calls and improves performance.
 */
export function useUserRole(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['user-role', userId],
    queryFn: async () => {
      if (!userId) return null;
      
      // Use the database function for consistency with RLS policies
      const { data, error } = await (supabase.rpc as Function)(
        'get_user_role',
        { _user_id: userId }
      );
      
      if (error) throw error;
      return data as UserRole | null;
    },
    enabled: !!userId,
    staleTime: Infinity, // Role doesn't change during session
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * Query key factory for user role queries
 */
export const userRoleKeys = {
  all: ['user-role'] as const,
  byUser: (userId: string) => ['user-role', userId] as const,
};
