import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  listProspectsForRep, 
  listProspectsForTeam,
  getCallCountsForProspects,
  type Prospect,
  type ProspectWithRep,
  type ProspectStatus,
  type ProspectFilters 
} from '@/api/prospects';
import { 
  getStakeholderCountsForProspects, 
  getPrimaryStakeholdersForProspects 
} from '@/api/stakeholders';
import { createLogger } from '@/lib/logger';

const log = createLogger('useProspectQueries');

// Re-export types for consumers
export type { ProspectStatus, ProspectFilters } from '@/api/prospects';

export const prospectKeys = {
  all: ['prospects'] as const,
  lists: () => [...prospectKeys.all, 'list'] as const,
  list: (filters: string) => [...prospectKeys.lists(), filters] as const,
  stats: () => [...prospectKeys.all, 'stats'] as const,
  callCounts: (prospectIds: string[]) => [...prospectKeys.all, 'callCounts', prospectIds] as const,
  stakeholderCounts: (prospectIds: string[]) => [...prospectKeys.all, 'stakeholderCounts', prospectIds] as const,
  primaryStakeholders: (prospectIds: string[]) => [...prospectKeys.all, 'primaryStakeholders', prospectIds] as const,
};

// Hook for fetching prospects for a rep
export function useRepProspects(
  repId: string | undefined,
  filters: ProspectFilters,
  enabled = true
) {
  return useQuery({
    queryKey: prospectKeys.list(JSON.stringify({ repId, ...filters })),
    queryFn: async () => {
      if (!repId) throw new Error('Rep ID is required');
      return await listProspectsForRep(repId, filters);
    },
    enabled: enabled && !!repId,
  });
}

// Hook for fetching prospects for a team (manager view)
export function useTeamProspects(
  managerId: string | undefined,
  filters: ProspectFilters & { repId?: string },
  enabled = true
) {
  return useQuery({
    queryKey: prospectKeys.list(JSON.stringify({ managerId, ...filters })),
    queryFn: async () => {
      if (!managerId) throw new Error('Manager ID is required');
      return await listProspectsForTeam(managerId, filters);
    },
    enabled: enabled && !!managerId,
  });
}

// Hook for fetching all prospects (admin view) with pagination and call count sorting
export function useAdminProspects(
  filters: {
    statusFilter: string;
    teamFilter: string;
    repFilter: string;
    sortBy: string;
    search: string;
    currentPage: number;
    pageSize: number;
  },
  enabled = true
) {
  return useQuery({
    queryKey: prospectKeys.list(JSON.stringify(filters)),
    queryFn: async () => {
      const offset = (filters.currentPage - 1) * filters.pageSize;

      // Use the RPC function for server-side sorting including call_count
      const { data, error } = await supabase.rpc('get_admin_prospects_with_call_counts', {
        p_status_filter: filters.statusFilter,
        p_team_filter: filters.teamFilter !== 'all' ? filters.teamFilter : undefined,
        p_rep_filter: filters.repFilter !== 'all' ? filters.repFilter : undefined,
        p_search: filters.search.trim() || undefined,
        p_sort_by: filters.sortBy,
        p_limit: filters.pageSize,
        p_offset: offset,
      });

      if (error) {
        log.error('Failed to load prospects', { error });
        throw error;
      }

      if (!data || data.length === 0) {
        return { prospects: [], totalCount: 0, callCounts: {} };
      }

      // Extract total count from first row (all rows have same total_count)
      const totalCount = Number(data[0].total_count) || 0;

      // Build call counts map from the returned data
      const callCounts: Record<string, number> = {};

      // Transform data to match expected format
      const prospects = data.map(p => {
        callCounts[p.id] = Number(p.call_count) || 0;
        return {
          id: p.id,
          prospect_name: p.prospect_name,
          account_name: p.account_name,
          status: p.status as ProspectStatus,
          industry: p.industry,
          heat_score: p.heat_score,
          active_revenue: p.active_revenue,
          last_contact_date: p.last_contact_date,
          rep_id: p.rep_id,
          ai_extracted_info: p.ai_extracted_info,
          rep_name: p.rep_name || 'Unknown',
          team_name: p.team_name || null,
        };
      });

      return { prospects, totalCount, callCounts };
    },
    enabled,
  });
}

// Hook for fetching call counts for prospects
export function useCallCounts(prospectIds: string[], enabled = true) {
  return useQuery({
    queryKey: prospectKeys.callCounts(prospectIds),
    queryFn: () => getCallCountsForProspects(prospectIds),
    enabled: enabled && prospectIds.length > 0,
  });
}

// Hook for fetching stakeholder counts for prospects
export function useStakeholderCounts(prospectIds: string[], enabled = true) {
  return useQuery({
    queryKey: prospectKeys.stakeholderCounts(prospectIds),
    queryFn: () => getStakeholderCountsForProspects(prospectIds),
    enabled: enabled && prospectIds.length > 0,
  });
}

// Hook for fetching primary stakeholders for prospects
export function usePrimaryStakeholders(prospectIds: string[], enabled = true) {
  return useQuery({
    queryKey: prospectKeys.primaryStakeholders(prospectIds),
    queryFn: () => getPrimaryStakeholdersForProspects(prospectIds),
    enabled: enabled && prospectIds.length > 0,
  });
}

// Hook for fetching admin stats
export function useAdminProspectStats(enabled = true) {
  return useQuery({
    queryKey: prospectKeys.stats(),
    queryFn: async () => {
      const [
        { count: totalCount },
        { count: activeCount },
        { data: hotProspects },
        { data: pipelineData }
      ] = await Promise.all([
        supabase.from('prospects').select('*', { count: 'exact', head: true }),
        supabase.from('prospects').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('prospects').select('account_heat_score').gte('account_heat_score', 70),
        supabase.from('prospects').select('active_revenue').eq('status', 'active')
      ]);

      const pipelineValue = (pipelineData || []).reduce((sum, p) => sum + (p.active_revenue ?? 0), 0);

      return {
        total: totalCount || 0,
        active: activeCount || 0,
        hot: (hotProspects || []).length,
        pipelineValue,
      };
    },
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
