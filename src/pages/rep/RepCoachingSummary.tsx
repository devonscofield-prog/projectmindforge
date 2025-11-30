import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { getRepDetailUrl, getDashboardUrl } from '@/lib/routes';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  generateCoachingTrends, 
  CoachingTrendAnalysis, 
  CoachingTrendAnalysisWithMeta, 
  AnalysisMetadata,
  DIRECT_ANALYSIS_MAX,
  SAMPLING_MAX,
  determineAnalysisTier,
  AnalysisTier,
} from '@/api/aiCallAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { TrendCard } from '@/components/coaching/TrendCard';
import { CriticalInfoTrends } from '@/components/coaching/CriticalInfoTrends';
import { PriorityActionCard } from '@/components/coaching/PriorityActionCard';
import { CoachingTrendsComparison } from '@/components/coaching/CoachingTrendsComparison';
import { CoachingTrendHistorySheet } from '@/components/coaching/CoachingTrendHistorySheet';
import { ExportShareDialog } from '@/components/coaching/ExportShareDialog';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  BarChart3,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  CalendarIcon,
  Sparkles,
  Target,
  MessageSquareQuote,
  Ear,
  Loader2,
  RefreshCw,
  ArrowRight,
  GitCompare,
  Database,
  AlertTriangle,
  Info,
  History,
  Share2,
  Layers,
  Zap,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Debounce delay for date changes (ms)
const DATE_CHANGE_DEBOUNCE = 500;

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
];

function createDateRange(daysBack: number): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

function createPreviousPeriodRange(dateRange: { from: Date; to: Date }): { from: Date; to: Date } {
  const days = Math.floor((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
  const to = new Date(dateRange.from);
  to.setDate(to.getDate() - 1);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - days);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

type QuickFixType = 'shift-period-a' | 'match-duration' | 'use-previous-period';

interface PeriodValidation {
  hasOverlap: boolean;
  overlapDays: number;
  isIdentical: boolean;
  periodADays: number;
  periodBDays: number;
  daysDifference: number;
  warnings: Array<{ type: 'error' | 'warning' | 'info'; message: string; quickFix?: QuickFixType }>;
}

function validatePeriods(
  periodA: { from: Date; to: Date },
  periodB: { from: Date; to: Date }
): PeriodValidation {
  const warnings: Array<{ type: 'error' | 'warning' | 'info'; message: string; quickFix?: QuickFixType }> = [];
  
  // Calculate period durations
  const periodADays = Math.ceil((periodA.to.getTime() - periodA.from.getTime()) / (1000 * 60 * 60 * 24));
  const periodBDays = Math.ceil((periodB.to.getTime() - periodB.from.getTime()) / (1000 * 60 * 60 * 24));
  const daysDifference = Math.abs(periodADays - periodBDays);
  
  // Check if periods are identical
  const isIdentical = 
    periodA.from.toDateString() === periodB.from.toDateString() &&
    periodA.to.toDateString() === periodB.to.toDateString();
  
  if (isIdentical) {
    warnings.push({
      type: 'error',
      message: 'Both periods are identical. Select different date ranges to compare.',
      quickFix: 'use-previous-period'
    });
  }
  
  // Check for overlap
  const overlapStart = Math.max(periodA.from.getTime(), periodB.from.getTime());
  const overlapEnd = Math.min(periodA.to.getTime(), periodB.to.getTime());
  const hasOverlap = !isIdentical && overlapStart <= overlapEnd;
  const overlapDays = hasOverlap ? Math.ceil((overlapEnd - overlapStart) / (1000 * 60 * 60 * 24)) + 1 : 0;
  
  if (hasOverlap && overlapDays > 0) {
    warnings.push({
      type: 'warning',
      message: `Periods overlap by ${overlapDays} day${overlapDays > 1 ? 's' : ''}. This may skew comparison results.`,
      quickFix: 'shift-period-a'
    });
  }
  
  // Check for significant duration difference
  if (!isIdentical && daysDifference > 7 && daysDifference > Math.min(periodADays, periodBDays) * 0.3) {
    warnings.push({
      type: 'info',
      message: `Period lengths differ by ${daysDifference} days. Results will be normalized but may vary.`,
      quickFix: 'match-duration'
    });
  }
  
  return {
    hasOverlap,
    overlapDays,
    isIdentical,
    periodADays,
    periodBDays,
    daysDifference,
    warnings
  };
}

export default function RepCoachingSummary() {
  const { user, role } = useAuth();
  const { repId } = useParams<{ repId?: string }>();
  const queryClient = useQueryClient();
  
  // Debounce timer ref
  const dateChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Date range state (internal for immediate UI updates)
  const [dateRangeInternal, setDateRangeInternal] = useState<{ from: Date; to: Date }>(() => createDateRange(30));
  // Debounced date range (triggers query)
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => createDateRange(30));
  const [selectedPreset, setSelectedPreset] = useState<string>('30');
  
  // Manual generation control - user must click to generate
  const [generateRequested, setGenerateRequested] = useState(false);
  
  // Comparison mode state
  const [isComparisonMode, setIsComparisonMode] = useState(false);
  const [comparisonConfirmed, setComparisonConfirmed] = useState(false);
  const [comparisonDateRangeInternal, setComparisonDateRangeInternal] = useState<{ from: Date; to: Date }>(() => 
    createPreviousPeriodRange(createDateRange(30))
  );
  const [comparisonDateRange, setComparisonDateRange] = useState<{ from: Date; to: Date }>(() => 
    createPreviousPeriodRange(createDateRange(30))
  );
  const [comparisonPreset, setComparisonPreset] = useState<string>('previous');
  
  // History sheet state
  const [showHistory, setShowHistory] = useState(false);
  const [loadedAnalysis, setLoadedAnalysis] = useState<CoachingTrendAnalysis | null>(null);
  
  // Export dialog state
  const [showExportDialog, setShowExportDialog] = useState(false);
  
  // Comparison from history state
  const [historyComparisonAnalysis, setHistoryComparisonAnalysis] = useState<{
    analysis: CoachingTrendAnalysis;
    dateRange: { from: Date; to: Date };
  } | null>(null);
  
  // Determine if viewing own summary or another rep's (for managers)
  const targetRepId = repId || user?.id;
  const isOwnSummary = !repId || repId === user?.id;

  // Debounced date range update helper
  const debounceDateRangeUpdate = useCallback((
    newRange: { from: Date; to: Date },
    setInternal: React.Dispatch<React.SetStateAction<{ from: Date; to: Date }>>,
    setDebounced: React.Dispatch<React.SetStateAction<{ from: Date; to: Date }>>,
    additionalCallback?: () => void
  ) => {
    // Update internal state immediately for UI responsiveness
    setInternal(newRange);
    
    // Clear existing timer
    if (dateChangeTimerRef.current) {
      clearTimeout(dateChangeTimerRef.current);
    }
    
    // Set debounced update
    dateChangeTimerRef.current = setTimeout(() => {
      setDebounced(newRange);
      additionalCallback?.();
    }, DATE_CHANGE_DEBOUNCE);
  }, []);

  // Fetch rep profile if viewing another rep
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

  // AI Trend Analysis query (Period A / Main period) - only runs when user clicks generate
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
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Comparison period query (Period B) - only runs when comparison mode is confirmed
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

  // Call count preview - shows how many calls will be analyzed
  const { data: callCountPreview, isLoading: isLoadingCallCount } = useQuery({
    queryKey: ['call-count-preview', targetRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('call_transcripts')
        .select('*', { count: 'exact', head: true })
        .eq('rep_id', targetRepId!)
        .eq('analysis_status', 'completed')
        .gte('call_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));
      
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!targetRepId && !generateRequested && !loadedAnalysis,
    staleTime: 30 * 1000, // 30 seconds
  });

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    setLoadedAnalysis(null); // Clear loaded analysis when date changes
    setGenerateRequested(false); // Reset generate state when date changes
    if (value !== 'custom') {
      const newRange = createDateRange(parseInt(value));
      // Update both internal and debounced immediately for presets
      setDateRangeInternal(newRange);
      setDateRange(newRange);
      // Update comparison range to previous period
      if (isComparisonMode && comparisonPreset === 'previous') {
        const compRange = createPreviousPeriodRange(newRange);
        setComparisonDateRangeInternal(compRange);
        setComparisonDateRange(compRange);
      }
      // Reset comparison confirmed when date changes
      if (isComparisonMode) {
        setComparisonConfirmed(false);
      }
    }
  };

  const handleFromDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      const newRange = { ...dateRangeInternal, from: date };
      setSelectedPreset('custom');
      setLoadedAnalysis(null);
      setGenerateRequested(false); // Reset generate state when date changes
      
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
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      const newRange = { ...dateRangeInternal, to: date };
      setSelectedPreset('custom');
      setLoadedAnalysis(null);
      setGenerateRequested(false); // Reset generate state when date changes
      
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
  };

  const handleComparisonPresetChange = (value: string) => {
    setComparisonPreset(value);
    if (value === 'previous') {
      const compRange = createPreviousPeriodRange(dateRange);
      setComparisonDateRangeInternal(compRange);
      setComparisonDateRange(compRange);
    }
    setComparisonConfirmed(false);
  };

  const handleComparisonFromDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      const newRange = { ...comparisonDateRangeInternal, from: date };
      setComparisonPreset('custom');
      
      debounceDateRangeUpdate(newRange, setComparisonDateRangeInternal, setComparisonDateRange, () => {
        setComparisonConfirmed(false);
      });
    }
  };

  const handleComparisonToDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      const newRange = { ...comparisonDateRangeInternal, to: date };
      setComparisonPreset('custom');
      
      debounceDateRangeUpdate(newRange, setComparisonDateRangeInternal, setComparisonDateRange, () => {
        setComparisonConfirmed(false);
      });
    }
  };

  const handleComparisonToggle = (checked: boolean) => {
    setIsComparisonMode(checked);
    if (checked) {
      // Reset comparison date range to previous period
      const compRange = createPreviousPeriodRange(dateRange);
      setComparisonDateRangeInternal(compRange);
      setComparisonDateRange(compRange);
      setComparisonPreset('previous');
      setComparisonConfirmed(false);
    } else {
      setComparisonConfirmed(false);
    }
  };

  const handleForceRefresh = () => {
    // Force refresh bypasses cache
    setLoadedAnalysis(null); // Clear any loaded analysis
    setGenerateRequested(true); // Ensure generation is triggered
    generateCoachingTrends(targetRepId!, dateRange, { forceRefresh: true })
      .then(() => refetch());
  };

  const handleGenerateTrends = () => {
    setGenerateRequested(true);
  };

  const handleLoadFromHistory = (analysis: CoachingTrendAnalysis, historyDateRange: { from: Date; to: Date }) => {
    // Set the date range to match the loaded analysis
    setDateRange(historyDateRange);
    setDateRangeInternal(historyDateRange);
    setSelectedPreset('custom');
    setLoadedAnalysis(analysis);
    setGenerateRequested(true); // Mark as generated since we loaded from history
    setHistoryComparisonAnalysis(null); // Clear any history comparison
    // Invalidate history query to refresh the list
    queryClient.invalidateQueries({ queryKey: ['coaching-trend-history', targetRepId] });
  };

  const handleCompareFromHistory = (analysis: CoachingTrendAnalysis, historyDateRange: { from: Date; to: Date }) => {
    // Set up comparison: history analysis (Period A) vs current analysis (Period B)
    setHistoryComparisonAnalysis({ analysis, dateRange: historyDateRange });
    setIsComparisonMode(true);
    setComparisonConfirmed(true);
  };

  const handleExitHistoryComparison = () => {
    setHistoryComparisonAnalysis(null);
    setIsComparisonMode(false);
    setComparisonConfirmed(false);
  };

  const getBackPath = () => {
    if ((role === 'manager' || role === 'admin') && repId) return getRepDetailUrl(repId);
    return getDashboardUrl(role);
  };

  const getBreadcrumbItems = () => {
    if ((role === 'manager' || role === 'admin') && repId) {
      return [
        { label: repProfile?.name || 'Rep', href: getRepDetailUrl(repId) },
        { label: 'Coaching Trends' }
      ];
    }
    return [{ label: 'Coaching Trends' }];
  };

  const getTrendIcon = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-destructive" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getTrendBadge = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Improving</Badge>;
      case 'declining':
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Declining</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  const isAnyLoading = isLoading || (isComparisonMode && comparisonConfirmed && isComparisonLoading);
  const isAnyFetching = isFetching || (isComparisonMode && comparisonConfirmed && isComparisonFetching);

  // Validate comparison periods
  const periodValidation = isComparisonMode 
    ? validatePeriods(comparisonDateRange, dateRange)
    : null;
  
  const hasValidationErrors = periodValidation?.warnings.some(w => w.type === 'error') ?? false;

  // Extract analysis and metadata from query results
  const currentAnalysis: CoachingTrendAnalysis | null = useMemo(() => {
    if (loadedAnalysis) return loadedAnalysis;
    if (trendAnalysis) return trendAnalysis.analysis;
    return null;
  }, [loadedAnalysis, trendAnalysis]);
  
  const currentMetadata: AnalysisMetadata | null = useMemo(() => {
    if (loadedAnalysis) return null; // No metadata for loaded historical analyses
    if (trendAnalysis) return trendAnalysis.metadata;
    return null;
  }, [loadedAnalysis, trendAnalysis]);

  const comparisonAnalysis: CoachingTrendAnalysis | null = useMemo(() => {
    if (comparisonTrendAnalysis) return comparisonTrendAnalysis.analysis;
    return null;
  }, [comparisonTrendAnalysis]);

  // Use loaded analysis from history, or fetched analysis
  const displayAnalysis = currentAnalysis;
  
  // Determine analysis tier for UI display
  const previewTier = useMemo((): AnalysisTier | null => {
    if (callCountPreview === null || callCountPreview === undefined) return null;
    return determineAnalysisTier(callCountPreview);
  }, [callCountPreview]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb items={getBreadcrumbItems()} />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                {isOwnSummary ? 'My Coaching Trends' : `${repProfile?.name || 'Rep'}'s Coaching Trends`}
              </h1>
              <p className="text-muted-foreground">
                AI-powered trend analysis of your sales calls
              </p>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Comparison Mode Toggle - only show when results are available */}
              {(generateRequested || loadedAnalysis) && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                  <GitCompare className="h-4 w-4 text-muted-foreground" />
                  <Switch 
                    id="comparison-mode"
                    checked={isComparisonMode} 
                    onCheckedChange={handleComparisonToggle}
                  />
                  <Label htmlFor="comparison-mode" className="text-sm cursor-pointer">
                    Compare Periods
                  </Label>
                </div>
              )}
              
              {/* Refresh Button - only show when results are available */}
              {(generateRequested || loadedAnalysis) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleForceRefresh}
                        disabled={isAnyFetching}
                      >
                        <RefreshCw className={cn("h-4 w-4 mr-2", isAnyFetching && "animate-spin")} />
                        Refresh
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Force refresh bypasses cache</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              
              {/* History Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowHistory(true)}
              >
                <History className="h-4 w-4 mr-2" />
                History
              </Button>
              
              {/* Export/Share Button */}
              {displayAnalysis && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowExportDialog(true)}
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Export
                </Button>
              )}
            </div>
          </div>
          
          {/* Date Range Controls */}
          <div className="flex flex-wrap items-start gap-4 p-4 bg-muted/50 rounded-lg">
            {/* Primary Date Range */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {isComparisonMode ? 'Period B (Recent)' : 'Time Period'}
              </Label>
              <div className="flex items-center gap-2">
                <Select value={selectedPreset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
                
                {selectedPreset === 'custom' && (
                  <>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(dateRangeInternal.from, 'MMM d, yy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRangeInternal.from}
                          onSelect={handleFromDateChange}
                          disabled={(date) => date > dateRangeInternal.to || date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <span className="text-muted-foreground text-sm">to</span>
                    
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {format(dateRangeInternal.to, 'MMM d, yy')}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateRangeInternal.to}
                          onSelect={handleToDateChange}
                          disabled={(date) => date < dateRangeInternal.from || date > new Date()}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </>
                )}
              </div>
            </div>

            {/* Comparison Date Range */}
            {isComparisonMode && (
              <>
                <div className="flex items-center self-end pb-2">
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Period A (Earlier)</Label>
                  <div className="flex items-center gap-2">
                    <Select value={comparisonPreset} onValueChange={handleComparisonPresetChange}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="previous">Previous Period</SelectItem>
                        <SelectItem value="custom">Custom Range</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {comparisonPreset === 'custom' && (
                      <>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(comparisonDateRangeInternal.from, 'MMM d, yy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={comparisonDateRangeInternal.from}
                              onSelect={handleComparisonFromDateChange}
                              disabled={(date) => date > comparisonDateRangeInternal.to || date > new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                        
                        <span className="text-muted-foreground text-sm">to</span>
                        
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {format(comparisonDateRangeInternal.to, 'MMM d, yy')}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={comparisonDateRangeInternal.to}
                              onSelect={handleComparisonToDateChange}
                              disabled={(date) => date < comparisonDateRangeInternal.from || date > new Date()}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </>
                    )}
                  </div>
                </div>

                {/* Run Comparison Button */}
                <div className="flex items-end">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span>
                          <Button 
                            onClick={() => setComparisonConfirmed(true)}
                            disabled={(comparisonConfirmed && isComparisonFetching) || hasValidationErrors}
                          >
                            {comparisonConfirmed && isComparisonFetching ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <BarChart3 className="h-4 w-4 mr-2" />
                            )}
                            {comparisonConfirmed ? 'Re-run Comparison' : 'Run Comparison'}
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {hasValidationErrors && (
                        <TooltipContent>
                          <p>Fix period errors before comparing</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </>
            )}
            
            {/* Period Validation Warnings with Quick Fixes */}
            {isComparisonMode && periodValidation && periodValidation.warnings.length > 0 && (
              <div className="w-full space-y-2 mt-2">
                {periodValidation.warnings.map((warning, index) => (
                  <Alert 
                    key={index} 
                    variant={warning.type === 'error' ? 'destructive' : 'default'}
                    className={cn(
                      "py-2",
                      warning.type === 'warning' && "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                      warning.type === 'info' && "border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-400"
                    )}
                  >
                    {warning.type === 'error' && <AlertTriangle className="h-4 w-4" />}
                    {warning.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    {warning.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
                    <AlertDescription className="text-sm flex items-center justify-between gap-4">
                      <span>{warning.message}</span>
                      {warning.quickFix && (
                        <Button
                          variant="outline"
                          size="sm"
                          className={cn(
                            "shrink-0 h-7 text-xs",
                            warning.type === 'error' && "border-destructive/50 hover:bg-destructive/10",
                            warning.type === 'warning' && "border-yellow-500/50 hover:bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                            warning.type === 'info' && "border-blue-500/50 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          )}
                          onClick={() => {
                            if (warning.quickFix === 'use-previous-period') {
                              // Set Period A to the previous period
                              setComparisonDateRange(createPreviousPeriodRange(dateRange));
                              setComparisonPreset('previous');
                              setComparisonConfirmed(false);
                            } else if (warning.quickFix === 'shift-period-a') {
                              // Shift Period A back to eliminate overlap
                              const periodBDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
                              const newTo = new Date(dateRange.from);
                              newTo.setDate(newTo.getDate() - 1);
                              newTo.setHours(23, 59, 59, 999);
                              const newFrom = new Date(newTo);
                              newFrom.setDate(newFrom.getDate() - periodBDays);
                              newFrom.setHours(0, 0, 0, 0);
                              setComparisonDateRange({ from: newFrom, to: newTo });
                              setComparisonPreset('custom');
                              setComparisonConfirmed(false);
                            } else if (warning.quickFix === 'match-duration') {
                              // Match Period A duration to Period B
                              const periodBDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
                              const newFrom = new Date(comparisonDateRange.to);
                              newFrom.setDate(newFrom.getDate() - periodBDays);
                              newFrom.setHours(0, 0, 0, 0);
                              setComparisonDateRange(prev => ({ ...prev, from: newFrom }));
                              setComparisonPreset('custom');
                              setComparisonConfirmed(false);
                            }
                          }}
                        >
                          {warning.quickFix === 'use-previous-period' && 'Use Previous Period'}
                          {warning.quickFix === 'shift-period-a' && 'Fix Overlap'}
                          {warning.quickFix === 'match-duration' && 'Match Duration'}
                        </Button>
                      )}
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Initial State - Before Generation */}
        {!generateRequested && !loadedAnalysis ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-6 max-w-lg mx-auto text-center">
                <div className="relative">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Sparkles className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">AI-Powered Coaching Trends</h3>
                  <p className="text-muted-foreground">
                    Get personalized insights from your sales calls. Our AI will analyze your calls 
                    to identify patterns, strengths, and areas for improvement.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {format(dateRangeInternal.from, 'MMM d, yyyy')} - {format(dateRangeInternal.to, 'MMM d, yyyy')}
                    </span>
                  </div>
                  
                  {/* Call count preview with tier indicator */}
                  <div className="flex flex-col items-center gap-2 px-4 py-2 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      {isLoadingCallCount ? (
                        <span className="text-sm text-muted-foreground">Counting calls...</span>
                      ) : callCountPreview === 0 ? (
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          No analyzed calls found in this period
                        </span>
                      ) : (
                        <span className="text-sm font-medium">
                          <span className="text-primary">{callCountPreview}</span>
                          <span className="text-muted-foreground"> call{callCountPreview !== 1 ? 's' : ''} to analyze</span>
                        </span>
                      )}
                    </div>
                    {/* Tier indicator */}
                    {previewTier && callCountPreview && callCountPreview > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-xs gap-1",
                                previewTier === 'direct' && "border-green-500/50 text-green-600",
                                previewTier === 'sampled' && "border-amber-500/50 text-amber-600",
                                previewTier === 'hierarchical' && "border-orange-500/50 text-orange-600"
                              )}
                            >
                              {previewTier === 'direct' && <Zap className="h-3 w-3" />}
                              {previewTier === 'sampled' && <Layers className="h-3 w-3" />}
                              {previewTier === 'hierarchical' && <Layers className="h-3 w-3" />}
                              {previewTier === 'direct' ? 'Direct Analysis' : 
                               previewTier === 'sampled' ? 'Smart Sampling' : 'Two-Stage Analysis'}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            {previewTier === 'direct' && (
                              <p>All {callCountPreview} calls will be analyzed directly for optimal quality.</p>
                            )}
                            {previewTier === 'sampled' && (
                              <p>Large dataset ({callCountPreview} calls). A representative sample of ~{DIRECT_ANALYSIS_MAX} calls will be analyzed using stratified sampling.</p>
                            )}
                            {previewTier === 'hierarchical' && (
                              <p>Very large dataset ({callCountPreview} calls). Analysis will use a two-stage hierarchical approach for comprehensive insights.</p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                  
                  <Button 
                    size="lg" 
                    onClick={handleGenerateTrends}
                    className="mt-2"
                    disabled={callCountPreview === 0}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Trends
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {callCountPreview === 0 
                      ? 'Submit calls to generate trends' 
                      : previewTier === 'hierarchical' 
                        ? 'Two-stage analysis may take 1-2 minutes'
                        : 'Analysis takes 15-30 seconds'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isAnyLoading ? (
          <div className="space-y-6">
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium">
                      {isComparisonMode && comparisonConfirmed ? 'Analyzing both periods...' : 'Analyzing your calls...'}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Our AI is reviewing your call data to identify trends and patterns.
                      <br />
                      This may take 15-30 seconds{isComparisonMode && comparisonConfirmed ? ' per period' : ''}.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32 mt-2" />
                    <Skeleton className="h-20 w-full mt-4" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : error || (isComparisonMode && comparisonConfirmed && comparisonError) ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Unable to Generate Analysis</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                {error instanceof Error ? error.message : comparisonError instanceof Error ? comparisonError.message : 'Failed to generate coaching trends'}
              </p>
              {isOwnSummary && (
                <Button asChild className="mt-4">
                  <Link to={getDashboardUrl('rep')}>Submit a Call</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : historyComparisonAnalysis && displayAnalysis ? (
          /* History Comparison View */
          <div className="space-y-4">
            <Alert className="border-primary/50 bg-primary/5">
              <GitCompare className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>Comparing snapshot from history with current analysis</span>
                <Button variant="outline" size="sm" onClick={handleExitHistoryComparison}>
                  Exit Comparison
                </Button>
              </AlertDescription>
            </Alert>
            <CoachingTrendsComparison
              periodA={{
                label: 'Snapshot (Earlier)',
                dateRange: historyComparisonAnalysis.dateRange,
                analysis: historyComparisonAnalysis.analysis,
              }}
              periodB={{
                label: 'Current Period',
                dateRange: dateRange,
                analysis: displayAnalysis,
              }}
            />
          </div>
        ) : isComparisonMode && comparisonConfirmed && displayAnalysis && comparisonAnalysis ? (
          /* Comparison View */
          <CoachingTrendsComparison
            periodA={{
              label: 'Period A',
              dateRange: comparisonDateRange,
              analysis: comparisonAnalysis,
            }}
            periodB={{
              label: 'Period B',
              dateRange: dateRange,
              analysis: displayAnalysis,
            }}
          />
        ) : displayAnalysis && (
          /* Single Period View */
          <>
            {/* Executive Summary */}
            <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Executive Summary
                  </CardTitle>
                  {dataUpdatedAt && !loadedAnalysis && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="outline" className="text-xs gap-1">
                            <Database className="h-3 w-3" />
                            Cached
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Last updated: {format(new Date(dataUpdatedAt), 'MMM d, h:mm a')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  {loadedAnalysis && (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <History className="h-3 w-3" />
                      From History
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{displayAnalysis.summary}</p>
                
                {/* Period Stats */}
                <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Calls Analyzed:</span>
                    <span className="font-semibold">{displayAnalysis.periodAnalysis.totalCalls}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Avg Heat Score:</span>
                    <span className="font-semibold">{displayAnalysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</span>
                    {getTrendIcon(displayAnalysis.periodAnalysis.heatScoreTrend)}
                  </div>
                </div>
                
                {/* Analysis Metadata - shows tier, sampling, and hierarchical info */}
                {currentMetadata && (
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-dashed">
                    {/* Tier Badge */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-xs gap-1",
                              currentMetadata.tier === 'direct' && "border-green-500/50 text-green-600 bg-green-500/5",
                              currentMetadata.tier === 'sampled' && "border-amber-500/50 text-amber-600 bg-amber-500/5",
                              currentMetadata.tier === 'hierarchical' && "border-orange-500/50 text-orange-600 bg-orange-500/5"
                            )}
                          >
                            {currentMetadata.tier === 'direct' && <Zap className="h-3 w-3" />}
                            {currentMetadata.tier === 'sampled' && <Layers className="h-3 w-3" />}
                            {currentMetadata.tier === 'hierarchical' && <Layers className="h-3 w-3" />}
                            {currentMetadata.tier === 'direct' ? 'Direct Analysis' : 
                             currentMetadata.tier === 'sampled' ? 'Smart Sampling' : 'Two-Stage Analysis'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {currentMetadata.tier === 'direct' && (
                            <p>All {currentMetadata.totalCalls} calls were analyzed directly for optimal quality.</p>
                          )}
                          {currentMetadata.tier === 'sampled' && (
                            <p>Used stratified sampling to analyze a representative subset of calls.</p>
                          )}
                          {currentMetadata.tier === 'hierarchical' && (
                            <p>Used two-stage hierarchical analysis to process this large dataset comprehensively.</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Sampling Info */}
                    {currentMetadata.samplingInfo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {currentMetadata.samplingInfo.sampledCount}
                        </span>
                        <span>of</span>
                        <span className="font-medium text-foreground">
                          {currentMetadata.samplingInfo.originalCount}
                        </span>
                        <span>calls sampled</span>
                      </div>
                    )}
                    
                    {/* Hierarchical Info */}
                    {currentMetadata.hierarchicalInfo && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                              <span className="font-medium text-foreground">
                                {currentMetadata.hierarchicalInfo.chunksAnalyzed}
                              </span>
                              <span>chunks analyzed</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <div className="space-y-1">
                              <p className="font-medium">Calls per chunk:</p>
                              <div className="flex flex-wrap gap-1">
                                {currentMetadata.hierarchicalInfo.callsPerChunk.map((count, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">
                                    Chunk {idx + 1}: {count}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Framework Trends */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Framework Trends
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <TrendCard
                  title="BANT"
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                  trend={displayAnalysis.trendAnalysis.bant.trend}
                  startingAvg={displayAnalysis.trendAnalysis.bant.startingAvg}
                  endingAvg={displayAnalysis.trendAnalysis.bant.endingAvg}
                  keyInsight={displayAnalysis.trendAnalysis.bant.keyInsight}
                  evidence={displayAnalysis.trendAnalysis.bant.evidence}
                  recommendation={displayAnalysis.trendAnalysis.bant.recommendation}
                />
                <TrendCard
                  title="Gap Selling"
                  icon={<MessageSquareQuote className="h-4 w-4 text-purple-500" />}
                  trend={displayAnalysis.trendAnalysis.gapSelling.trend}
                  startingAvg={displayAnalysis.trendAnalysis.gapSelling.startingAvg}
                  endingAvg={displayAnalysis.trendAnalysis.gapSelling.endingAvg}
                  keyInsight={displayAnalysis.trendAnalysis.gapSelling.keyInsight}
                  evidence={displayAnalysis.trendAnalysis.gapSelling.evidence}
                  recommendation={displayAnalysis.trendAnalysis.gapSelling.recommendation}
                />
                <TrendCard
                  title="Active Listening"
                  icon={<Ear className="h-4 w-4 text-teal-500" />}
                  trend={displayAnalysis.trendAnalysis.activeListening.trend}
                  startingAvg={displayAnalysis.trendAnalysis.activeListening.startingAvg}
                  endingAvg={displayAnalysis.trendAnalysis.activeListening.endingAvg}
                  keyInsight={displayAnalysis.trendAnalysis.activeListening.keyInsight}
                  evidence={displayAnalysis.trendAnalysis.activeListening.evidence}
                  recommendation={displayAnalysis.trendAnalysis.activeListening.recommendation}
                />
              </div>
            </div>

            {/* Pattern Analysis */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Critical Info Trends */}
              <CriticalInfoTrends
                persistentGaps={displayAnalysis.patternAnalysis.criticalInfoMissing.persistentGaps}
                newIssues={displayAnalysis.patternAnalysis.criticalInfoMissing.newIssues}
                resolvedIssues={displayAnalysis.patternAnalysis.criticalInfoMissing.resolvedIssues}
                recommendation={displayAnalysis.patternAnalysis.criticalInfoMissing.recommendation}
              />

              {/* Follow-up Questions Analysis */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <MessageSquareQuote className="h-5 w-5 text-blue-500" />
                    Follow-up Question Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Quality Trend</span>
                    {getTrendBadge(displayAnalysis.patternAnalysis.followUpQuestions.qualityTrend)}
                  </div>

                  {displayAnalysis.patternAnalysis.followUpQuestions.recurringThemes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Recurring Themes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {displayAnalysis.patternAnalysis.followUpQuestions.recurringThemes.map((theme, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {displayAnalysis.patternAnalysis.followUpQuestions.recommendation && (
                    <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                      <p className="font-medium mb-1">Recommendation</p>
                      <p className="text-muted-foreground">
                        {displayAnalysis.patternAnalysis.followUpQuestions.recommendation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Priorities */}
            <PriorityActionCard priorities={displayAnalysis.topPriorities} />
          </>
        )}
      </div>
      
      {/* History Sheet */}
      <CoachingTrendHistorySheet
        open={showHistory}
        onOpenChange={setShowHistory}
        repId={targetRepId!}
        onLoadAnalysis={handleLoadFromHistory}
        onCompareWithCurrent={handleCompareFromHistory}
        hasCurrentAnalysis={!!displayAnalysis}
      />
      
      {/* Export/Share Dialog */}
      {displayAnalysis && (
        <ExportShareDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          analysis={displayAnalysis}
          dateRange={dateRange}
          repName={isOwnSummary ? user?.email?.split('@')[0] || 'Rep' : repProfile?.name || 'Rep'}
        />
      )}
    </AppLayout>
  );
}
