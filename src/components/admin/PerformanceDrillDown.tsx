import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { AlertTriangle, Database, Zap, TrendingUp, Clock, Search } from 'lucide-react';
import { getPerformanceSummary, type PerformanceSummary } from '@/api/performanceMetrics';

type SortField = 'avg_duration_ms' | 'p90_duration_ms' | 'p99_duration_ms' | 'error_rate' | 'total_count';
type SortOrder = 'asc' | 'desc';

interface PerformanceDrillDownProps {
  timeRange: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatMetricName(name: string): string {
  return name
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

function getHealthBadge(avgMs: number, type: 'query' | 'edge_function') {
  const thresholds = type === 'query' 
    ? { good: 300, warning: 1000 }
    : { good: 2000, warning: 5000 };

  if (avgMs <= thresholds.good) {
    return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Healthy</Badge>;
  }
  if (avgMs <= thresholds.warning) {
    return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Warning</Badge>;
  }
  return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">Critical</Badge>;
}

function MetricTable({ 
  data, 
  type,
  sortField,
  sortOrder,
  onSort,
}: { 
  data: PerformanceSummary[];
  type: 'query' | 'edge_function';
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
}) {
  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const SortHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-xs">{sortOrder === 'desc' ? '↓' : '↑'}</span>
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">Operation</TableHead>
            <TableHead>Status</TableHead>
            <SortHeader field="avg_duration_ms">Avg</SortHeader>
            <SortHeader field="p90_duration_ms">P90</SortHeader>
            <SortHeader field="p99_duration_ms">P99</SortHeader>
            <SortHeader field="total_count">Calls</SortHeader>
            <SortHeader field="error_rate">Error %</SortHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                No {type === 'query' ? 'query' : 'edge function'} data available for this time range.
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((metric, idx) => (
              <TableRow key={`${metric.metric_name}-${idx}`}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {type === 'query' ? (
                      <Database className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Zap className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="truncate max-w-[200px]" title={metric.metric_name}>
                      {formatMetricName(metric.metric_name)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{getHealthBadge(metric.avg_duration_ms, type)}</TableCell>
                <TableCell className="tabular-nums">{formatDuration(metric.avg_duration_ms)}</TableCell>
                <TableCell className="tabular-nums">{formatDuration(metric.p90_duration_ms)}</TableCell>
                <TableCell className="tabular-nums font-medium">
                  <span className={metric.p99_duration_ms > (type === 'query' ? 1500 : 8000) ? 'text-destructive' : ''}>
                    {formatDuration(metric.p99_duration_ms)}
                  </span>
                </TableCell>
                <TableCell className="tabular-nums">{metric.total_count.toLocaleString()}</TableCell>
                <TableCell className="tabular-nums">
                  <span className={metric.error_rate > 5 ? 'text-destructive font-medium' : metric.error_rate > 1 ? 'text-yellow-500' : ''}>
                    {metric.error_rate.toFixed(2)}%
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ImpactSummary({ data, type }: { data: PerformanceSummary[]; type: 'query' | 'edge_function' }) {
  if (data.length === 0) return null;

  const totalCalls = data.reduce((sum, m) => sum + m.total_count, 0);
  void data.reduce((sum, m) => sum + m.error_count, 0);
  
  // Find worst performers
  const slowest = [...data].sort((a, b) => b.p99_duration_ms - a.p99_duration_ms)[0];
  const mostErrors = [...data].sort((a, b) => b.error_rate - a.error_rate)[0];
  const mostCalled = [...data].sort((a, b) => b.total_count - a.total_count)[0];

  const thresholds = type === 'query' ? { warning: 1000 } : { warning: 5000 };
  const slowOperations = data.filter((m) => m.avg_duration_ms > thresholds.warning);
  const errorProne = data.filter((m) => m.error_rate > 1);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
      <Card className="border-l-4 border-l-primary">
        <CardContent className="pt-4">
          <div className="text-2xl font-bold">{data.length}</div>
          <p className="text-xs text-muted-foreground">
            Total {type === 'query' ? 'queries' : 'functions'} tracked
          </p>
          <p className="text-sm mt-1">{totalCalls.toLocaleString()} total calls</p>
        </CardContent>
      </Card>

      <Card className={`border-l-4 ${slowOperations.length > 0 ? 'border-l-destructive' : 'border-l-emerald-500'}`}>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`h-5 w-5 ${slowOperations.length > 0 ? 'text-destructive' : 'text-emerald-500'}`} />
            <div className="text-2xl font-bold">{slowOperations.length}</div>
          </div>
          <p className="text-xs text-muted-foreground">Slow operations</p>
          {slowest && (
            <p className="text-sm mt-1 truncate" title={slowest.metric_name}>
              Worst: {formatMetricName(slowest.metric_name).slice(0, 20)}...
            </p>
          )}
        </CardContent>
      </Card>

      <Card className={`border-l-4 ${errorProne.length > 0 ? 'border-l-yellow-500' : 'border-l-emerald-500'}`}>
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <TrendingUp className={`h-5 w-5 ${errorProne.length > 0 ? 'text-yellow-500' : 'text-emerald-500'}`} />
            <div className="text-2xl font-bold">{errorProne.length}</div>
          </div>
          <p className="text-xs text-muted-foreground">High error operations</p>
          {mostErrors && mostErrors.error_rate > 0 && (
            <p className="text-sm mt-1">Highest: {mostErrors.error_rate.toFixed(1)}%</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="pt-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-500" />
            <div className="text-2xl font-bold">{mostCalled?.total_count.toLocaleString() || 0}</div>
          </div>
          <p className="text-xs text-muted-foreground">Most called operation</p>
          {mostCalled && (
            <p className="text-sm mt-1 truncate" title={mostCalled.metric_name}>
              {formatMetricName(mostCalled.metric_name).slice(0, 25)}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function PerformanceDrillDown({ timeRange }: PerformanceDrillDownProps) {
  const [activeTab, setActiveTab] = useState<'queries' | 'edge_functions'>('queries');
  const [sortField, setSortField] = useState<SortField>('avg_duration_ms');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { data: summary, isLoading } = useQuery({
    queryKey: ['performance-drilldown', timeRange],
    queryFn: () => getPerformanceSummary(parseInt(timeRange)),
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const queryData = summary?.filter((s) => s.metric_type === 'query') || [];
  const edgeFunctionData = summary?.filter((s) => s.metric_type === 'edge_function') || [];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Search className="h-4 w-4" />
          Drill Down
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Performance Drill-Down
          </SheetTitle>
          <SheetDescription>
            Identify specific queries and edge functions contributing to performance issues
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'queries' | 'edge_functions')}>
            <div className="flex items-center justify-between mb-4">
              <TabsList>
                <TabsTrigger value="queries" className="gap-2">
                  <Database className="h-4 w-4" />
                  Queries ({queryData.length})
                </TabsTrigger>
                <TabsTrigger value="edge_functions" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Edge Functions ({edgeFunctionData.length})
                </TabsTrigger>
              </TabsList>

              <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="avg_duration_ms">Avg Duration</SelectItem>
                  <SelectItem value="p90_duration_ms">P90 Latency</SelectItem>
                  <SelectItem value="p99_duration_ms">P99 Latency</SelectItem>
                  <SelectItem value="error_rate">Error Rate</SelectItem>
                  <SelectItem value="total_count">Call Count</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <TabsContent value="queries" className="mt-0">
              <ImpactSummary data={queryData} type="query" />
              {isLoading ? (
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              ) : (
                <MetricTable
                  data={queryData}
                  type="query"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              )}
            </TabsContent>

            <TabsContent value="edge_functions" className="mt-0">
              <ImpactSummary data={edgeFunctionData} type="edge_function" />
              {isLoading ? (
                <div className="h-64 bg-muted animate-pulse rounded-lg" />
              ) : (
                <MetricTable
                  data={edgeFunctionData}
                  type="edge_function"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              )}
            </TabsContent>
          </Tabs>

          <Card className="mt-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Understanding the Metrics</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p><strong>Avg:</strong> Average response time across all calls</p>
              <p><strong>P90:</strong> 90% of requests complete within this time (identifies typical slow cases)</p>
              <p><strong>P99:</strong> 99% of requests complete within this time (identifies worst-case scenarios)</p>
              <p><strong>Error %:</strong> Percentage of requests that failed or returned errors</p>
              <p className="pt-2 border-t">
                <strong>Tip:</strong> Focus on operations with high P99 latency or error rates first, 
                especially those with high call counts as they impact the most users.
              </p>
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  );
}
