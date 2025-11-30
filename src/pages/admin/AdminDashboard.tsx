import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Building2, BarChart3, RefreshCw, ChevronDown, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GlobalActivityFeed } from '@/components/admin/GlobalActivityFeed';
import { CallTrendsChart } from '@/components/admin/CallTrendsChart';
import { subDays } from 'date-fns';

export default function AdminDashboard() {
  const { role } = useAuth();
  const [seeding, setSeeding] = useState(false);

  // Consolidated stats query
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: async () => {
      const sevenDaysAgo = subDays(new Date(), 7).toISOString();

      // Run all queries in parallel for better performance
      const [
        { count: userCount },
        { count: teamCount },
        { data: roles },
        { count: callsCount },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('teams').select('*', { count: 'exact', head: true }),
        supabase.from('user_roles').select('role'),
        supabase
          .from('call_transcripts')
          .select('*', { count: 'exact', head: true })
          .eq('analysis_status', 'completed')
          .gte('created_at', sevenDaysAgo),
      ]);

      const repCount = roles?.filter((r) => r.role === 'rep').length || 0;
      const managerCount = roles?.filter((r) => r.role === 'manager').length || 0;

      return {
        totalUsers: userCount || 0,
        totalTeams: teamCount || 0,
        totalReps: repCount,
        totalManagers: managerCount,
        callsAnalyzedLast7Days: callsCount || 0,
      };
    },
    staleTime: 60 * 1000, // 1 minute
  });

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      const response = await supabase.functions.invoke('seed-demo-data');
      
      if (response.error) {
        throw new Error(response.error.message);
      }
      
      toast.success('Demo data reset successfully');
      refetch();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed data';
      toast.error(errorMessage);
    } finally {
      setSeeding(false);
    }
  };

  if (isLoading) {
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

        <div className="grid gap-6 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats?.totalUsers ?? 0}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Teams</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats?.totalTeams ?? 0}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sales Reps</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats?.totalReps ?? 0}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Managers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats?.totalManagers ?? 0}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Calls (7d)</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-3xl font-bold">{stats?.callsAnalyzedLast7Days ?? 0}</span>
              <p className="text-xs text-muted-foreground mt-1">Analyzed</p>
            </CardContent>
          </Card>
        </div>

        {/* Call Trends Chart */}
        <CallTrendsChart />

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
