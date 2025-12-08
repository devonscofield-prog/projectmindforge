import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getAdminPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCallTranscriptsForTeamWithFilters } from '@/api/aiCallAnalysis';
import { useAdminUsers } from '@/hooks/useAdminUsersQueries';
import { useAdminTeams } from '@/hooks/useAdminTeamsQueries';
import { Search, History, Users, Building2 } from 'lucide-react';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import {
  CallHistoryFilters,
  CallHistoryTable,
  useCallHistoryFilters,
} from '../rep/call-history';

function AdminCallHistory() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');

  // Fetch all users and teams
  const { data: users = [], isLoading: usersLoading } = useAdminUsers();
  const { data: teams = [], isLoading: teamsLoading } = useAdminTeams();

  const {
    search,
    callTypeFilter,
    statusFilter,
    heatFilter,
    dateFrom,
    dateTo,
    sortBy,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    setSearch,
    setCallTypeFilter,
    setStatusFilter,
    setHeatFilter,
    setDateFrom,
    setDateTo,
    goToPage,
    handlePageSizeChange,
    clearFilters,
    toggleSort,
  } = useCallHistoryFilters();

  // Get all reps (users with role 'rep' or all users if we want to include everyone)
  const allReps = useMemo(() => {
    // Filter to only reps, or include all if viewing all teams
    return users.filter(u => u.role === 'rep' || u.role === 'manager');
  }, [users]);

  // Filter reps by selected team
  const filteredReps = useMemo(() => {
    if (selectedTeamId === 'all') {
      return allReps;
    }
    return allReps.filter(r => r.team_id === selectedTeamId);
  }, [allReps, selectedTeamId]);

  // Get rep IDs for the query
  const repIds = useMemo(() => {
    if (selectedRepId !== 'all') {
      return [selectedRepId];
    }
    if (selectedTeamId !== 'all') {
      return filteredReps.map(r => r.id);
    }
    // All reps in the organization
    return allReps.map(r => r.id);
  }, [selectedRepId, selectedTeamId, filteredReps, allReps]);

  // Extend filters with selected rep
  const extendedFilters = useMemo(() => ({
    ...filters,
    repId: selectedRepId !== 'all' ? selectedRepId : undefined,
  }), [filters, selectedRepId]);

  // Fetch filtered transcripts for organization
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-call-history', repIds, extendedFilters],
    queryFn: () => listCallTranscriptsForTeamWithFilters(repIds, extendedFilters),
    enabled: repIds.length > 0,
  });

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Handle team filter change - reset rep and page
  const handleTeamChange = (value: string) => {
    setSelectedTeamId(value);
    setSelectedRepId('all'); // Reset rep when team changes
    goToPage(1, totalPages);
  };

  // Handle rep filter change - reset page
  const handleRepChange = (value: string) => {
    setSelectedRepId(value);
    goToPage(1, totalPages);
  };

  // Clear all filters including team and rep
  const handleClearAllFilters = () => {
    clearFilters();
    setSelectedTeamId('all');
    setSelectedRepId('all');
  };

  const transcripts = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const hasAnyActiveFilters = hasActiveFilters || selectedTeamId !== 'all' || selectedRepId !== 'all';

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <PageBreadcrumb items={getAdminPageBreadcrumb('callHistory')} />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 md:h-8 md:w-8" />
            Organization Call History
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            View and search through all call analyses across the organization
          </p>
        </div>

        {/* Search and Filter Row */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="search"
              placeholder="Search stakeholder, account, or notes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          
          {/* Team Filter */}
          <div className="w-full sm:w-[180px]">
            <Select value={selectedTeamId} onValueChange={handleTeamChange} disabled={teamsLoading}>
              <SelectTrigger className="h-11">
                <Building2 className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Teams</SelectItem>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    {team.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Rep Filter */}
          <div className="w-full sm:w-[180px]">
            <Select value={selectedRepId} onValueChange={handleRepChange} disabled={usersLoading}>
              <SelectTrigger className="h-11">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {filteredReps.map((rep) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Filters */}
        <CallHistoryFilters
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          callTypeFilter={callTypeFilter}
          statusFilter={statusFilter}
          heatFilter={heatFilter}
          dateFrom={dateFrom}
          dateTo={dateTo}
          hasActiveFilters={hasAnyActiveFilters}
          onCallTypeChange={setCallTypeFilter}
          onStatusChange={setStatusFilter}
          onHeatChange={setHeatFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearFilters={handleClearAllFilters}
        />

        {/* Results Table */}
        <CallHistoryTable
          transcripts={transcripts}
          totalCount={totalCount}
          isLoading={isLoading || usersLoading || teamsLoading}
          hasActiveFilters={hasAnyActiveFilters}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={sortBy}
          onRefresh={handleRefresh}
          onToggleSort={toggleSort}
          onGoToPage={(page) => goToPage(page, totalPages)}
          onPageSizeChange={handlePageSizeChange}
          showRepName
        />
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminCallHistory, 'Organization Call History');
