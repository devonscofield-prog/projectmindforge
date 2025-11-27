import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building2, BarChart3, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Stats {
  totalUsers: number;
  totalTeams: number;
  totalReps: number;
  totalManagers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTeams: 0,
    totalReps: 0,
    totalManagers: 0,
  });
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const fetchStats = async () => {
    // Fetch user count
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch team count
    const { count: teamCount } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    // Fetch role counts
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role');

    const repCount = roles?.filter((r) => r.role === 'rep').length || 0;
    const managerCount = roles?.filter((r) => r.role === 'manager').length || 0;

    setStats({
      totalUsers: userCount || 0,
      totalTeams: teamCount || 0,
      totalReps: repCount,
      totalManagers: managerCount,
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
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage teams, users, and settings</p>
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

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/admin/teams">Manage Teams</Link>
              </Button>
              <Button variant="outline" className="w-full justify-start" asChild>
                <Link to="/admin/users">Manage Users</Link>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Developer Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
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
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <span className="text-sm text-success">Connected</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Authentication</span>
                  <span className="text-sm text-success">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
