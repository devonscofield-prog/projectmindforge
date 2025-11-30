import { useQuery } from '@tanstack/react-query';
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

/**
 * Fetch admin dashboard overview stats
 */
export function useAdminDashboardStats() {
  return useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async (): Promise<AdminDashboardStats> => {
      // Run all count queries in parallel
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
        userCount: userCount || 0,
        teamCount: teamCount || 0,
        callCount: callCount || 0,
        prospectCount: prospectCount || 0,
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

/**
 * Fetch prospect statistics
 */
export function useProspectStats() {
  return useQuery({
    queryKey: ['prospect-stats'],
    queryFn: async (): Promise<ProspectStats> => {
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
        total: totalCount || 0,
        active: activeCount || 0,
        hot: (hotProspects || []).length,
        pipelineValue,
      };
    },
    staleTime: 60 * 1000,
  });
}
