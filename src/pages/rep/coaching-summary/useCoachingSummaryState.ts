import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateCoachingTrends, 
  CoachingTrendAnalysis, 
  AnalysisMetadata,
  determineAnalysisTier,
  AnalysisTier,
} from '@/api/aiCallAnalysis';
import { 
  DateRange, 
  createDateRange, 
  createPreviousPeriodRange, 
  validatePeriods,
  formatDateISO,
  DATE_CHANGE_DEBOUNCE,
} from './dateUtils';

export function useCoachingSummaryState() {
  const { user, role } = useAuth();
  const { repId } = useParams<{ repId?: string }>();
  const queryClient = useQueryClient();
  
  const dateChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Date range state
  const [dateRangeInternal, setDateRangeInternal] = useState<DateRange>(() => createDateRange(30));
  const [dateRange, setDateRange] = useState<DateRange>(() => createDateRange(30));
  const [selectedPreset, setSelectedPreset] = useState<string>('30');
  
  // Generation control
  const [generateRequested, setGenerateRequested] = useState(false);
  
  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [comparisonConfirmed, setComparisonConfirmed] = useState(false);
  const [comparisonDateRangeInternal, setComparisonDateRangeInternal] = useState<DateRange>(() => 
    createPreviousPeriodRange(createDateRange(30))
  );
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange>(() => 
    createPreviousPeriodRange(createDateRange(30))
  );
  const [comparisonPreset, setComparisonPreset] = useState<string>('previous');
  
  // History state
  const [showHistory, setShowHistory] = useState(false);
  const [loadedAnalysis, setLoadedAnalysis] = useState<CoachingTrendAnalysis | null>(null);
  
  // Export dialog
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // History comparison
  const [historyComparisonAnalysis, setHistoryComparisonAnalysis] = useState<{
    analysis: CoachingTrendAnalysis;
    dateRange: DateRange;
  } | null>(null);
  
  const targetRepId = repId || user?.id;
  const isOwnSummary = !repId || repId === user?.id;

  // Debounced date range update
  const debounceDateRangeUpdate = useCallback((
    newRange: DateRange,
    setInternal: React.Dispatch<React.SetStateAction<DateRange>>,
    setDebounced: React.Dispatch<React.SetStateAction<DateRange>>,
    additionalCallback?: () => void
  ) => {
    setInternal(newRange);
    
    if (dateChangeTimerRef.current) {
      clearTimeout(dateChangeTimerRef.current);
    }
    
    dateChangeTimerRef.current = setTimeout(() => {
      setDebounced(newRange);
      additionalCallback?.();
    }, DATE_CHANGE_DEBOUNCE);
  }, []);

  // Rep profile query
  const { data: repProfile } = useQuery({
    queryKey: ['rep-profile', targetRepId],
    queryFn: async () => {
      if (!targetRepId || isOwnSummary) return null;
      const { data } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', targetRepId)
        .single();
      return data;
    },
    enabled: !!targetRepId && !isOwnSummary,
  });

  // Main trend analysis query
  const { 
    data: trendAnalysis, 
    isLoading, 
    error, 
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['coaching-trends', targetRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => generateCoachingTrends(targetRepId!, dateRange),
    enabled: !!targetRepId && generateRequested,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Comparison period query
  const { 
    data: comparisonTrendAnalysis,
    isLoading: isComparisonLoading,
    error: comparisonError,
    isFetching: isComparisonFetching,
  } = useQuery({
    queryKey: ['coaching-trends', targetRepId, comparisonDateRange.from.toISOString(), comparisonDateRange.to.toISOString()],
    queryFn: () => generateCoachingTrends(targetRepId!, comparisonDateRange),
    enabled: !!targetRepId && isComparisonMode && comparisonConfirmed,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Call count preview
  const { data: callCountPreview, isLoading: isLoadingCallCount } = useQuery({
    queryKey: ['call-count-preview', targetRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('call_transcripts')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', targetRepId!)
        .eq('analysis_status', 'completed')
        .gte('call_date', formatDateISO(dateRange.from))
        .lte('call_date', formatDateISO(dateRange.to));
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!targetRepId && !generateRequested && !loadedAnalysis,
    staleTime: 30 * 1000,
  });

  // Handlers
  const handlePresetChange = useCallback((value: string) => {
    setSelectedPreset(value);
    setLoadedAnalysis(null);
    setGenerateRequested(false);
    if (value !== 'custom') {
      const newRange = createDateRange(parseInt(value));
      setDateRangeInternal(newRange);
      setDateRange(newRange);
      if (isComparisonMode && comparisonPreset === 'previous') {
        const compRange = createPreviousPeriodRange(newRange);
        setComparisonDateRangeInternal(compRange);
        setComparisonDateRange(compRange);
      }
      if (isComparisonMode) {
        setComparisonConfirmed(false);
      }
    }
  }, [isComparisonMode, comparisonPreset]);

  const handleFromDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      const newRange = { ...dateRangeInternal, from: date };
      setSelectedPreset('custom');
      setLoadedAnalysis(null);
      setGenerateRequested(false);
      
      debounceDateRangeUpdate(newRange, setDateRangeInternal, setDateRange, () => {
        if (isComparisonMode && comparisonPreset === 'previous') {
          const compRange = createPreviousPeriodRange(newRange);
          setComparisonDateRangeInternal(compRange);
          setComparisonDateRange(compRange);
        }
        if (isComparisonMode) {
          setComparisonConfirmed(false);
        }
      });
    }
  }, [dateRangeInternal, isComparisonMode, comparisonPreset, debounceDateRangeUpdate]);

  const handleToDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      const newRange = { ...dateRangeInternal, to: date };
      setSelectedPreset('custom');
      setLoadedAnalysis(null);
      setGenerateRequested(false);
      
      debounceDateRangeUpdate(newRange, setDateRangeInternal, setDateRange, () => {
        if (isComparisonMode && comparisonPreset === 'previous') {
          const compRange = createPreviousPeriodRange(newRange);
          setComparisonDateRangeInternal(compRange);
          setComparisonDateRange(compRange);
        }
        if (isComparisonMode) {
          setComparisonConfirmed(false);
        }
      });
    }
  }, [dateRangeInternal, isComparisonMode, comparisonPreset, debounceDateRangeUpdate]);

  const handleComparisonPresetChange = useCallback((value: string) => {
    setComparisonPreset(value);
    if (value === 'previous') {
      const compRange = createPreviousPeriodRange(dateRange);
      setComparisonDateRangeInternal(compRange);
      setComparisonDateRange(compRange);
    }
    setComparisonConfirmed(false);
  }, [dateRange]);

  const handleComparisonFromDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      const newRange = { ...comparisonDateRangeInternal, from: date };
      setComparisonPreset('custom');
      
      debounceDateRangeUpdate(newRange, setComparisonDateRangeInternal, setComparisonDateRange, () => {
        setComparisonConfirmed(false);
      });
    }
  }, [comparisonDateRangeInternal, debounceDateRangeUpdate]);

  const handleComparisonToDateChange = useCallback((date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      const newRange = { ...comparisonDateRangeInternal, to: date };
      setComparisonPreset('custom');
      
      debounceDateRangeUpdate(newRange, setComparisonDateRangeInternal, setComparisonDateRange, () => {
        setComparisonConfirmed(false);
      });
    }
  }, [comparisonDateRangeInternal, debounceDateRangeUpdate]);

  const handleComparisonToggle = useCallback((checked: boolean) => {
    setIsComparisonMode(checked);
    if (checked) {
      const compRange = createPreviousPeriodRange(dateRange);
      setComparisonDateRangeInternal(compRange);
      setComparisonDateRange(compRange);
      setComparisonPreset('previous');
      setComparisonConfirmed(false);
    } else {
      setComparisonConfirmed(false);
    }
  }, [dateRange]);

  const handleForceRefresh = useCallback(() => {
    setLoadedAnalysis(null);
    setGenerateRequested(true);
    generateCoachingTrends(targetRepId!, dateRange, { forceRefresh: true })
      .then(() => refetch());
  }, [targetRepId, dateRange, refetch]);

  const handleGenerateTrends = useCallback(() => {
    setGenerateRequested(true);
  }, []);

  const handleLoadFromHistory = useCallback((analysis: CoachingTrendAnalysis, historyDateRange: DateRange) => {
    setDateRange(historyDateRange);
    setDateRangeInternal(historyDateRange);
    setSelectedPreset('custom');
    setLoadedAnalysis(analysis);
    setGenerateRequested(true);
    setHistoryComparisonAnalysis(null);
    queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', targetRepId] });
  }, [queryClient, targetRepId]);

  const handleCompareFromHistory = useCallback((analysis: CoachingTrendAnalysis, historyDateRange: DateRange) => {
    setHistoryComparisonAnalysis({ analysis, dateRange: historyDateRange });
    setIsComparisonMode(true);
    setComparisonConfirmed(true);
  }, []);

  const handleExitHistoryComparison = useCallback(() => {
    setHistoryComparisonAnalysis(null);
    setIsComparisonMode(false);
    setComparisonConfirmed(false);
  }, []);

  const handleRunComparison = useCallback(() => {
    setComparisonConfirmed(true);
  }, []);

  // Computed values
  const isAnyLoading = isLoading || (isComparisonMode && comparisonConfirmed && isComparisonLoading);
  const isAnyFetching = isFetching || (isComparisonMode && comparisonConfirmed && isComparisonFetching);
  
  const periodValidation = useMemo(() => 
    isComparisonMode ? validatePeriods(comparisonDateRange, dateRange) : null,
    [isComparisonMode, comparisonDateRange, dateRange]
  );
  
  const hasValidationErrors = periodValidation?.warnings.some(w => w.type === 'error') ?? false;

  const currentAnalysis: CoachingTrendAnalysis | null = useMemo(() => {
    if (loadedAnalysis) return loadedAnalysis;
    if (trendAnalysis) return trendAnalysis.analysis;
    return null;
  }, [loadedAnalysis, trendAnalysis]);
  
  const currentMetadata: AnalysisMetadata | null = useMemo(() => {
    if (loadedAnalysis) return null;
    if (trendAnalysis) return trendAnalysis.metadata;
    return null;
  }, [loadedAnalysis, trendAnalysis]);

  const comparisonAnalysis: CoachingTrendAnalysis | null = useMemo(() => {
    if (comparisonTrendAnalysis) return comparisonTrendAnalysis.analysis;
    return null;
  }, [comparisonTrendAnalysis]);

  const displayAnalysis = currentAnalysis;
  
  const previewTier = useMemo((): AnalysisTier | null => {
    if (callCountPreview === null || callCountPreview === undefined) return null;
    return determineAnalysisTier(callCountPreview);
  }, [callCountPreview]);

  return {
    // Auth & navigation
    user,
    role,
    repId,
    targetRepId,
    isOwnSummary,
    repProfile,
    
    // Date state
    dateRange,
    dateRangeInternal,
    selectedPreset,
    comparisonDateRange,
    comparisonDateRangeInternal,
    comparisonPreset,
    
    // Mode state
    generateRequested,
    isComparisonMode,
    comparisonConfirmed,
    showHistory,
    setShowHistory,
    showExportDialog,
    setShowExportDialog,
    loadedAnalysis,
    historyComparisonAnalysis,
    
    // Query state
    isLoading,
    isFetching,
    error,
    isComparisonLoading,
    isComparisonFetching,
    comparisonError,
    dataUpdatedAt,
    callCountPreview,
    isLoadingCallCount,
    
    // Computed
    isAnyLoading,
    isAnyFetching,
    periodValidation,
    hasValidationErrors,
    currentAnalysis,
    currentMetadata,
    comparisonAnalysis,
    displayAnalysis,
    previewTier,
    
    // Handlers
    handlePresetChange,
    handleFromDateChange,
    handleToDateChange,
    handleComparisonPresetChange,
    handleComparisonFromDateChange,
    handleComparisonToDateChange,
    handleComparisonToggle,
    handleForceRefresh,
    handleGenerateTrends,
    handleLoadFromHistory,
    handleCompareFromHistory,
    handleExitHistoryComparison,
    handleRunComparison,
  };
}
