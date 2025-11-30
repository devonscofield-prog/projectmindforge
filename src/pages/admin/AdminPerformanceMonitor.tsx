import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Activity, Database, Zap, AlertTriangle, TrendingUp, Bell, BarChart3 } from 'lucide-react';
import { PerformanceHealthCard } from '@/components/admin/PerformanceHealthCard';
import {
  PerformanceTimelineChart,
  ErrorRateChart,
  EdgeFunctionBarChart,
  QueryBreakdownChart,
} from '@/components/admin/PerformanceCharts';
import { AlertConfigPanel } from '@/components/admin/AlertConfigPanel';
import { PerformanceReportExport } from '@/components/admin/PerformanceReportExport';
import {
  getSystemHealth,
  getPerformanceSummary,
  getMetricsTimeline,
  cleanupOldMetrics,
} from '@/api/performanceMetrics';
import { getBenchmarkComparison } from '@/api/performanceBenchmarks';
import { PerformanceBenchmarkCard } from '@/components/admin/PerformanceBenchmarkCard';
import { PerformanceDrillDown } from '@/components/admin/PerformanceDrillDown';
import { toast } from 'sonner';

const TIME_RANGE_OPTIONS = [
  { value: '1', label: 'Last Hour' },
  { value: '6', label: 'Last 6 Hours' },
  { value: '24', label: 'Last 24 Hours' },
  { value: '72', label: 'Last 3 Days' },
];

export default function AdminPerformanceMonitor() {
  const [timeRange, setTimeRange] = useState('24');

  const {
    data: systemHealth,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: getSystemHealth,
    refetchInterval: 60000, // Refresh every minute
  });

  const {
    data: performanceSummary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
  } = useQuery({
    queryKey: ['performance-summary', timeRange],
    queryFn: () => getPerformanceSummary(parseInt(timeRange)),
  });

  const {
    data: metricsTimeline,
    isLoading: timelineLoading,
    refetch: refetchTimeline,
  } = useQuery({
    queryKey: ['metrics-timeline', timeRange],
    queryFn: () => getMetricsTimeline(parseInt(timeRange)),
  });

  const {
    data: benchmarkComparison,
    isLoading: benchmarkLoading,
    refetch: refetchBenchmark,
  } = useQuery({
    queryKey: ['benchmark-comparison'],
    queryFn: () => getBenchmarkComparison(1, 7),
    refetchInterval: 60000,
  });

  const handleRefresh = () => {
    refetchHealth();
    refetchSummary();
    refetchTimeline();
    refetchBenchmark();
    toast.success('Metrics refreshed');
  };

  const handleCleanup = async () => {
    try {
      const deleted = await cleanupOldMetrics();
      toast.success(`Cleaned up ${deleted} old metrics`);
    } catch (error) {
      toast.error('Failed to cleanup metrics');
    }
  };

  const isLoading = healthLoading || summaryLoading || timelineLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Performance Monitor</h1>
            <p className="text-muted-foreground">
              Track system performance and identify when to upgrade
            </p>
          </div>
          <div className="flex items-center gap-3">
            <PerformanceDrillDown timeRange={timeRange} />
            <PerformanceReportExport />
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Upgrade Recommendation Banner */}
        {systemHealth?.recommendation && (
          <Alert variant={systemHealth.overallHealth === 'critical' ? 'destructive' : 'default'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>
              {systemHealth.overallHealth === 'critical'
                ? 'Performance Critical'
                : 'Performance Warning'}
            </AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>{systemHealth.recommendation}</span>
              <Badge
                variant={
                  systemHealth.overallHealth === 'critical' ? 'destructive' : 'secondary'
                }
              >
                {systemHealth.overallHealth.toUpperCase()}
              </Badge>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs for Metrics and Alerts */}
        <Tabs defaultValue="metrics" className="space-y-6">
          <TabsList>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell className="h-4 w-4" />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-6">
            {/* Health Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {healthLoading ? (
            <>
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <Skeleton className="h-20" />
                  </CardContent>
                </Card>
              ))}
            </>
          ) : systemHealth ? (
            <>
              <PerformanceHealthCard
                title="Avg Query Time"
                value={systemHealth.queryHealth.value || 0}
                unit="ms"
                status={systemHealth.queryHealth.level}
                subtitle="Last hour average"
                icon={Database}
              />
              <PerformanceHealthCard
                title="Avg Edge Function"
                value={systemHealth.edgeFunctionHealth.value || 0}
                unit="ms"
                status={systemHealth.edgeFunctionHealth.level}
                subtitle="Last hour average"
                icon={Zap}
              />
              <PerformanceHealthCard
                title="Error Rate"
                value={systemHealth.errorRateHealth.value || 0}
                unit="%"
                status={systemHealth.errorRateHealth.level}
                subtitle="Last hour"
                icon={AlertTriangle}
              />
              <PerformanceHealthCard
                title="Overall Health"
                value={
                  systemHealth.overallHealth === 'healthy'
                    ? 'Good'
                    : systemHealth.overallHealth === 'warning'
                    ? 'Fair'
                    : 'Poor'
                }
                status={systemHealth.overallHealth}
                subtitle="System status"
                icon={Activity}
              />
            </>
          ) : (
            <Card className="col-span-full">
              <CardContent className="p-8 text-center text-muted-foreground">
                No health data available. Metrics will appear as the system is used.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Threshold Reference */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Performance Thresholds
            </CardTitle>
            <CardDescription>
              Reference guide for when to consider instance upgrades
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Query Time</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-500">● Healthy</span>
                    <span className="text-muted-foreground">&lt; 500ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500">● Warning</span>
                    <span className="text-muted-foreground">500-1500ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-destructive">● Critical</span>
                    <span className="text-muted-foreground">&gt; 1500ms</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Edge Functions</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-500">● Healthy</span>
                    <span className="text-muted-foreground">&lt; 3s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500">● Warning</span>
                    <span className="text-muted-foreground">3-8s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-destructive">● Critical</span>
                    <span className="text-muted-foreground">&gt; 8s</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Error Rate</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-emerald-500">● Healthy</span>
                    <span className="text-muted-foreground">&lt; 1%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-amber-500">● Warning</span>
                    <span className="text-muted-foreground">1-5%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-destructive">● Critical</span>
                    <span className="text-muted-foreground">&gt; 5%</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {timelineLoading ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-[250px]" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-[250px]" />
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <PerformanceTimelineChart
                data={metricsTimeline || []}
                title="Response Time Over Time"
              />
              <ErrorRateChart data={metricsTimeline || []} />
            </>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {summaryLoading ? (
            <>
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <Skeleton className="h-[300px]" />
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <EdgeFunctionBarChart data={performanceSummary || []} />
              <QueryBreakdownChart data={performanceSummary || []} />
            </>
          )}
        </div>

        {/* Benchmark Comparison */}
        <PerformanceBenchmarkCard
          comparisons={benchmarkComparison || []}
          isLoading={benchmarkLoading}
        />

        {/* Maintenance Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance</CardTitle>
            <CardDescription>
              Database cleanup and maintenance operations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleCleanup}>
              Clean Up Old Metrics (30+ days)
            </Button>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <AlertConfigPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
