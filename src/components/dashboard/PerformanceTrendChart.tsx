import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PerformanceTrendDataPoint {
  date: string;
  score: number;
  label?: string;
}

type Period = '7d' | '30d' | '90d';

interface PerformanceTrendChartProps {
  data: PerformanceTrendDataPoint[];
  title: string;
  className?: string;
}

const periodLabels: Record<Period, string> = {
  '7d': '7 days',
  '30d': '30 days',
  '90d': '90 days',
};

export function PerformanceTrendChart({ data, title, className }: PerformanceTrendChartProps) {
  const [period, setPeriod] = useState<Period>('30d');

  // Filter data by period
  const now = new Date();
  const cutoff = new Date(now);
  if (period === '7d') cutoff.setDate(cutoff.getDate() - 7);
  else if (period === '30d') cutoff.setDate(cutoff.getDate() - 30);
  else cutoff.setDate(cutoff.getDate() - 90);

  const filteredData = data.filter(d => new Date(d.date) >= cutoff);

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <Button
              key={p}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs font-medium rounded-md',
                period === p && 'bg-background shadow-sm'
              )}
              onClick={() => setPeriod(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {filteredData.length === 0 ? (
          <p className="text-muted-foreground text-center py-12 text-sm">
            No data available for the last {periodLabels[period]}.
          </p>
        ) : (
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  labelFormatter={(label) => label}
                  formatter={(value: number, _name: string, props: { payload?: PerformanceTrendDataPoint }) => [
                    `${value}`,
                    props.payload?.label || 'Score',
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
