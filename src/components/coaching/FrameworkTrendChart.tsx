import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { TrendingUp } from 'lucide-react';

interface FrameworkTrendChartProps {
  data: Array<{
    date: string;
    meddpicc?: number | null; // New MEDDPICC
    bant?: number | null; // Legacy BANT
    gap_selling: number | null;
    active_listening: number | null;
  }>;
}

export function FrameworkTrendChart({ data }: FrameworkTrendChartProps) {
  // Transform data, using MEDDPICC if available, falling back to BANT for legacy
  const chartData = data.map(d => {
    // primaryScore used for chart data transformation
    return {
      date: format(new Date(d.date), 'MMM d'),
      'MEDDPICC': d.meddpicc ?? null,
      'BANT (Legacy)': d.meddpicc == null ? d.bant : null, // Only show BANT if no MEDDPICC
      'Gap Selling': d.gap_selling,
      'Active Listening': d.active_listening,
    };
  });

  // Determine if we have any MEDDPICC data or only legacy BANT
  const hasMeddpicc = data.some(d => d.meddpicc != null);
  const hasLegacyBant = data.some(d => d.meddpicc == null && d.bant != null);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5" />
            Framework Performance Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No call data available for the selected period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="h-5 w-5" />
          Framework Performance Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                domain={[0, 100]} 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              {hasMeddpicc && (
                <Line
                  type="monotone"
                  dataKey="MEDDPICC"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls
                />
              )}
              {hasLegacyBant && (
                <Line
                  type="monotone"
                  dataKey="BANT (Legacy)"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  connectNulls
                />
              )}
              <Line
                type="monotone"
                dataKey="Gap Selling"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="Active Listening"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
