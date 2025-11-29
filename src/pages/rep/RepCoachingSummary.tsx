import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { generateCoachingTrends, CoachingTrendAnalysis } from '@/api/aiCallAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { TrendCard } from '@/components/coaching/TrendCard';
import { CriticalInfoTrends } from '@/components/coaching/CriticalInfoTrends';
import { PriorityActionCard } from '@/components/coaching/PriorityActionCard';
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
} from 'lucide-react';

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

export default function RepCoachingSummary() {
  const { user, role } = useAuth();
  const { repId } = useParams<{ repId?: string }>();
  
  // Date range state
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => createDateRange(30));
  const [selectedPreset, setSelectedPreset] = useState<string>('30');
  
  // Determine if viewing own summary or another rep's (for managers)
  const targetRepId = repId || user?.id;
  const isOwnSummary = !repId || repId === user?.id;

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

  // AI Trend Analysis query
  const { 
    data: trendAnalysis, 
    isLoading, 
    error, 
    refetch,
    isFetching 
  } = useQuery({
    queryKey: ['coaching-trends', targetRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => generateCoachingTrends(targetRepId!, dateRange),
    enabled: !!targetRepId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      setDateRange(createDateRange(parseInt(value)));
    }
  };

  const handleFromDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      setDateRange(prev => ({ ...prev, from: date }));
      setSelectedPreset('custom');
    }
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      setDateRange(prev => ({ ...prev, to: date }));
      setSelectedPreset('custom');
    }
  };

  const getBackPath = () => {
    if (role === 'manager' && repId) return `/manager/rep/${repId}`;
    if (role === 'admin' && repId) return `/manager/rep/${repId}`;
    return '/rep';
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" asChild>
                <Link to={getBackPath()}>
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <Sparkles className="h-6 w-6 text-primary" />
                  {isOwnSummary ? 'My Coaching Trends' : `${repProfile?.name || 'Rep'}'s Coaching Trends`}
                </h1>
                <p className="text-muted-foreground">
                  AI-powered trend analysis of your sales calls
                </p>
              </div>
            </div>
            
            {/* Refresh Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
              Refresh Analysis
            </Button>
          </div>
          
          {/* Date Range Controls */}
          <div className="flex flex-wrap items-center gap-2 p-4 bg-muted/50 rounded-lg">
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
              <div className="flex items-center gap-2">
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
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="space-y-6">
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center gap-4">
                  <div className="relative">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium">Analyzing your calls...</p>
                    <p className="text-muted-foreground text-sm">
                      Our AI is reviewing your call data to identify trends and patterns.
                      <br />
                      This may take 15-30 seconds.
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
              {isOwnSummary && (
                <Button asChild className="mt-4">
                  <Link to="/rep">Submit a Call</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : trendAnalysis && (
          <>
            {/* Executive Summary */}
            <Card className="bg-gradient-to-br from-primary/5 via-background to-background border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Executive Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-base leading-relaxed">{trendAnalysis.summary}</p>
                
                {/* Period Stats */}
                <div className="flex flex-wrap items-center gap-6 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Calls Analyzed:</span>
                    <span className="font-semibold">{trendAnalysis.periodAnalysis.totalCalls}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-sm text-muted-foreground">Avg Heat Score:</span>
                    <span className="font-semibold">{trendAnalysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}/10</span>
                    {getTrendIcon(trendAnalysis.periodAnalysis.heatScoreTrend)}
                  </div>
                </div>
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
                  trend={trendAnalysis.trendAnalysis.bant.trend}
                  startingAvg={trendAnalysis.trendAnalysis.bant.startingAvg}
                  endingAvg={trendAnalysis.trendAnalysis.bant.endingAvg}
                  keyInsight={trendAnalysis.trendAnalysis.bant.keyInsight}
                  evidence={trendAnalysis.trendAnalysis.bant.evidence}
                  recommendation={trendAnalysis.trendAnalysis.bant.recommendation}
                />
                <TrendCard
                  title="Gap Selling"
                  icon={<MessageSquareQuote className="h-4 w-4 text-purple-500" />}
                  trend={trendAnalysis.trendAnalysis.gapSelling.trend}
                  startingAvg={trendAnalysis.trendAnalysis.gapSelling.startingAvg}
                  endingAvg={trendAnalysis.trendAnalysis.gapSelling.endingAvg}
                  keyInsight={trendAnalysis.trendAnalysis.gapSelling.keyInsight}
                  evidence={trendAnalysis.trendAnalysis.gapSelling.evidence}
                  recommendation={trendAnalysis.trendAnalysis.gapSelling.recommendation}
                />
                <TrendCard
                  title="Active Listening"
                  icon={<Ear className="h-4 w-4 text-teal-500" />}
                  trend={trendAnalysis.trendAnalysis.activeListening.trend}
                  startingAvg={trendAnalysis.trendAnalysis.activeListening.startingAvg}
                  endingAvg={trendAnalysis.trendAnalysis.activeListening.endingAvg}
                  keyInsight={trendAnalysis.trendAnalysis.activeListening.keyInsight}
                  evidence={trendAnalysis.trendAnalysis.activeListening.evidence}
                  recommendation={trendAnalysis.trendAnalysis.activeListening.recommendation}
                />
              </div>
            </div>

            {/* Pattern Analysis */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Critical Info Trends */}
              <CriticalInfoTrends
                persistentGaps={trendAnalysis.patternAnalysis.criticalInfoMissing.persistentGaps}
                newIssues={trendAnalysis.patternAnalysis.criticalInfoMissing.newIssues}
                resolvedIssues={trendAnalysis.patternAnalysis.criticalInfoMissing.resolvedIssues}
                recommendation={trendAnalysis.patternAnalysis.criticalInfoMissing.recommendation}
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
                    {getTrendBadge(trendAnalysis.patternAnalysis.followUpQuestions.qualityTrend)}
                  </div>

                  {trendAnalysis.patternAnalysis.followUpQuestions.recurringThemes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Recurring Themes
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trendAnalysis.patternAnalysis.followUpQuestions.recurringThemes.map((theme, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {trendAnalysis.patternAnalysis.followUpQuestions.recommendation && (
                    <div className="p-3 rounded-lg bg-muted/50 border text-sm">
                      <p className="font-medium mb-1">Recommendation</p>
                      <p className="text-muted-foreground">
                        {trendAnalysis.patternAnalysis.followUpQuestions.recommendation}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top Priorities */}
            <PriorityActionCard priorities={trendAnalysis.topPriorities} />
          </>
        )}
      </div>
    </AppLayout>
  );
}
