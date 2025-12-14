import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
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
import { Users, Phone, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import { AiScoreStats } from '@/api/aiCallAnalysis';
import { QueryErrorBoundary } from '@/components/ui/query-error-boundary';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { ManagerDashboardSkeleton } from '@/components/dashboard/ManagerDashboardSkeleton';

interface RepWithData extends Profile {
  lastCoaching?: CoachingSession;
  aiScoreStats?: AiScoreStats | null;
  callsLast30Days: number;
}

type SortType = 'name' | 'calls' | 'coaching' | 'ai-score';

function ManagerDashboard() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortType>('name');

  // Fetch rep profiles
  const { data: repProfiles = [], isLoading: repsLoading } = useManagerReps(user?.id, role || undefined);
  
  // Extract rep IDs for dependent queries
  const repIds = useMemo(() => repProfiles.map(r => r.id), [repProfiles]);

  // Fetch dependent data in parallel
  const { data: coachingMap = new Map() } = useRepCoachingSessions(repIds);
  const { data: aiScoreStatsMap = new Map() } = useAiScoreStats(repIds);
  const { data: callCountsMap = {} } = useRepCallCounts(repIds);

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

  // Calculate summary stats
  const totalCalls = useMemo(() => {
    return processedReps.reduce((sum, rep) => sum + rep.callsLast30Days, 0);
  }, [processedReps]);

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
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Team Overview</h1>
            <p className="text-muted-foreground">
              Track your reps' coaching status and call activity for {format(new Date(), 'MMMM yyyy')}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Reps</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{processedReps.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Active team members</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-muted-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Calls (30d)</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCalls}</div>
              <p className="text-xs text-muted-foreground mt-1">Team call volume</p>
            </CardContent>
          </Card>
        </div>

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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Rep Name</TableHead>
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

                      return (
                        <TableRow 
                          key={rep.id} 
                          className={`
                            transition-colors hover:bg-muted/50
                            ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                          `}
                        >
                          <TableCell className="py-4">
                            <span className="font-semibold text-foreground">{rep.name}</span>
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
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No team members found.</p>
              </div>
            )}
          </CardContent>
        </Card>
        </QueryErrorBoundary>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(ManagerDashboard, 'Manager Dashboard');
