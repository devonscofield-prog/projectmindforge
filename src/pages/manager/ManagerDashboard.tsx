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
    
    // Sort: At Risk first, then On Track
    result.sort((a, b) => {
      if (a.isAtRisk && !b.isAtRisk) return -1;
      if (!a.isAtRisk && b.isAtRisk) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return result;
  }, [processedReps, filter]);

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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Team Overview</h1>
          <p className="text-muted-foreground mt-1">
            {format(new Date(), 'MMMM yyyy')} performance summary
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Reps</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{processedReps.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-success">{onTrackCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-warning">{atRiskCount}</span>
            </CardContent>
          </Card>
        </div>

        {/* Team Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Performance</CardTitle>
              <CardDescription>Click on a rep to view details. At-risk reps are shown first.</CardDescription>
            </div>
            <Select value={filter} onValueChange={(v: FilterType) => setFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                <SelectItem value="at-risk">At Risk Only</SelectItem>
                <SelectItem value="on-track">On Track Only</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {filteredReps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="w-[180px]">Revenue Progress</TableHead>
                    <TableHead className="w-[180px]">Demos Progress</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Last Coaching</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReps.map((rep) => {
                    const daysSinceCoaching = rep.lastCoaching
                      ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
                      : null;

                    return (
                      <TableRow key={rep.id} className={rep.isAtRisk ? 'bg-warning/5' : ''}>
                        <TableCell className="font-medium">{rep.name}</TableCell>
                        <TableCell>
                          <StatusBadge status={rep.isAtRisk ? 'at-risk' : 'on-track'}>
                            {rep.isAtRisk ? rep.riskStatus.replace('At Risk: ', '') : 'On Track'}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{formatCurrency(rep.performance?.revenue_closed || 0)}</span>
                              <span className={`font-semibold ${
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
                            <div className="text-xs text-muted-foreground">
                              Goal: {formatCurrency(rep.performance?.revenue_goal || 0)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{rep.performance?.demos_set || 0}</span>
                              <span className={`font-semibold ${
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
                            <div className="text-xs text-muted-foreground">
                              Goal: {rep.performance?.demo_goal || 0}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{rep.performance?.pipeline_count || '-'}</TableCell>
                        <TableCell>
                          {rep.lastCoaching ? (
                            <span className={daysSinceCoaching && daysSinceCoaching > 14 ? 'text-warning' : ''}>
                              {format(new Date(rep.lastCoaching.session_date), 'MMM d')}
                              {daysSinceCoaching !== null && (
                                <span className="text-xs ml-1 text-muted-foreground">({daysSinceCoaching}d ago)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-destructive">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/manager/rep/${rep.id}`}>View</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                {filter === 'at-risk' 
                  ? 'No reps are at risk. Great job!' 
                  : filter === 'on-track'
                    ? 'No reps are on track yet.'
                    : 'No team members found.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
