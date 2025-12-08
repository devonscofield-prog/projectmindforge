import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getManagerPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { listCallTranscriptsForTeamWithFilters } from '@/api/aiCallAnalysis';
import { useManagerReps } from '@/hooks/useManagerDashboardQueries';
import { Search, History, Users } from 'lucide-react';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import {
  CallHistoryFilters,
  CallHistoryTable,
  useCallHistoryFilters,
} from '../rep/call-history';

function ManagerCallHistory() {
  const { user, role } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');

  // Fetch team reps
  const { data: reps = [], isLoading: repsLoading } = useManagerReps(user?.id, role || undefined);

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

  // Get rep IDs for the query
  const repIds = useMemo(() => reps.map(r => r.id), [reps]);

  // Extend filters with selected rep
  const extendedFilters = useMemo(() => ({
    ...filters,
    repId: selectedRepId !== 'all' ? selectedRepId : undefined,
  }), [filters, selectedRepId]);

  // Fetch filtered transcripts for team
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['manager-call-history', repIds, extendedFilters],
    queryFn: () => listCallTranscriptsForTeamWithFilters(repIds, extendedFilters),
    enabled: repIds.length > 0,
  });

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Handle rep filter change - reset page
  const handleRepChange = (value: string) => {
    setSelectedRepId(value);
    goToPage(1, totalPages);
  };

  // Clear all filters including rep
  const handleClearAllFilters = () => {
    clearFilters();
    setSelectedRepId('all');
  };

  const transcripts = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const hasAnyActiveFilters = hasActiveFilters || selectedRepId !== 'all';

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <PageBreadcrumb items={getManagerPageBreadcrumb('callHistory')} />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 md:h-8 md:w-8" />
            Team Call History
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            View and search through all your team's call analyses
          </p>
        </div>

        {/* Search and Rep Filter Row */}
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
          
          {/* Rep Filter */}
          <div className="w-full sm:w-[200px]">
            <Select value={selectedRepId} onValueChange={handleRepChange} disabled={repsLoading}>
              <SelectTrigger className="h-11">
                <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps.map((rep) => (
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
          isLoading={isLoading || repsLoading}
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

export default withPageErrorBoundary(ManagerCallHistory, 'Team Call History');
