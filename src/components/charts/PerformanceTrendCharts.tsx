import { useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { RepPerformanceSnapshot } from '@/types/database';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface TrendDataPoint {
  monthLabel: string;
  revenue_closed: number;
  revenue_goal: number;
  revenue_progress: number;
  demos_set: number;
  demo_goal: number;
  demos_progress: number;
  pipeline_count: number;
}

interface PerformanceTrendChartsProps {
  performance: RepPerformanceSnapshot[];
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatCurrency = (value: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0,
    notation: 'compact'
  }).format(value);

const formatCurrencyFull = (value: number) => 
  new Intl.NumberFormat('en-US', { 
    style: 'currency', 
    currency: 'USD', 
    maximumFractionDigits: 0 
  }).format(value);

export function PerformanceTrendCharts({ performance }: PerformanceTrendChartsProps) {
  // Process data: get last 6 months, sorted ascending by date
  const trendData: TrendDataPoint[] = useMemo(() => {
    if (!performance || performance.length === 0) return [];

    // Sort by year and month ascending
    const sorted = [...performance].sort((a, b) => {
      if (a.period_year !== b.period_year) {
        return a.period_year - b.period_year;
      }
      return a.period_month - b.period_month;
    });

    // Take the last 6 months
    const last6 = sorted.slice(-6);

    return last6.map((perf) => ({
      monthLabel: `${monthNames[perf.period_month - 1]} ${perf.period_year}`,
      revenue_closed: perf.revenue_closed,
      revenue_goal: perf.revenue_goal,
      revenue_progress: perf.revenue_goal > 0 ? perf.revenue_closed / perf.revenue_goal : 0,
      demos_set: perf.demos_set,
      demo_goal: perf.demo_goal,
      demos_progress: perf.demo_goal > 0 ? perf.demos_set / perf.demo_goal : 0,
      pipeline_count: perf.pipeline_count || 0,
    }));
  }, [performance]);

  // Not enough data to show trends
  if (trendData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Performance Trends
          </CardTitle>
          <CardDescription>Historical performance over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <BarChart3 className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">
              Not enough history to display trends yet.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              At least 2 months of data is required.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Performance Trends
        </CardTitle>
        <CardDescription>
          Trends for revenue, demos, and pipeline over the last {trendData.length} months
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Revenue vs Goal Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4 text-foreground">Revenue vs Goal</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={formatCurrency}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  width={60}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    formatCurrencyFull(value),
                    name === 'revenue_closed' ? 'Revenue Closed' : 'Revenue Goal'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Legend 
                  formatter={(value) => value === 'revenue_closed' ? 'Revenue Closed' : 'Revenue Goal'}
                />
                <Bar 
                  dataKey="revenue_goal" 
                  fill="hsl(var(--muted-foreground) / 0.3)" 
                  name="revenue_goal"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="revenue_closed" 
                  fill="hsl(var(--primary))" 
                  name="revenue_closed"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Demos vs Goal Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4 text-foreground">Demos vs Goal</h3>
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  width={40}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    value,
                    name === 'demos_set' ? 'Demos Set' : 'Demo Goal'
                  ]}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Legend 
                  formatter={(value) => value === 'demos_set' ? 'Demos Set' : 'Demo Goal'}
                />
                <Bar 
                  dataKey="demo_goal" 
                  fill="hsl(var(--muted-foreground) / 0.3)" 
                  name="demo_goal"
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="demos_set" 
                  fill="hsl(var(--success))" 
                  name="demos_set"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Trend Chart */}
        <div>
          <h3 className="text-sm font-semibold mb-4 text-foreground">Pipeline Count Trend</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="monthLabel" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  width={40}
                />
                <Tooltip 
                  formatter={(value: number) => [value, 'Pipeline Count']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    color: 'hsl(var(--popover-foreground))'
                  }}
                />
                <Legend formatter={() => 'Pipeline Count'} />
                <Line 
                  type="monotone" 
                  dataKey="pipeline_count" 
                  stroke="hsl(var(--warning))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--warning))', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
