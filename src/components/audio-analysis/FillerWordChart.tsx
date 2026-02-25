import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MessageCircleWarning } from 'lucide-react';
import type { FillerWordBreakdown } from '@/types/audioAnalysis';

interface FillerWordChartProps {
  data: FillerWordBreakdown;
  className?: string;
}

interface FillerBarData {
  word: string;
  count: number;
}

function getSeverityBadge(perMinute: number): { label: string; className: string } {
  if (perMinute < 2) {
    return {
      label: `${perMinute.toFixed(1)} fillers/min`,
      className: 'bg-green-500/20 text-green-700 dark:text-green-400 border-transparent',
    };
  }
  if (perMinute <= 5) {
    return {
      label: `${perMinute.toFixed(1)} fillers/min`,
      className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-transparent',
    };
  }
  return {
    label: `${perMinute.toFixed(1)} fillers/min`,
    className: 'bg-red-500/20 text-red-700 dark:text-red-400 border-transparent',
  };
}

export function FillerWordChart({ data, className }: FillerWordChartProps) {
  const chartData = useMemo<FillerBarData[]>(() => {
    if (!data.by_word || Object.keys(data.by_word).length === 0) return [];

    return Object.entries(data.by_word)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count);
  }, [data.by_word]);

  const severity = getSeverityBadge(data.per_minute);

  // Empty state
  if (data.total_count === 0 || chartData.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircleWarning className="h-4 w-4" />
              Filler Words
            </div>
            <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-400 border-transparent">
              0 fillers/min
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No filler words detected
          </div>
        </CardContent>
      </Card>
    );
  }

  /** Dynamic height based on number of filler word types (min 150, max 300) */
  const chartHeight = Math.max(150, Math.min(300, chartData.length * 40 + 30));

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircleWarning className="h-4 w-4" />
            Filler Words
          </div>
          <Badge variant="secondary" className={cn(severity.className)}>
            {severity.label}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              className="text-muted-foreground"
            />
            <YAxis
              type="category"
              dataKey="word"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={60}
              className="text-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
              formatter={(value: number) => [`${value} times`, 'Count']}
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
            />
            <Bar
              dataKey="count"
              name="Count"
              fill="hsl(var(--primary))"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Summary footer */}
        <div className="mt-3 flex justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
          <span>Total: <span className="font-medium text-foreground">{data.total_count}</span> filler words</span>
          <span>
            Most common: <span className="font-medium text-foreground">
              &ldquo;{chartData[0]?.word}&rdquo;
            </span>{' '}
            ({chartData[0]?.count})
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
