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
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import type { PerformanceSummary } from '@/api/performanceMetrics';

interface TimelineData {
  hour: string;
  avg_duration: number;
  count: number;
  error_rate: number;
}

interface PerformanceTimelineChartProps {
  data: TimelineData[];
  title: string;
}

export function PerformanceTimelineChart({ data, title }: PerformanceTimelineChartProps) {
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      time: format(parseISO(item.hour), 'HH:mm'),
      fullTime: format(parseISO(item.hour), 'MMM d, HH:mm'),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{
                value: 'ms',
                angle: -90,
                position: 'insideLeft',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullTime;
                }
                return label;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="avg_duration"
              name="Avg Duration (ms)"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ErrorRateChartProps {
  data: TimelineData[];
}

export function ErrorRateChart({ data }: ErrorRateChartProps) {
  const formattedData = useMemo(() => {
    return data.map((item) => ({
      ...item,
      time: format(parseISO(item.hour), 'HH:mm'),
      fullTime: format(parseISO(item.hour), 'MMM d, HH:mm'),
    }));
  }, [data]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Error Rate Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Error Rate Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={formattedData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              domain={[0, 'auto']}
              label={{
                value: '%',
                angle: -90,
                position: 'insideLeft',
                fontSize: 12,
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullTime;
                }
                return label;
              }}
              formatter={(value: number) => [`${value}%`, 'Error Rate']}
            />
            <Line
              type="monotone"
              dataKey="error_rate"
              name="Error Rate"
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface EdgeFunctionBarChartProps {
  data: PerformanceSummary[];
}

export function EdgeFunctionBarChart({ data }: EdgeFunctionBarChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.metric_type === 'edge_function')
      .sort((a, b) => b.avg_duration_ms - a.avg_duration_ms)
      .slice(0, 10)
      .map((item) => ({
        name: item.metric_name.replace(/-/g, ' ').slice(0, 20),
        fullName: item.metric_name,
        avg: Math.round(item.avg_duration_ms),
        p90: Math.round(item.p90_duration_ms),
        p99: Math.round(item.p99_duration_ms),
        calls: item.total_count,
        errors: item.error_count,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Edge Function Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No edge function data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Edge Function Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
              label={{
                value: 'ms',
                position: 'insideBottom',
                offset: -5,
                fontSize: 12,
              }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              width={120}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
            />
            <Legend />
            <Bar
              dataKey="avg"
              name="Avg (ms)"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
            />
            <Bar
              dataKey="p90"
              name="P90 (ms)"
              fill="hsl(var(--muted-foreground))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface QueryBreakdownChartProps {
  data: PerformanceSummary[];
}

export function QueryBreakdownChart({ data }: QueryBreakdownChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((d) => d.metric_type === 'query')
      .sort((a, b) => b.total_count - a.total_count)
      .slice(0, 10)
      .map((item) => ({
        name: item.metric_name.slice(0, 20),
        fullName: item.metric_name,
        avg: Math.round(item.avg_duration_ms),
        count: item.total_count,
        errorRate: Math.round(item.error_rate * 10) / 10,
      }));
  }, [data]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Query Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No query data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Query Performance (by frequency)</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              height={80}
              className="text-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 12 }}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  return payload[0].payload.fullName;
                }
                return label;
              }}
            />
            <Legend />
            <Bar
              dataKey="avg"
              name="Avg Duration (ms)"
              fill="hsl(var(--primary))"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
