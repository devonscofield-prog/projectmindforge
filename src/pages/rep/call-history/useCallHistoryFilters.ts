import { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CallHistoryFilters, HeatRange } from '@/api/aiCallAnalysis';
import { CallType } from '@/constants/callTypes';
import { AnalysisStatus, SortColumn } from './constants';

export function useCallHistoryFilters(defaultPageSize = 25) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter state from URL params
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [callTypeFilter, setCallTypeFilter] = useState<string>(searchParams.get('callType') || 'all');
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [heatFilter, setHeatFilter] = useState<string>(searchParams.get('heatRange') || 'all');
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '');
  const [sortBy, setSortBy] = useState<SortColumn>(
    (searchParams.get('sortBy') as SortColumn) || 'call_date'
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc'
  );

  // Pagination state
  const [currentPage, setCurrentPage] = useState(
    parseInt(searchParams.get('page') || '1', 10)
  );
  const [pageSize, setPageSize] = useState(
    parseInt(searchParams.get('pageSize') || String(defaultPageSize), 10)
  );

  // Build filters object with pagination
  const filters: CallHistoryFilters = useMemo(() => ({
    search: search || undefined,
    callTypes: callTypeFilter !== 'all' ? [callTypeFilter as CallType] : undefined,
    statuses: statusFilter !== 'all' ? [statusFilter as AnalysisStatus] : undefined,
    heatRange: heatFilter !== 'all' ? heatFilter as HeatRange : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortOrder,
    limit: pageSize,
    offset: (currentPage - 1) * pageSize,
  }), [search, callTypeFilter, statusFilter, heatFilter, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]);

  const hasActiveFilters = !!(search || callTypeFilter !== 'all' || statusFilter !== 'all' || heatFilter !== 'all' || dateFrom || dateTo);

  // Update URL params when filters change
  const updateUrlParams = useCallback((newPage?: number, newPageSize?: number) => {
    const params = new URLSearchParams();
    
    if (search) params.set('search', search);
    if (callTypeFilter !== 'all') params.set('callType', callTypeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (heatFilter !== 'all') params.set('heatRange', heatFilter);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (sortBy !== 'call_date') params.set('sortBy', sortBy);
    if (sortOrder !== 'desc') params.set('sortOrder', sortOrder);
    
    params.set('page', String(newPage ?? currentPage));
    params.set('pageSize', String(newPageSize ?? pageSize));
    
    setSearchParams(params);
  }, [search, callTypeFilter, statusFilter, heatFilter, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize, setSearchParams]);

  const goToPage = useCallback((page: number, totalPages: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    updateUrlParams(newPage);
  }, [updateUrlParams]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    updateUrlParams(1, newSize);
  }, [updateUrlParams]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setCallTypeFilter('all');
    setStatusFilter('all');
    setHeatFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortBy('call_date');
    setSortOrder('desc');
    setCurrentPage(1);
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', String(pageSize));
    setSearchParams(params);
  }, [pageSize, setSearchParams]);

  const toggleSort = useCallback((column: SortColumn) => {
    if (sortBy === column) {
      const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
      setSortOrder(newOrder);
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  // Update URL when filters change
  const handleFilterChange = useCallback(<T,>(
    setter: React.Dispatch<React.SetStateAction<T>>,
    value: T
  ) => {
    setter(value);
    setCurrentPage(1);
  }, []);

  return {
    // State
    search,
    callTypeFilter,
    statusFilter,
    heatFilter,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
    currentPage,
    pageSize,
    filters,
    hasActiveFilters,
    
    // Setters with auto URL update
    setSearch: (v: string) => handleFilterChange(setSearch, v),
    setCallTypeFilter: (v: string) => handleFilterChange(setCallTypeFilter, v),
    setStatusFilter: (v: string) => handleFilterChange(setStatusFilter, v),
    setHeatFilter: (v: string) => handleFilterChange(setHeatFilter, v),
    setDateFrom: (v: string) => handleFilterChange(setDateFrom, v),
    setDateTo: (v: string) => handleFilterChange(setDateTo, v),
    
    // Actions
    goToPage,
    handlePageSizeChange,
    clearFilters,
    toggleSort,
    updateUrlParams,
  };
}
