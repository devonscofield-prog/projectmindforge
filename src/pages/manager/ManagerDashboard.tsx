import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRepDetailUrl } from '@/lib/routes';
import {
  useManagerReps,
  useRepCoachingSessions,
  useAiScoreStats,
  useRepCallCounts,
  managerDashboardKeys
} from '@/hooks/useManagerDashboardQueries';

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Profile, CoachingSession } from '@/types/database';
import { Phone, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, UserSearch } from 'lucide-react';
import { format, differenceInDays, subDays } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import { AiScoreStats } from '@/api/aiCallAnalysis';
import { supabase } from '@/integrations/supabase/client';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { ManagerDashboardSkeleton } from '@/components/dashboard/ManagerDashboardSkeleton';
import { TeamHealthWidget } from '@/components/manager/TeamHealthWidget';
import { EmptyState } from '@/components/ui/empty-state';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface RepWithData extends Profile {
  lastCoaching?: CoachingSession;
  aiScoreStats?: AiScoreStats | null;
  callsLast30Days: number;
}

type SortType = 'name' | 'calls' | 'coaching' | 'ai-score';
type ChartPeriod = '7d' | '30d';

function ManagerDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortType>('name');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('30d');

  // Fetch rep profiles
  const { data: repProfiles = [], isLoading: repsLoading } = useManagerReps(user?.id, role || undefined);

  // Extract rep IDs for dependent queries
  const repIds = useMemo(() => repProfiles.map(r => r.id), [repProfiles]);

  // Fetch dependent data in parallel
  const { data: coachingMap = new Map() } = useRepCoachingSessions(repIds);
  const { data: aiScoreStatsMap = new Map() } = useAiScoreStats(repIds);
  const { data: callCountsMap = {} } = useRepCallCounts(repIds);

  // Fetch daily AI scores for team trend chart
  const chartDays = chartPeriod === '7d' ? 7 : 30;
  const { data: trendData = [] } = useQuery({
    queryKey: [...managerDashboardKeys.all, 'trend', repIds.join(','), chartPeriod],
    queryFn: async () => {
      const cutoff = subDays(new Date(), chartDays).toISOString();
      const { data, error } = await supabase
        .from('ai_call_analysis')
        .select('call_effectiveness_score, created_at')
        .in('rep_id', repIds)
        .gte('created_at', cutoff)
        .not('call_effectiveness_score', 'is', null)
        .order('created_at', { ascending: true });

      if (error || !data) return [];

      // Group by date and calculate daily averages
      const byDate = new Map<string, number[]>();
      for (const row of data) {
        const date = format(new Date(row.created_at), 'MMM d');
        if (!byDate.has(date)) byDate.set(date, []);
        byDate.get(date)!.push(row.call_effectiveness_score as number);
      }

      return Array.from(byDate.entries()).map(([date, scores]) => ({
        date,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        calls: scores.length,
      }));
    },
    enabled: repIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  // Handle refresh
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: managerDashboardKeys.all });
  };

  // Process reps with coaching, AI score stats, and call counts
  const processedReps: RepWithData[] = useMemo(() => {
    return repProfiles.map((rep) => {
      const lastCoaching = coachingMap.get(rep.id) || undefined;
      const aiScoreStats = aiScoreStatsMap.get(rep.id) || null;
      const callsLast30Days = callCountsMap[rep.id] ?? 0;
      return {
        ...rep,
        lastCoaching,
        aiScoreStats,
        callsLast30Days,
      };
    });
  }, [repProfiles, coachingMap, aiScoreStatsMap, callCountsMap]);

  // Sort reps based on selection
  const sortedReps = useMemo(() => {
    const result = [...processedReps];
    
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'calls':
          return b.callsLast30Days - a.callsLast30Days;
        case 'coaching': {
          const aDate = a.lastCoaching ? new Date(a.lastCoaching.session_date).getTime() : 0;
          const bDate = b.lastCoaching ? new Date(b.lastCoaching.session_date).getTime() : 0;
          return bDate - aDate;
        }
        case 'ai-score': {
          const aScore = a.aiScoreStats?.latestScore ?? -1;
          const bScore = b.aiScoreStats?.latestScore ?? -1;
          return bScore - aScore;
        }
        default:
          return 0;
      }
    });
    
    return result;
  }, [processedReps, sortBy]);

  if (repsLoading) {
    return (
      <AppLayout>
        <ManagerDashboardSkeleton />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Team Overview</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Track your reps' coaching status and call activity for {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm" className="self-start sm:self-auto min-h-[44px] md:min-h-0">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Team Health Widget */}
        <TeamHealthWidget reps={processedReps} />

        {/* Team Performance Trend Chart */}
        {trendData.length > 1 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Team AI Score Trend</CardTitle>
                  <CardDescription>Average call effectiveness score across your team</CardDescription>
                </div>
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  <Button
                    variant={chartPeriod === '7d' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setChartPeriod('7d')}
                    className="px-3 text-xs"
                  >
                    7d
                  </Button>
                  <Button
                    variant={chartPeriod === '30d' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setChartPeriod('30d')}
                    className="px-3 text-xs"
                  >
                    30d
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(value: number, name: string) => {
                      if (name === 'avgScore') return [value, 'Avg Score'];
                      return [value, name];
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="avgScore"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Team Table */}
        <QueryErrorBoundary>
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Your Reps ({processedReps.length})</CardTitle>
                <CardDescription>Click "View Calls" to see a rep's call history and coaching insights</CardDescription>
              </div>
              <Select value={sortBy} onValueChange={(v: SortType) => setSortBy(v)}>
                <SelectTrigger className="w-[180px] bg-background">
                  <SelectValue placeholder="Sort By" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="calls">Sort: Calls (30d)</SelectItem>
                  <SelectItem value="ai-score">Sort: AI Score</SelectItem>
                  <SelectItem value="coaching">Sort: Last Coaching</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sortedReps.length > 0 ? (
              <div className="overflow-x-auto -webkit-overflow-scrolling-touch">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider sticky left-0 bg-muted/50 z-10">Rep Name</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Calls (30d)</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">AI Score</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Coaching</TableHead>
                      <TableHead className="w-[180px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedReps.map((rep, index) => {
                      const daysSinceCoaching = rep.lastCoaching
                        ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
                        : null;
                      const coachingOverdue = daysSinceCoaching === null || daysSinceCoaching >= 14;
                      const scoreDecline = rep.aiScoreStats?.avgScore30Days != null
                        && rep.aiScoreStats?.latestScore != null
                        && rep.aiScoreStats.callCount30Days > 1
                        && rep.aiScoreStats.latestScore < rep.aiScoreStats.avgScore30Days - 2;

                      return (
                        <TableRow
                          key={rep.id}
                          className={`
                            transition-colors hover:bg-muted/50
                            ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                          `}
                        >
                          <TableCell className="py-4 sticky left-0 bg-inherit z-10">
                            <div className="flex flex-col gap-1">
                              <span className="font-semibold text-foreground">{rep.name}</span>
                              <div className="flex flex-wrap gap-1">
                                {coachingOverdue && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                    <AlertTriangle className="h-3 w-3 mr-0.5" />
                                    Coaching overdue
                                  </Badge>
                                )}
                                {scoreDecline && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-destructive text-destructive">
                                    <TrendingDown className="h-3 w-3 mr-0.5" />
                                    Score declining
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${
                              rep.callsLast30Days > 0 ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                              {rep.callsLast30Days}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {rep.aiScoreStats?.latestScore != null ? (
                              <div className="flex flex-col items-center gap-0.5">
                                <div className="flex items-center gap-1">
                                  <Badge 
                                    variant="secondary" 
                                    className={`text-xs font-semibold ${
                                      rep.aiScoreStats.latestScore >= 80 
                                        ? 'bg-success/10 text-success' 
                                        : rep.aiScoreStats.latestScore >= 60 
                                          ? 'bg-warning/10 text-warning' 
                                          : 'bg-destructive/10 text-destructive'
                                    }`}
                                  >
                                    {Math.round(rep.aiScoreStats.latestScore)}
                                  </Badge>
                                  {rep.aiScoreStats.avgScore30Days != null && rep.aiScoreStats.callCount30Days > 1 && (
                                    <>
                                      {rep.aiScoreStats.latestScore > rep.aiScoreStats.avgScore30Days + 2 ? (
                                        <TrendingUp className="h-3.5 w-3.5 text-success" />
                                      ) : rep.aiScoreStats.latestScore < rep.aiScoreStats.avgScore30Days - 2 ? (
                                        <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                                      ) : (
                                        <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                                      )}
                                    </>
                                  )}
                                </div>
                                {rep.aiScoreStats.avgScore30Days != null && rep.aiScoreStats.callCount30Days > 1 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    Avg: {Math.round(rep.aiScoreStats.avgScore30Days)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {rep.lastCoaching ? (
                              <div className="space-y-0.5">
                                <div className={`text-sm font-medium ${daysSinceCoaching && daysSinceCoaching > 14 ? 'text-warning' : 'text-foreground'}`}>
                                  {format(parseDateOnly(rep.lastCoaching.session_date), 'MMM d, yyyy')}
                                </div>
                                {daysSinceCoaching !== null && (
                                  <div className="text-xs text-muted-foreground">
                                    {daysSinceCoaching === 0 ? 'Today' : daysSinceCoaching === 1 ? 'Yesterday' : `${daysSinceCoaching} days ago`}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-destructive font-medium">Never coached</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="default"
                              size="sm"
                              className="min-h-[44px] md:min-h-0"
                              onClick={() => navigate(getRepDetailUrl(rep.id, 'call-history'))}
                            >
                              <Phone className="h-3.5 w-3.5 mr-1" />
                              View Calls
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState
                icon={UserSearch}
                title="No team members found"
                description="Reps assigned to your team will appear here with their coaching status and call activity."
              />
            )}
          </CardContent>
        </Card>
        </QueryErrorBoundary>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(ManagerDashboard, 'Manager Dashboard');
