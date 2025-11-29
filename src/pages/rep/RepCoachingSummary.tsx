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
import { getCoachingSummaryForRep, CoachingSummary } from '@/api/aiCallAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { FrameworkTrendChart } from '@/components/coaching/FrameworkTrendChart';
import { CoachingPatternCard } from '@/components/coaching/CoachingPatternCard';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  HelpCircle,
  Target,
  TrendingUp,
  Ear,
  Flame,
  Award,
  Lightbulb,
  Tag,
  TrendingDown,
  Minus,
  CalendarIcon,
} from 'lucide-react';

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
];

export default function RepCoachingSummary() {
  const { user, role } = useAuth();
  const { repId } = useParams<{ repId?: string }>();
  
  // Date range state
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
    return { from, to };
  });
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

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ['coaching-summary', targetRepId, dateRange.from.toISOString(), dateRange.to.toISOString()],
    queryFn: () => getCoachingSummaryForRep(targetRepId!, dateRange),
    enabled: !!targetRepId,
  });

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      const days = parseInt(value);
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = new Date();
      from.setDate(from.getDate() - days);
      from.setHours(0, 0, 0, 0);
      setDateRange({ from, to });
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

  const getTrendLabel = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return <Badge variant="default" className="bg-green-500">Improving</Badge>;
      case 'declining':
        return <Badge variant="destructive">Declining</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to={getBackPath()}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                {isOwnSummary ? 'My Coaching Summary' : `${repProfile?.name || 'Rep'}'s Coaching Summary`}
              </h1>
              <p className="text-muted-foreground">
                Aggregated insights from your analyzed calls
              </p>
            </div>
          </div>
          
          {/* Date Range Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map(range => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>
            
            {selectedPreset === 'custom' && (
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.from, 'MMM d, yyyy')}
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
                    <Button variant="outline" size="sm" className="w-[130px] justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.to, 'MMM d, yyyy')}
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

        {isLoading ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <Card key={i}>
                  <CardContent className="pt-6">
                    <Skeleton className="h-8 w-24" />
                    <Skeleton className="h-4 w-32 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
            <Skeleton className="h-[350px]" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive">Failed to load coaching summary</p>
            </CardContent>
          </Card>
        ) : summary?.totalCalls === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium">No Analyzed Calls</h3>
              <p className="text-muted-foreground mt-2">
                Submit calls for analysis to see your coaching summary.
              </p>
              {isOwnSummary && (
                <Button asChild className="mt-4">
                  <Link to="/rep">Submit a Call</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : summary && (
          <>
            {/* Stats Overview */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Calls Analyzed</p>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <p className="text-3xl font-bold mt-2">{summary.totalCalls}</p>
                  <p className="text-xs text-muted-foreground mt-1">in selected period</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Avg Heat Score</p>
                    <Flame className="h-4 w-4 text-orange-500" />
                  </div>
                  <p className="text-3xl font-bold mt-2">
                    {summary.heatScoreStats.average?.toFixed(1) || '-'}/10
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {getTrendIcon(summary.heatScoreStats.trend)}
                    {getTrendLabel(summary.heatScoreStats.trend)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Top Strength</p>
                    <Award className="h-4 w-4 text-green-500" />
                  </div>
                  <p className="text-lg font-semibold mt-2 capitalize">
                    {summary.strengthsAndOpportunities.topStrengths[0]?.area.replace(/_/g, ' ') || '-'}
                  </p>
                  {summary.strengthsAndOpportunities.topStrengths[0] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.strengthsAndOpportunities.topStrengths[0].count} occurrences
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Focus Area</p>
                    <Lightbulb className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-lg font-semibold mt-2 capitalize">
                    {summary.strengthsAndOpportunities.topOpportunities[0]?.area.replace(/_/g, ' ') || '-'}
                  </p>
                  {summary.strengthsAndOpportunities.topOpportunities[0] && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {summary.strengthsAndOpportunities.topOpportunities[0].count} occurrences
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Framework Trends Chart */}
            <FrameworkTrendChart data={summary.frameworkTrends} />

            {/* Recurring Patterns */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Recurring Patterns</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <CoachingPatternCard
                  title="Critical Info Missing"
                  icon={AlertTriangle}
                  items={summary.recurringPatterns.criticalInfoMissing}
                  variant="destructive"
                  emptyMessage="Great job! No recurring gaps found."
                />
                <CoachingPatternCard
                  title="Common Follow-up Questions"
                  icon={HelpCircle}
                  items={summary.recurringPatterns.followUpQuestions}
                  variant="default"
                />
                <CoachingPatternCard
                  title="BANT Improvements"
                  icon={Target}
                  items={summary.recurringPatterns.bantImprovements}
                  variant="default"
                />
                <CoachingPatternCard
                  title="Gap Selling Improvements"
                  icon={TrendingUp}
                  items={summary.recurringPatterns.gapSellingImprovements}
                  variant="default"
                />
                <CoachingPatternCard
                  title="Active Listening Improvements"
                  icon={Ear}
                  items={summary.recurringPatterns.activeListeningImprovements}
                  variant="default"
                />
              </div>
            </div>

            {/* Tags & Strengths */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Skill & Deal Tags */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Tag className="h-5 w-5" />
                    Common Tags
                  </CardTitle>
                  <CardDescription>
                    Recurring patterns identified across your calls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Skill Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {summary.aggregatedTags.skillTags.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No skill tags yet</p>
                      ) : (
                        summary.aggregatedTags.skillTags.slice(0, 8).map((t, i) => (
                          <Badge key={i} variant="secondary">
                            {t.tag.replace(/_/g, ' ')} ({t.count})
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Deal Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {summary.aggregatedTags.dealTags.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No deal tags yet</p>
                      ) : (
                        summary.aggregatedTags.dealTags.slice(0, 8).map((t, i) => (
                          <Badge key={i} variant="outline">
                            {t.tag.replace(/_/g, ' ')} ({t.count})
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Strengths & Opportunities */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Award className="h-5 w-5" />
                    Strengths & Opportunities
                  </CardTitle>
                  <CardDescription>
                    Your top performing areas and growth opportunities
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="text-green-500">✓</span> Top Strengths
                    </h4>
                    {summary.strengthsAndOpportunities.topStrengths.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No strengths identified yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {summary.strengthsAndOpportunities.topStrengths.slice(0, 3).map((s, i) => (
                          <li key={i} className="flex items-start justify-between gap-2">
                            <span className="text-sm capitalize">{s.area.replace(/_/g, ' ')}</span>
                            <Badge variant="secondary">{s.count}x</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <span className="text-yellow-500">↗</span> Growth Opportunities
                    </h4>
                    {summary.strengthsAndOpportunities.topOpportunities.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No opportunities identified yet</p>
                    ) : (
                      <ul className="space-y-2">
                        {summary.strengthsAndOpportunities.topOpportunities.slice(0, 3).map((o, i) => (
                          <li key={i} className="flex items-start justify-between gap-2">
                            <span className="text-sm capitalize">{o.area.replace(/_/g, ' ')}</span>
                            <Badge variant="outline">{o.count}x</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
