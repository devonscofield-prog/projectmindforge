import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Profile, RepPerformanceSnapshot, CoachingSession } from '@/types/database';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface RepWithData extends Profile {
  performance?: RepPerformanceSnapshot;
  lastCoaching?: CoachingSession;
}

interface RepWithRisk extends RepWithData {
  revenueProgress: number;
  demosProgress: number;
  riskStatus: string;
  isAtRisk: boolean;
}

type FilterType = 'all' | 'at-risk' | 'on-track';
type SortType = 'risk' | 'revenue' | 'demos' | 'coaching';

function computeRiskStatus(rep: RepWithData): { riskStatus: string; isAtRisk: boolean; revenueProgress: number; demosProgress: number } {
  const now = new Date();
  const dayOfMonth = now.getDate();
  
  const revenueGoal = rep.performance?.revenue_goal || 0;
  const revenueClosed = rep.performance?.revenue_closed || 0;
  const demoGoal = rep.performance?.demo_goal || 0;
  const demosSet = rep.performance?.demos_set || 0;
  
  const revenueProgress = revenueGoal > 0 ? revenueClosed / revenueGoal : 0;
  const demosProgress = demoGoal > 0 ? demosSet / demoGoal : 0;
  
  const daysSinceCoaching = rep.lastCoaching
    ? differenceInDays(now, new Date(rep.lastCoaching.session_date))
    : null;
  
  const risks: string[] = [];
  
  // Check low revenue risk: goal > 0, day > 10, progress < 50%
  if (revenueGoal > 0 && dayOfMonth > 10 && revenueProgress < 0.5) {
    risks.push('Low Revenue');
  }
  
  // Check no recent coaching: no session in last 14 days
  if (daysSinceCoaching === null || daysSinceCoaching > 14) {
    risks.push('No Recent Coaching');
  }
  
  const isAtRisk = risks.length > 0;
  const riskStatus = isAtRisk ? `At Risk: ${risks.join(', ')}` : 'On Track';
  
  return { riskStatus, isAtRisk, revenueProgress, demosProgress };
}

export default function ManagerDashboard() {
  const { user, role } = useAuth();
  const [reps, setReps] = useState<RepWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('risk');

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      let repProfiles: Profile[] | null = null;

      if (role === 'admin') {
        // Admins can see all reps - get all profiles that have 'rep' role
        const { data: repRoles } = await supabase
          .from('user_roles')
          .select('user_id')
          .eq('role', 'rep');

        if (repRoles && repRoles.length > 0) {
          const repUserIds = repRoles.map((r) => r.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('*')
            .in('id', repUserIds)
            .eq('is_active', true);
          repProfiles = profiles;
        }
      } else {
        // Managers only see their team's reps
        const { data: teams } = await supabase
          .from('teams')
          .select('id')
          .eq('manager_id', user.id);

        if (!teams || teams.length === 0) {
          setLoading(false);
          return;
        }

        const teamIds = teams.map((t) => t.id);

        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('team_id', teamIds)
          .eq('is_active', true);
        repProfiles = profiles;
      }

      if (!repProfiles || repProfiles.length === 0) {
        setLoading(false);
        return;
      }

      const repIds = repProfiles.map((r) => r.id);

      // Get current month performance for all reps
      const { data: performances } = await supabase
        .from('rep_performance_snapshots')
        .select('*')
        .in('rep_id', repIds)
        .eq('period_year', currentYear)
        .eq('period_month', currentMonth);

      // Get latest coaching sessions for all reps
      const { data: coachingSessions } = await supabase
        .from('coaching_sessions')
        .select('*')
        .in('rep_id', repIds)
        .order('session_date', { ascending: false });

      // Combine data
      const repsWithData: RepWithData[] = repProfiles.map((rep) => {
        const perf = performances?.find((p) => p.rep_id === rep.id);
        const coaching = coachingSessions?.find((c) => c.rep_id === rep.id);

        return {
          ...rep,
          performance: perf as unknown as RepPerformanceSnapshot,
          lastCoaching: coaching as unknown as CoachingSession,
        } as RepWithData;
      });

      setReps(repsWithData);
      setLoading(false);
    };

    fetchData();
  }, [user, role]);

  // Compute risk status for all reps and apply filtering/sorting
  const processedReps: RepWithRisk[] = useMemo(() => {
    return reps.map((rep) => {
      const { riskStatus, isAtRisk, revenueProgress, demosProgress } = computeRiskStatus(rep);
      return {
        ...rep,
        riskStatus,
        isAtRisk,
        revenueProgress,
        demosProgress,
      };
    });
  }, [reps]);

  // Filter reps based on selection
  const filteredReps = useMemo(() => {
    let result = [...processedReps];
    
    if (filter === 'at-risk') {
      result = result.filter((rep) => rep.isAtRisk);
    } else if (filter === 'on-track') {
      result = result.filter((rep) => !rep.isAtRisk);
    }
    
    // Sort based on selected sort option
    result.sort((a, b) => {
      switch (sortBy) {
        case 'risk':
          if (a.isAtRisk && !b.isAtRisk) return -1;
          if (!a.isAtRisk && b.isAtRisk) return 1;
          return a.name.localeCompare(b.name);
        case 'revenue':
          return b.revenueProgress - a.revenueProgress;
        case 'demos':
          return b.demosProgress - a.demosProgress;
        case 'coaching': {
          const aDate = a.lastCoaching ? new Date(a.lastCoaching.session_date).getTime() : 0;
          const bDate = b.lastCoaching ? new Date(b.lastCoaching.session_date).getTime() : 0;
          return bDate - aDate;
        }
        default:
          return 0;
      }
    });
    
    return result;
  }, [processedReps, filter, sortBy]);

  const atRiskCount = processedReps.filter((rep) => rep.isAtRisk).length;
  const onTrackCount = processedReps.length - atRiskCount;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  // Calculate average revenue progress
  const avgRevenueProgress = useMemo(() => {
    if (processedReps.length === 0) return 0;
    const total = processedReps.reduce((sum, rep) => sum + rep.revenueProgress, 0);
    return Math.round((total / processedReps.length) * 100);
  }, [processedReps]);

  // Calculate reps coached in last 14 days
  const recentlyCoached = useMemo(() => {
    return processedReps.filter((rep) => {
      if (!rep.lastCoaching) return false;
      const daysSince = differenceInDays(new Date(), new Date(rep.lastCoaching.session_date));
      return daysSince <= 14;
    }).length;
  }, [processedReps]);

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page Header */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Team Performance Overview</h1>
          <p className="text-muted-foreground">
            Track who is on track vs at risk for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

          <Card className="border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">{onTrackCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Meeting performance goals</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-warning">{atRiskCount}</div>
              <p className="text-xs text-muted-foreground mt-1">Need attention this month</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-muted-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{avgRevenueProgress}%</div>
              <p className="text-xs text-muted-foreground mt-1">{recentlyCoached} coached in 14 days</p>
            </CardContent>
          </Card>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl">Rep Performance</CardTitle>
                <CardDescription>Click on a rep to view detailed performance metrics</CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  <Button
                    variant={filter === 'all' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('all')}
                    className="px-3"
                  >
                    All ({processedReps.length})
                  </Button>
                  <Button
                    variant={filter === 'at-risk' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('at-risk')}
                    className="px-3"
                  >
                    At Risk ({atRiskCount})
                  </Button>
                  <Button
                    variant={filter === 'on-track' ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter('on-track')}
                    className="px-3"
                  >
                    On Track ({onTrackCount})
                  </Button>
                </div>
                <Select value={sortBy} onValueChange={(v: SortType) => setSortBy(v)}>
                  <SelectTrigger className="w-[180px] bg-background">
                    <SelectValue placeholder="Sort By" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="risk">Sort: Risk Status</SelectItem>
                    <SelectItem value="revenue">Sort: Revenue Progress</SelectItem>
                    <SelectItem value="demos">Sort: Demo Progress</SelectItem>
                    <SelectItem value="coaching">Sort: Last Coaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredReps.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Rep Name</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Status</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider w-[200px]">Revenue Progress</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider w-[180px]">Demos Progress</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">Pipeline</TableHead>
                      <TableHead className="font-semibold text-xs uppercase tracking-wider">Last Coaching</TableHead>
                      <TableHead className="w-[80px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReps.map((rep, index) => {
                      const daysSinceCoaching = rep.lastCoaching
                        ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
                        : null;

                      return (
                        <TableRow 
                          key={rep.id} 
                          className={`
                            transition-colors hover:bg-muted/50
                            ${index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}
                            ${rep.isAtRisk ? 'border-l-2 border-l-warning' : ''}
                          `}
                        >
                          <TableCell className="py-4">
                            <span className="font-semibold text-foreground">{rep.name}</span>
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={rep.isAtRisk ? 'at-risk' : 'on-track'}>
                              {rep.isAtRisk ? rep.riskStatus.replace('At Risk: ', '') : 'On Track'}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {formatCurrency(rep.performance?.revenue_closed || 0)}
                                  <span className="text-muted-foreground font-normal"> / {formatCurrency(rep.performance?.revenue_goal || 0)}</span>
                                </span>
                                <span className={`text-sm font-bold ml-2 ${
                                  rep.revenueProgress >= 0.75 ? 'text-success' : 
                                  rep.revenueProgress >= 0.5 ? 'text-warning' : 'text-destructive'
                                }`}>
                                  {Math.round(rep.revenueProgress * 100)}%
                                </span>
                              </div>
                              <ProgressBar
                                value={rep.performance?.revenue_closed || 0}
                                goal={rep.performance?.revenue_goal || 0}
                                showLabel={false}
                                size="sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  {rep.performance?.demos_set || 0}
                                  <span className="text-muted-foreground font-normal"> / {rep.performance?.demo_goal || 0}</span>
                                </span>
                                <span className={`text-sm font-bold ml-2 ${
                                  rep.demosProgress >= 0.75 ? 'text-success' : 
                                  rep.demosProgress >= 0.5 ? 'text-warning' : 'text-destructive'
                                }`}>
                                  {Math.round(rep.demosProgress * 100)}%
                                </span>
                              </div>
                              <ProgressBar
                                value={rep.performance?.demos_set || 0}
                                goal={rep.performance?.demo_goal || 0}
                                showLabel={false}
                                size="sm"
                              />
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted text-sm font-medium">
                              {rep.performance?.pipeline_count ?? '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {rep.lastCoaching ? (
                              <div className="space-y-0.5">
                                <div className={`text-sm font-medium ${daysSinceCoaching && daysSinceCoaching > 14 ? 'text-warning' : 'text-foreground'}`}>
                                  {format(new Date(rep.lastCoaching.session_date), 'MMM d, yyyy')}
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
                            <Button variant="ghost" size="sm" asChild className="hover:bg-primary/10 hover:text-primary">
                              <Link to={`/manager/rep/${rep.id}`}>View →</Link>
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
                <p className="text-muted-foreground">
                  {filter === 'at-risk' 
                    ? 'No reps are at risk. Great job!' 
                    : filter === 'on-track'
                      ? 'No reps are on track yet.'
                      : 'No team members found.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
