import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { useDateRangeSelector, type DatePreset } from '@/hooks/useDateRangeSelector';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getManagerPageBreadcrumb } from '@/lib/breadcrumbConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import {
  generateAggregateCoachingTrends,
  DIRECT_ANALYSIS_MAX,
  determineAnalysisTier,
  AnalysisTier,
} from '@/api/aiCallAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { useManagerTeams, useRepsWithEmail, useTeamRepIds } from '@/hooks';
import { TrendCard } from '@/components/coaching/TrendCard';
import { CriticalInfoTrends } from '@/components/coaching/CriticalInfoTrends';
import { PriorityActionCard } from '@/components/coaching/PriorityActionCard';
import { RepContributionBreakdown } from '@/components/coaching/RepContributionBreakdown';
import { cn } from '@/lib/utils';
import {
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
  Building2,
  Users,
  User,
  Layers,
  Zap,
  Timer,
  GitBranch,
  MessageCircleWarning,
} from 'lucide-react';
import {
  BehaviorTrendCard,
  createPatienceProps,
  createStrategicThreadingProps,
  createMonologueProps,
} from '@/components/coaching/BehaviorTrendCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type ManagerScope = 'team' | 'rep';

export default function ManagerCoachingTrends() {
  const { user } = useAuth();

  // Scope and filter state — managers can pick team or individual rep (no org-level)
  const [scope, setScope] = useState<ManagerScope>('team');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [selectedRepId, setSelectedRepId] = useState<string>('');

  // Manual generation control
  const [generateRequested, setGenerateRequested] = useState(false);

  // Date range hook
  const {
    dateRange,
    selectedPreset,
    presets: TIME_RANGES,
    handlePresetChange: onPresetChange,
    handleFromDateChange,
    handleToDateChange,
  } = useDateRangeSelector({
    initialPreset: '30',
    onChange: () => setGenerateRequested(false),
  });

  // Fetch teams managed by this manager
  const { data: teams } = useManagerTeams(user?.id);

  // Auto-select the first team when teams load
  useMemo(() => {
    if (teams && teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  // Fetch reps filtered to the selected team
  const { data: reps } = useRepsWithEmail({
    teamId: selectedTeamId || undefined,
  });

  // Get team rep IDs for call count filtering
  const { data: teamRepIds } = useTeamRepIds(scope === 'team' ? selectedTeamId : undefined);

  // Call count preview
  const { data: callCountPreview, isLoading: isLoadingCallCount } = useQuery({
    queryKey: ['manager-call-count-preview', scope, selectedTeamId, selectedRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: async () => {
      let query = supabase
        .from('call_transcripts')
        .select('rep_id', { count: 'exact', head: true })
        .eq('analysis_status', 'completed')
        .gte('call_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (scope === 'rep' && selectedRepId) {
        query = query.eq('rep_id', selectedRepId);
      } else if (scope === 'team' && selectedTeamId && teamRepIds && teamRepIds.length > 0) {
        query = query.in('rep_id', teamRepIds);
      } else if (scope === 'team' && selectedTeamId) {
        return 0;
      }

      const { count, error } = await query;
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !generateRequested && (
      (scope === 'team' && !!selectedTeamId) ||
      (scope === 'rep' && !!selectedRepId)
    ),
    staleTime: 30 * 1000,
  });

  // Rep count for the selected team
  const { data: repCountPreview } = useQuery({
    queryKey: ['manager-rep-count-preview', selectedTeamId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_with_role')
        .select('id', { count: 'exact', head: true })
        .eq('role', 'rep')
        .eq('is_active', true)
        .eq('team_id', selectedTeamId);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: scope === 'team' && !!selectedTeamId,
  });

  // Main analysis query
  const {
    data: analysisResult,
    isLoading,
    error,
    isFetching,
  } = useQuery({
    queryKey: ['manager-coaching-trends', scope, selectedTeamId, selectedRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => generateAggregateCoachingTrends({
      scope,
      teamId: scope === 'team' ? selectedTeamId : undefined,
      repId: scope === 'rep' ? selectedRepId : undefined,
      dateRange,
    }),
    enabled: generateRequested && (
      (scope === 'team' && !!selectedTeamId) ||
      (scope === 'rep' && !!selectedRepId)
    ),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handlePresetChange = (value: string) => {
    onPresetChange(value as DatePreset);
  };

  const handleScopeChange = (newScope: ManagerScope) => {
    setScope(newScope);
    setGenerateRequested(false);
    if (newScope === 'team') {
      setSelectedRepId('');
    }
  };

  const handleGenerateTrends = () => {
    setGenerateRequested(true);
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

  const previewTier = useMemo((): AnalysisTier | null => {
    if (callCountPreview === null || callCountPreview === undefined) return null;
    return determineAnalysisTier(callCountPreview);
  }, [callCountPreview]);

  const canGenerate =
    (scope === 'team' && !!selectedTeamId) ||
    (scope === 'rep' && !!selectedRepId);

  const scopeLabel = scope === 'team'
    ? teams?.find(t => t.id === selectedTeamId)?.name ?? 'Team'
    : reps?.find(r => r.id === selectedRepId)?.name ?? 'Rep';

  const displayAnalysis = analysisResult?.analysis;
  const displayMetadata = analysisResult?.metadata;

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageBreadcrumb items={getManagerPageBreadcrumb('coachingTrends')} />

        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                Team Coaching Trends
              </h1>
              <p className="text-muted-foreground">
                AI-powered trend analysis for your team
              </p>
            </div>
            <Badge variant="outline" className="self-start">
              Manager View
            </Badge>
          </div>
        </div>

        {/* Scope and Date Range Controls */}
        <div className="flex flex-wrap items-start gap-4 p-4 bg-muted/50 rounded-lg">
          {/* Scope Selector */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Analysis Scope</Label>
            <div className="flex items-center gap-2">
              <Select value={scope} onValueChange={(v) => handleScopeChange(v as ManagerScope)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="team">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Team
                    </div>
                  </SelectItem>
                  <SelectItem value="rep">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Individual Rep
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Team Selector (shown for both scopes when manager has multiple teams) */}
              {teams && teams.length > 1 && (
                <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedRepId(''); setGenerateRequested(false); }}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Rep Selector */}
              {scope === 'rep' && (
                <Select value={selectedRepId} onValueChange={(v) => { setSelectedRepId(v); setGenerateRequested(false); }}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select rep..." />
                  </SelectTrigger>
                  <SelectContent>
                    {reps?.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Date Range */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Time Period</Label>
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
                        {format(dateRange.from, 'MMM d, yy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.from}
                        onSelect={handleFromDateChange}
                        disabled={(date) => date > dateRange.to || date > new Date()}
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
                        {format(dateRange.to, 'MMM d, yy')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={dateRange.to}
                        onSelect={handleToDateChange}
                        disabled={(date) => date < dateRange.from || date > new Date()}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Initial State - Before Generation */}
        {!generateRequested ? (
          <Card className="border-dashed border-2">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center gap-6 max-w-lg mx-auto text-center">
                <div className="relative">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <Sparkles className="h-12 w-12 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">
                    {scope === 'team' ? 'Team-Level' : 'Individual'} Coaching Analysis
                  </h3>
                  <p className="text-muted-foreground">
                    {scope === 'team'
                      ? 'Analyze coaching trends for your team to identify strengths and areas for improvement.'
                      : 'Analyze coaching trends for an individual rep on your team.'}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-3 w-full">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarIcon className="h-4 w-4" />
                    <span>
                      {format(dateRange.from, 'MMM d, yyyy')} - {format(dateRange.to, 'MMM d, yyyy')}
                    </span>
                  </div>

                  {/* Scope and call count preview */}
                  <div className="flex flex-col items-center gap-2 px-4 py-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      {scope === 'team' && <Building2 className="h-4 w-4 text-primary" />}
                      {scope === 'rep' && <User className="h-4 w-4 text-primary" />}
                      <span className="font-medium">{scopeLabel}</span>
                      {scope === 'team' && repCountPreview !== undefined && (
                        <span className="text-muted-foreground">
                          ({repCountPreview} rep{repCountPreview !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>

                    {/* Call count */}
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      {isLoadingCallCount ? (
                        <span className="text-sm text-muted-foreground">Counting calls...</span>
                      ) : !canGenerate ? (
                        <span className="text-sm text-amber-600 dark:text-amber-400">
                          Select a {scope === 'team' ? 'team' : 'rep'} to continue
                        </span>
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
                              <p>Large dataset ({callCountPreview} calls). A representative sample of ~{DIRECT_ANALYSIS_MAX} calls will be analyzed.</p>
                            )}
                            {previewTier === 'hierarchical' && (
                              <p>Very large dataset ({callCountPreview} calls). Two-stage hierarchical analysis will be used.</p>
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
                    disabled={!canGenerate || callCountPreview === 0}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate {scope === 'team' ? 'Team' : ''} Trends
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">
                    {!canGenerate
                      ? `Select a ${scope === 'team' ? 'team' : 'rep'} to generate trends`
                      : callCountPreview === 0
                        ? 'No calls to analyze in this period'
                        : previewTier === 'hierarchical'
                          ? 'Two-stage analysis may take 1-2 minutes'
                          : 'Analysis takes 15-30 seconds'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : isLoading || isFetching ? (
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
                      Analyzing {scopeLabel} coaching data...
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Our AI is reviewing call data to identify trends and patterns.
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
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">Unable to Generate Analysis</h3>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto">
                {error instanceof Error ? error.message : 'Failed to generate coaching trends'}
              </p>
              <Button className="mt-4" onClick={() => setGenerateRequested(false)}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        ) : displayAnalysis && (
          <>
            {/* Executive Summary */}
            <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Team Summary - {scopeLabel}
                  </CardTitle>
                  <Badge variant="outline" className="gap-1">
                    {scope === 'team' && <Building2 className="h-3 w-3" />}
                    {scope === 'rep' && <User className="h-3 w-3" />}
                    {scope === 'team' ? 'Team' : 'Individual'} Analysis
                  </Badge>
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
                  {displayMetadata && scope === 'team' && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Reps Included:</span>
                      <span className="font-semibold">{displayMetadata.repsIncluded}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Avg Heat Score:</span>
                    <span className="font-semibold">{displayAnalysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</span>
                    {getTrendIcon(displayAnalysis.periodAnalysis.heatScoreTrend)}
                  </div>
                </div>

                {/* Analysis Metadata */}
                {displayMetadata && (
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-dashed">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs gap-1",
                              displayMetadata.tier === 'direct' && "border-green-500/50 text-green-600 bg-green-500/5",
                              displayMetadata.tier === 'sampled' && "border-amber-500/50 text-amber-600 bg-amber-500/5",
                              displayMetadata.tier === 'hierarchical' && "border-orange-500/50 text-orange-600 bg-orange-500/5"
                            )}
                          >
                            {displayMetadata.tier === 'direct' && <Zap className="h-3 w-3" />}
                            {displayMetadata.tier === 'sampled' && <Layers className="h-3 w-3" />}
                            {displayMetadata.tier === 'hierarchical' && <Layers className="h-3 w-3" />}
                            {displayMetadata.tier === 'direct' ? 'Direct Analysis' :
                             displayMetadata.tier === 'sampled' ? 'Smart Sampling' : 'Two-Stage Analysis'}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {displayMetadata.tier === 'direct' && (
                            <p>All {displayMetadata.totalCalls} calls were analyzed directly.</p>
                          )}
                          {displayMetadata.tier === 'sampled' && (
                            <p>Used stratified sampling to analyze a representative subset.</p>
                          )}
                          {displayMetadata.tier === 'hierarchical' && (
                            <p>Used two-stage hierarchical analysis for this large dataset.</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {displayMetadata.samplingInfo && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{displayMetadata.samplingInfo.sampledCount}</span>
                        <span>of</span>
                        <span className="font-medium text-foreground">{displayMetadata.samplingInfo.originalCount}</span>
                        <span>calls sampled</span>
                      </div>
                    )}

                    {displayMetadata.hierarchicalInfo && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-help">
                              <span className="font-medium text-foreground">{displayMetadata.hierarchicalInfo.chunksAnalyzed}</span>
                              <span>chunks analyzed</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <div className="space-y-1">
                              <p className="font-medium">Calls per chunk:</p>
                              <div className="flex flex-wrap gap-1">
                                {displayMetadata.hierarchicalInfo.callsPerChunk.map((count, idx) => (
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

            {/* Behavioral Trends */}
            {displayAnalysis.trendAnalysis.patience && (
              <div>
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Behavioral Trends
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <BehaviorTrendCard
                    title="Patience"
                    icon={<Timer className="h-4 w-4 text-blue-500" />}
                    {...createPatienceProps(displayAnalysis.trendAnalysis.patience)}
                  />
                  {displayAnalysis.trendAnalysis.strategicThreading && (
                    <BehaviorTrendCard
                      title="Strategic Threading"
                      icon={<GitBranch className="h-4 w-4 text-purple-500" />}
                      {...createStrategicThreadingProps(displayAnalysis.trendAnalysis.strategicThreading)}
                    />
                  )}
                  {displayAnalysis.trendAnalysis.monologueViolations && (
                    <BehaviorTrendCard
                      title="Monologue Discipline"
                      icon={<MessageCircleWarning className="h-4 w-4 text-amber-500" />}
                      {...createMonologueProps(displayAnalysis.trendAnalysis.monologueViolations)}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Framework Trends */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Framework Trends
              </h2>
              <div className="grid gap-4 md:grid-cols-3">
                <TrendCard
                  title="MEDDPICC"
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                  trend={displayAnalysis.trendAnalysis.meddpicc?.trend ?? displayAnalysis.trendAnalysis.bant?.trend ?? 'stable'}
                  startingAvg={displayAnalysis.trendAnalysis.meddpicc?.startingAvg ?? displayAnalysis.trendAnalysis.bant?.startingAvg ?? 0}
                  endingAvg={displayAnalysis.trendAnalysis.meddpicc?.endingAvg ?? displayAnalysis.trendAnalysis.bant?.endingAvg ?? 0}
                  keyInsight={displayAnalysis.trendAnalysis.meddpicc?.keyInsight ?? displayAnalysis.trendAnalysis.bant?.keyInsight ?? ''}
                  evidence={displayAnalysis.trendAnalysis.meddpicc?.evidence ?? displayAnalysis.trendAnalysis.bant?.evidence ?? []}
                  recommendation={displayAnalysis.trendAnalysis.meddpicc?.recommendation ?? displayAnalysis.trendAnalysis.bant?.recommendation ?? ''}
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
                    <MessageSquareQuote className="h-4 w-4 text-primary" />
                    Follow-up Question Patterns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Quality Trend</span>
                      {getTrendIcon(displayAnalysis.patternAnalysis.followUpQuestions.qualityTrend)}
                    </div>
                  </div>

                  {displayAnalysis.patternAnalysis.followUpQuestions.recurringThemes.length > 0 && (
                    <div>
                      <span className="text-sm font-medium block mb-2">Recurring Themes</span>
                      <ul className="space-y-1">
                        {displayAnalysis.patternAnalysis.followUpQuestions.recurringThemes.map((theme, idx) => (
                          <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            {theme}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {displayAnalysis.patternAnalysis.followUpQuestions.recommendation && (
                    <div className="pt-3 border-t">
                      <span className="text-sm font-medium block mb-1">Recommendation</span>
                      <p className="text-sm text-muted-foreground">
                        {displayAnalysis.patternAnalysis.followUpQuestions.recommendation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Priority Actions */}
            {displayAnalysis.topPriorities && displayAnalysis.topPriorities.length > 0 && (
              <PriorityActionCard priorities={displayAnalysis.topPriorities} />
            )}

            {/* Rep Contribution Breakdown */}
            {displayMetadata?.repContributions && displayMetadata.repContributions.length > 0 && scope === 'team' && (
              <RepContributionBreakdown
                contributions={displayMetadata.repContributions.map(c => ({
                  ...c,
                  frameworkScores: {
                    meddpicc: c.frameworkScores.meddpicc,
                    gapSelling: c.frameworkScores.gapSelling,
                    activeListening: c.frameworkScores.activeListening,
                    bant: c.frameworkScores.bant,
                  }
                }))}
                totalCalls={displayMetadata.totalCalls}
                scope="team"
              />
            )}

            {/* Reset Button */}
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setGenerateRequested(false)}>
                Adjust Parameters & Re-analyze
              </Button>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
