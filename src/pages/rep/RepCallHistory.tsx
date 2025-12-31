import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getRepPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Input } from '@/components/ui/input';
import { listCallTranscriptsForRepWithFilters } from '@/api/aiCallAnalysis';
import { Search, History } from 'lucide-react';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { SalesAssistantChat } from '@/components/SalesAssistantChat';
import {
  CallHistoryFilters,
  CallHistoryTable,
  useCallHistoryFilters,
} from './call-history';

function RepCallHistory() {
  const { user } = useAuth();
  const [filtersOpen, setFiltersOpen] = useState(false);

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

  // Fetch filtered transcripts
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['rep-call-history', user?.id, filters],
    queryFn: () => listCallTranscriptsForRepWithFilters(user!.id, filters),
    enabled: !!user?.id,
  });

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const transcripts = data?.data || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
        <PageBreadcrumb items={getRepPageBreadcrumb('callHistory')} />
        
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <History className="h-6 w-6 md:h-8 md:w-8" />
            Call History
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            View and search through all your past call analyses
          </p>
        </div>

        {/* Search - Always visible */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="search"
            placeholder="Search stakeholder, account, or notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
          />
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
          hasActiveFilters={hasActiveFilters}
          onCallTypeChange={setCallTypeFilter}
          onStatusChange={setStatusFilter}
          onHeatChange={setHeatFilter}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onClearFilters={clearFilters}
        />

        {/* Results Table */}
        <CallHistoryTable
          transcripts={transcripts}
          totalCount={totalCount}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
          currentPage={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          sortBy={sortBy}
          onRefresh={handleRefresh}
          onToggleSort={toggleSort}
          onGoToPage={(page) => goToPage(page, totalPages)}
          onPageSizeChange={handlePageSizeChange}
        />
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(RepCallHistory, 'Call History');
