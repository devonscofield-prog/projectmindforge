import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge, getPerformanceStatus } from '@/components/ui/status-badge';
import { RepPerformanceSnapshot } from '@/types/database';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function RepPerformance() {
  const { user } = useAuth();
  const [performance, setPerformance] = useState<RepPerformanceSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from('rep_performance_snapshots')
        .select('*')
        .eq('rep_id', user.id)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

      if (data) {
        setPerformance(data as unknown as RepPerformanceSnapshot[]);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

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
          <h1 className="text-3xl font-bold">Performance History</h1>
          <p className="text-muted-foreground mt-1">Your monthly performance metrics</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            {performance.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead className="w-[200px]">Revenue Progress</TableHead>
                    <TableHead>Demos</TableHead>
                    <TableHead className="w-[200px]">Demo Progress</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.map((perf) => {
                    const revenueStatus = getPerformanceStatus(perf.revenue_closed, perf.revenue_goal);
                    const demoStatus = getPerformanceStatus(perf.demos_set, perf.demo_goal);
                    const overallStatus = revenueStatus === 'off-track' || demoStatus === 'off-track' 
                      ? 'off-track' 
                      : revenueStatus === 'at-risk' || demoStatus === 'at-risk'
                      ? 'at-risk'
                      : 'on-track';

                    return (
                      <TableRow key={perf.id}>
                        <TableCell className="font-medium">
                          {monthNames[perf.period_month - 1]} {perf.period_year}
                        </TableCell>
                        <TableCell>
                          {formatCurrency(perf.revenue_closed)} / {formatCurrency(perf.revenue_goal)}
                        </TableCell>
                        <TableCell>
                          <ProgressBar value={perf.revenue_closed} goal={perf.revenue_goal} showLabel={false} size="sm" />
                        </TableCell>
                        <TableCell>
                          {perf.demos_set} / {perf.demo_goal}
                        </TableCell>
                        <TableCell>
                          <ProgressBar value={perf.demos_set} goal={perf.demo_goal} showLabel={false} size="sm" />
                        </TableCell>
                        <TableCell>{perf.pipeline_count || '-'}</TableCell>
                        <TableCell>
                          <StatusBadge status={overallStatus}>
                            {overallStatus === 'on-track' ? 'On Track' : overallStatus === 'at-risk' ? 'At Risk' : 'Off Track'}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No performance data available yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
