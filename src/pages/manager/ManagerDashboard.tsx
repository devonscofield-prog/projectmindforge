import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge, getPerformanceStatus } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Profile, RepPerformanceSnapshot, CoachingSession } from '@/types/database';
import { Users, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface RepWithData extends Profile {
  performance?: RepPerformanceSnapshot;
  lastCoaching?: CoachingSession;
}

export default function ManagerDashboard() {
  const { user, profile, role } = useAuth();
  const [reps, setReps] = useState<RepWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'at-risk'>('all');

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

  const isAtRisk = (rep: RepWithData) => {
    if (!rep.performance) return true; // No data = at risk
    
    const revenueStatus = getPerformanceStatus(rep.performance.revenue_closed, rep.performance.revenue_goal);
    const demoStatus = getPerformanceStatus(rep.performance.demos_set, rep.performance.demo_goal);
    
    // Check coaching recency
    const daysSinceCoaching = rep.lastCoaching 
      ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
      : 999;

    return revenueStatus === 'off-track' || demoStatus === 'off-track' || daysSinceCoaching > 14;
  };

  const filteredReps = filter === 'at-risk' ? reps.filter(isAtRisk) : reps;
  const atRiskCount = reps.filter(isAtRisk).length;

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
              <span className="text-3xl font-bold">{reps.length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On Track</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold text-success">{reps.length - atRiskCount}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Needs Attention</CardTitle>
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
              <CardDescription>Click on a rep to view details</CardDescription>
            </div>
            <Select value={filter} onValueChange={(v: 'all' | 'at-risk') => setFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                <SelectItem value="at-risk">Needs Attention</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {filteredReps.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead className="w-[150px]">Progress</TableHead>
                    <TableHead>Demos</TableHead>
                    <TableHead className="w-[150px]">Progress</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Last Coaching</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReps.map((rep) => {
                    const atRisk = isAtRisk(rep);
                    const daysSinceCoaching = rep.lastCoaching
                      ? differenceInDays(new Date(), new Date(rep.lastCoaching.session_date))
                      : null;

                    return (
                      <TableRow key={rep.id}>
                        <TableCell className="font-medium">{rep.name}</TableCell>
                        <TableCell>
                          {formatCurrency(rep.performance?.revenue_closed || 0)} / {formatCurrency(rep.performance?.revenue_goal || 0)}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={rep.performance?.revenue_closed || 0}
                            goal={rep.performance?.revenue_goal || 0}
                            showLabel={false}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>
                          {rep.performance?.demos_set || 0} / {rep.performance?.demo_goal || 0}
                        </TableCell>
                        <TableCell>
                          <ProgressBar
                            value={rep.performance?.demos_set || 0}
                            goal={rep.performance?.demo_goal || 0}
                            showLabel={false}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>{rep.performance?.pipeline_count || '-'}</TableCell>
                        <TableCell>
                          {rep.lastCoaching ? (
                            <span className={daysSinceCoaching && daysSinceCoaching > 14 ? 'text-warning' : ''}>
                              {format(new Date(rep.lastCoaching.session_date), 'MMM d')}
                              {daysSinceCoaching && daysSinceCoaching > 14 && (
                                <span className="text-xs ml-1">({daysSinceCoaching}d ago)</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-destructive">Never</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={atRisk ? 'at-risk' : 'on-track'}>
                            {atRisk ? 'Needs Attention' : 'On Track'}
                          </StatusBadge>
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
                {filter === 'at-risk' ? 'No reps need attention. Great job!' : 'No team members found.'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
