import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, BarChart3, RefreshCw, Activity, MessageSquare, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { GlobalActivityFeed } from '@/components/admin/GlobalActivityFeed';

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalReps: number;
  totalManagers: number;
  totalPerformanceSnapshots: number;
  totalCoachingSessions: number;
  totalActivityLogs: number;
}

export default function AdminDashboard() {
  const { role } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTeams: 0,
    totalReps: 0,
    totalManagers: 0,
    totalPerformanceSnapshots: 0,
    totalCoachingSessions: 0,
    totalActivityLogs: 0,
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchStats = async () => {
    // Fetch user count
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch teams count
    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    // Fetch role counts
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role');

    // Fetch performance snapshots count
    const { count: perfCount } = await supabase
      .from('rep_performance_snapshots')
      .select('*', { count: 'exact', head: true });

    // Fetch coaching sessions count
    const { count: coachingCount } = await supabase
      .from('coaching_sessions')
      .select('*', { count: 'exact', head: true });

    // Fetch activity logs count
    const { count: activityCount } = await supabase
      .from('activity_logs')
      .select('*', { count: 'exact', head: true });

    const repCount = roles?.filter((r) => r.role === 'rep').length || 0;
    const managerCount = roles?.filter((r) => r.role === 'manager').length || 0;

    setStats({
      totalUsers: userCount || 0,
      totalTeams: teamCount || 0,
      totalReps: repCount,
      totalManagers: managerCount,
      totalPerformanceSnapshots: perfCount || 0,
      totalCoachingSessions: coachingCount || 0,
      totalActivityLogs: activityCount || 0,
    });

    setLoading(false);
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await supabase.functions.invoke('seed-demo-data');
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      toast.success('Demo data reset successfully');
      // Refresh stats after seeding
      fetchStats();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed data';
      toast.error(errorMessage);
    } finally {
      setSeeding(false);
    }
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">Manage teams, users, and settings</p>
          </div>
          <Badge variant="default" className="text-sm">
            Role: {role || 'unknown'}
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalUsers}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalTeams}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales Reps</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalReps}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Managers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalManagers}</span>
            </CardContent>
          </Card>
        </div>

        {/* Data Stats - Admin Smoke Test */}
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Performance Snapshots</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalPerformanceSnapshots}</span>
              <p className="text-xs text-muted-foreground mt-1">Total records (all reps)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Coaching Sessions</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalCoachingSessions}</span>
              <p className="text-xs text-muted-foreground mt-1">Total records (all reps)</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Activity Logs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats.totalActivityLogs}</span>
              <p className="text-xs text-muted-foreground mt-1">Total records (all reps)</p>
            </CardContent>
          </Card>
        </div>

        {/* Global Activity Feed */}
        <GlobalActivityFeed />

        {/* Developer Tools - Collapsible */}
        <Collapsible>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Developer Tools</CardTitle>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                <Button 
                  variant="destructive" 
                  className="w-full justify-start"
                  onClick={handleSeedData}
                  disabled={seeding}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${seeding ? 'animate-spin' : ''}`} />
                  {seeding ? 'Seeding...' : 'Reset demo data (dev only)'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Resets all demo users, teams, and performance data.
                </p>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </div>
    </AppLayout>
  );
}
