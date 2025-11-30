import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AdminDashboardStats {
  userCount: number;
  teamCount: number;
  callCount: number;
  prospectCount: number;
  roleCounts: {
    rep: number;
    manager: number;
    admin: number;
  };
}

interface CachedAdminStats {
  totalUsers: number;
  totalTeams: number;
  totalCalls: number;
  totalProspects: number;
  roleDistribution: {
    admin: number;
    manager: number;
    rep: number;
  };
}

/**
 * Fetch admin dashboard overview stats (with server-side caching)
 */
export function useAdminDashboardStats(): UseQueryResult<AdminDashboardStats, Error> {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      // Try cached function first
      const { data: cachedData, error: cacheError } = await supabase.rpc('get_cached_admin_stats');
      
      if (!cacheError && cachedData) {
        const stats = cachedData as unknown as CachedAdminStats;
        return {
          userCount: stats.totalUsers ?? 0,
          teamCount: stats.totalTeams ?? 0,
          callCount: stats.totalCalls ?? 0,
          prospectCount: stats.totalProspects ?? 0,
          roleCounts: {
            admin: stats.roleDistribution?.admin ?? 0,
            manager: stats.roleDistribution?.manager ?? 0,
            rep: stats.roleDistribution?.rep ?? 0,
          },
        };
      }

      // Fallback to direct queries if cache fails
      console.log('Cache miss or error, fetching directly:', cacheError);
      const [
        { count: userCount },
        { count: teamCount },
        { count: callCount },
        { count: prospectCount },
        { data: roles },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('call_transcripts').select('*', { count: 'exact', head: true }),
        supabase.from('prospects').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
      ]);

      const roleCounts = { rep: 0, manager: 0, admin: 0 };
      (roles || []).forEach(r => {
        if (r.role in roleCounts) {
          roleCounts[r.role as keyof typeof roleCounts]++;
        }
      });

      return {
        userCount: userCount ?? 0,
        teamCount: teamCount ?? 0,
        callCount: callCount ?? 0,
        prospectCount: prospectCount ?? 0,
        roleCounts,
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });
}

export interface ProspectStats {
  total: number;
  active: number;
  hot: number;
  pipelineValue: number;
}

interface CachedProspectStats {
  total: number;
  active: number;
  hotProspects: number;
  pipelineValue: number;
}

/**
 * Fetch prospect statistics (with server-side caching)
 */
export function useProspectStats(): UseQueryResult<ProspectStats, Error> {
  return useQuery({
    queryKey: ['prospect-stats'],
    queryFn: async (): Promise<ProspectStats> => {
      // Try cached function first
      const { data: cachedData, error: cacheError } = await supabase.rpc('get_cached_prospect_stats');
      
      if (!cacheError && cachedData) {
        const stats = cachedData as unknown as CachedProspectStats;
        return {
          total: stats.total ?? 0,
          active: stats.active ?? 0,
          hot: stats.hotProspects ?? 0,
          pipelineValue: stats.pipelineValue ?? 0,
        };
      }

      // Fallback to direct queries if cache fails
      console.log('Cache miss or error, fetching directly:', cacheError);
      const [
        { count: totalCount },
        { count: activeCount },
        { data: hotProspects },
        { data: pipelineData },
      ] = await Promise.all([
        supabase.from('prospects').select('*', { count: 'exact', head: true }),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prospects').select('heat_score').gte('heat_score', 8),
        supabase.from('prospects').select('potential_revenue').eq('status', 'active'),
      ]);

      const pipelineValue = (pipelineData || []).reduce(
        (sum, p) => sum + (p.potential_revenue ?? 0),
        0
      );

      return {
        total: totalCount ?? 0,
        active: activeCount ?? 0,
        hot: (hotProspects ?? []).length,
        pipelineValue,
      };
    },
    staleTime: 60 * 1000,
  });
}
