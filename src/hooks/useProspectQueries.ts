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

// Hook for fetching all prospects (admin view) with pagination
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
      // Build filter for rep IDs if team is selected
      let repIdsInTeam: string[] | null = null;
      if (filters.teamFilter !== 'all') {
        const { data: teamReps } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', filters.teamFilter);
        repIdsInTeam = (teamReps || []).map(r => r.id);
        
        // If team selected but no reps, return empty result
        if (repIdsInTeam.length === 0) {
          return { prospects: [], totalCount: 0 };
        }
      }

      // Build the query with server-side pagination
      let query = supabase
        .from('prospects')
        .select(`
          id,
          prospect_name,
          account_name,
          status,
          industry,
          heat_score,
          active_revenue,
          last_contact_date,
          rep_id
        `, { count: 'exact' });

      // Apply filters
      if (filters.statusFilter !== 'all') {
        query = query.eq('status', filters.statusFilter as ProspectStatus);
      }

      if (filters.repFilter !== 'all') {
        query = query.eq('rep_id', filters.repFilter);
      } else if (repIdsInTeam) {
        query = query.in('rep_id', repIdsInTeam);
      }

      // Apply search filter
      if (filters.search.trim()) {
        query = query.or(`account_name.ilike.%${filters.search.trim()}%,prospect_name.ilike.%${filters.search.trim()}%`);
      }

      // Apply sorting
      const ascending = filters.sortBy === 'account_name';
      query = query.order(filters.sortBy === 'account_name' ? 'account_name' : filters.sortBy, { ascending });

      // Apply pagination
      const from = (filters.currentPage - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.range(from, to);

      const { data: prospectsData, count, error } = await query;

      if (error) {
        log.error('Failed to load prospects', { error });
        throw error;
      }

      if (!prospectsData || prospectsData.length === 0) {
        return { prospects: [], totalCount: count || 0 };
      }

      // Get unique rep IDs
      const repIds = [...new Set(prospectsData.map(p => p.rep_id))];
      
      // Fetch rep profiles with teams
      const { data: repProfiles } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .in('id', repIds);

      // Fetch teams for profiles
      const teamIds = [...new Set(repProfiles?.map(r => r.team_id).filter(Boolean) || [])];
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds as string[]);

      // Build lookup maps
      const repMap = new Map(repProfiles?.map(r => [r.id, r]) || []);
      const teamMap = new Map(teamsData?.map(t => [t.id, t.name]) || []);

      // Combine data
      const prospects = prospectsData.map(p => {
        const rep = repMap.get(p.rep_id);
        return {
          ...p,
          status: p.status as ProspectStatus,
          rep_name: rep?.name || 'Unknown',
          team_name: rep?.team_id ? teamMap.get(rep.team_id) || null : null,
        };
      });

      return { prospects, totalCount: count || 0 };
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
        supabase.from('prospects').select('heat_score').gte('heat_score', 8),
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
