import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { listCallTranscriptsForRepWithFilters, CallHistoryFilters, CallTranscript } from '@/api/aiCallAnalysis';
import { CallType, callTypeLabels, callTypeOptions } from '@/constants/callTypes';
import { MobileCallCard } from '@/components/calls/MobileCallCard';
import { format } from 'date-fns';
import { 
  Search, 
  Filter,
  Loader2,
  CheckCircle, 
  AlertCircle, 
  Clock,
  ArrowRight,
  X,
  History,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown
} from 'lucide-react';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

type AnalysisStatus = 'pending' | 'processing' | 'completed' | 'error';

const analysisStatusOptions: { value: AnalysisStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'error', label: 'Error' },
];

export default function RepCallHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter state from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [callTypeFilter, setCallTypeFilter] = useState<string>(searchParams.get('callType') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [sortBy, setSortBy] = useState<'call_date' | 'account_name' | 'created_at'>(
    (searchParams.get('sortBy') as 'call_date' | 'account_name' | 'created_at') || 'call_date'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [pageSize, setPageSize] = useState(
    parseInt(searchParams.get('pageSize') || '25', 10)
  );

  // Build filters object with pagination
  const filters: CallHistoryFilters = useMemo(() => ({
    search: search || undefined,
    callTypes: callTypeFilter !== 'all' ? [callTypeFilter as CallType] : undefined,
    statuses: statusFilter !== 'all' ? [statusFilter as AnalysisStatus] : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortOrder,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  }), [search, callTypeFilter, statusFilter, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]);

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

  // Update URL params when filters change
  const updateFilters = (newFilters: Partial<typeof filters>, resetPage = false) => {
    const params = new URLSearchParams(searchParams);
    Object.entries({ ...filters, ...newFilters }).forEach(([key, value]) => {
      if (key === 'limit' || key === 'offset') return; // Don't store these in URL
      if (value && value !== 'all' && !(Array.isArray(value) && value.length === 0)) {
        params.set(key, Array.isArray(value) ? value.join(',') : String(value));
      } else {
        params.delete(key);
      }
    });
    
    // Handle pagination in URL
    if (resetPage) {
      params.set('page', '1');
      setCurrentPage(1);
    } else {
      params.set('page', String(currentPage));
    }
    params.set('pageSize', String(pageSize));
    
    setSearchParams(params);
  };

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(newPage));
    setSearchParams(params);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams);
    params.set('pageSize', String(newSize));
    params.set('page', '1');
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearch('');
    setCallTypeFilter('all');
    setStatusFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('call_date');
    setSortOrder('desc');
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', String(pageSize));
    setSearchParams(params);
  };

  const hasActiveFilters = search || callTypeFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Analyzed</Badge>;
      case 'processing':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Processing</Badge>;
      case 'error':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Error</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
    }
  };

  const getCallTypeDisplay = (t: CallTranscript) => {
    if (t.call_type === 'other' && t.call_type_other) {
      return t.call_type_other;
    }
    if (t.call_type) {
      return callTypeLabels[t.call_type as CallType] || t.call_type;
    }
    return '-';
  };

  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const toggleSort = (column: 'call_date' | 'account_name' | 'created_at') => {
    if (sortBy === column) {
      const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(newOrder);
      updateFilters({ sortOrder: newOrder }, true);
    } else {
      setSortBy(column);
      setSortOrder('desc');
      updateFilters({ sortBy: column, sortOrder: 'desc' }, true);
    }
  };

  // Calculate display range
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <AppLayout>
      <div className="space-y-4 md:space-y-6">
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
            onChange={(e) => {
              setSearch(e.target.value);
              updateFilters({ search: e.target.value || undefined }, true);
            }}
            className="pl-9 h-11"
          />
        </div>

        {/* Filters Card - Collapsible on mobile */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer md:cursor-default">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                    {hasActiveFilters && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </span>
                  <ChevronDown className="h-4 w-4 md:hidden transition-transform duration-200 data-[state=open]:rotate-180" />
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent className="md:block" forceMount>
              <CardContent className="space-y-4 hidden md:block data-[state=open]:block">
                {/* Filter Row */}
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              {/* Call Type */}
              <div className="space-y-2">
                <Label>Call Type</Label>
                <Select 
                  value={callTypeFilter} 
                  onValueChange={(v) => {
                    setCallTypeFilter(v);
                    updateFilters({ callTypes: v !== 'all' ? [v as CallType] : undefined }, true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {callTypeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select 
                  value={statusFilter} 
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    updateFilters({ statuses: v !== 'all' ? [v as AnalysisStatus] : undefined }, true);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {analysisStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Date From */}
              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    updateFilters({ dateFrom: e.target.value || undefined }, true);
                  }}
                />
              </div>

              {/* Date To */}
              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    updateFilters({ dateTo: e.target.value || undefined }, true);
                  }}
                />
              </div>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              </div>
            )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Results */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                {isLoading ? 'Loading...' : `${totalCount} Call${totalCount !== 1 ? 's' : ''}`}
              </CardTitle>
            </div>
            <CardDescription>
              Click on a call to view detailed analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : transcripts.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No calls found</h3>
                <p className="text-muted-foreground mb-4">
                  {hasActiveFilters
                    ? 'Try adjusting your filters or search terms'
                    : 'Submit your first call to get started'}
                </p>
                {!hasActiveFilters && (
                  <Button onClick={() => navigate('/rep')}>
                    Submit a Call
                  </Button>
                )}
              </div>
            ) : (
              <>
                {/* Mobile Card View with Pull-to-Refresh */}
                <PullToRefresh onRefresh={handleRefresh} className="md:hidden">
                  <div className="space-y-3">
                    {transcripts.map((t) => (
                      <MobileCallCard
                        key={t.id}
                        call={t}
                        onClick={() => navigate(`/calls/${t.id}`)}
                      />
                    ))}
                  </div>
                </PullToRefresh>

                {/* Desktop Table View */}
                <div className="hidden md:block rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort('call_date')}
                        >
                          <div className="flex items-center gap-1">
                            Date
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Stakeholder</TableHead>
                        <TableHead 
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleSort('account_name')}
                        >
                          <div className="flex items-center gap-1">
                            Account
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </TableHead>
                        <TableHead>Call Type</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transcripts.map((t) => (
                        <TableRow 
                          key={t.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/calls/${t.id}`)}
                        >
                          <TableCell className="font-medium">
                            {format(new Date(t.call_date), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>{t.primary_stakeholder_name || '-'}</TableCell>
                          <TableCell>{t.account_name || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCallTypeDisplay(t)}</Badge>
                          </TableCell>
                          <TableCell>{formatCurrency(t.potential_revenue)}</TableCell>
                          <TableCell>{getStatusBadge(t.analysis_status)}</TableCell>
                          <TableCell>
                            <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination Controls */}
                {totalPages > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t">
                    {/* Results info */}
                    <div className="text-sm text-muted-foreground">
                      Showing {startItem} to {endItem} of {totalCount} call{totalCount !== 1 ? 's' : ''}
                    </div>

                    {/* Page size selector and navigation */}
                    <div className="flex items-center gap-4">
                      {/* Page size */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Per page:</span>
                        <Select 
                          value={String(pageSize)} 
                          onValueChange={(v) => handlePageSizeChange(parseInt(v, 10))}
                        >
                          <SelectTrigger className="w-[70px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAGE_SIZE_OPTIONS.map((size) => (
                              <SelectItem key={size} value={String(size)}>
                                {size}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Page navigation */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToPage(1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToPage(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        
                        <span className="text-sm px-2">
                          Page {currentPage} of {totalPages}
                        </span>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToPage(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => goToPage(totalPages)}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronsRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
