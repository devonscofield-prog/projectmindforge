import { useMemo, useCallback } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EnergySentimentDataPoint } from '@/types/audioAnalysis';

interface EnergySentimentArcProps {
  data: EnergySentimentDataPoint[];
  callDurationSeconds: number;
  onTimestampClick?: (seconds: number) => void;
  className?: string;
}

/** Format seconds into M:SS display */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Custom tooltip for the chart */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: number;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload as EnergySentimentDataPoint | undefined;
  const energy = payload.find((p) => p.dataKey === 'energy');
  const sentiment = payload.find((p) => p.dataKey === 'sentiment');

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground mb-1">{formatTime(label ?? 0)}</p>
      {dataPoint?.speaker && (
        <p className="text-xs text-muted-foreground mb-1">{dataPoint.speaker}</p>
      )}
      {energy && (
        <p className="text-amber-600 dark:text-amber-400">
          Energy: {Math.round(energy.value)}
        </p>
      )}
      {sentiment && (
        <p className={sentiment.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          Sentiment: {sentiment.value.toFixed(2)}
        </p>
      )}
    </div>
  );
}

export function EnergySentimentArc({
  data,
  callDurationSeconds,
  onTimestampClick,
  className,
}: EnergySentimentArcProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return [...data].sort((a, b) => a.timestamp_sec - b.timestamp_sec);
  }, [data]);

  const handleChartClick = useCallback(
    (event: { activePayload?: Array<{ payload: EnergySentimentDataPoint }> }) => {
      if (!onTimestampClick || !event?.activePayload?.[0]) return;
      const point = event.activePayload[0].payload;
      onTimestampClick(point.timestamp_sec);
    },
    [onTimestampClick],
  );

  /** Color the sentiment line dot based on value */
  const sentimentDot = useCallback(
    (props: { cx: number; cy: number; payload: EnergySentimentDataPoint }) => {
      const { cx, cy, payload } = props;
      const color = payload.sentiment >= 0 ? 'hsl(142, 76%, 36%)' : 'hsl(0, 84%, 60%)';
      return <circle cx={cx} cy={cy} r={3} fill={color} stroke="none" />;
    },
    [],
  );

  if (!data || data.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5" />
            Energy &amp; Sentiment
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No energy/sentiment data available for this call.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          Energy &amp; Sentiment
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              onClick={onTimestampClick ? handleChartClick : undefined}
              style={onTimestampClick ? { cursor: 'pointer' } : undefined}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="timestamp_sec"
                type="number"
                domain={[0, callDurationSeconds]}
                tickFormatter={formatTime}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
              />
              {/* Left Y axis: energy (0-100) */}
              <YAxis
                yAxisId="energy"
                orientation="left"
                domain={[0, 100]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                label={{
                  value: 'Energy',
                  angle: -90,
                  position: 'insideLeft',
                  style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                }}
              />
              {/* Right Y axis: sentiment (-1 to +1) */}
              <YAxis
                yAxisId="sentiment"
                orientation="right"
                domain={[-1, 1]}
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                tickFormatter={(v: number) => v.toFixed(1)}
                label={{
                  value: 'Sentiment',
                  angle: 90,
                  position: 'insideRight',
                  style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                }}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <ReferenceLine
                yAxisId="sentiment"
                y={0}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              {/* Energy area */}
              <Area
                yAxisId="energy"
                type="monotone"
                dataKey="energy"
                stroke="hsl(35, 92%, 50%)"
                fill="hsl(35, 92%, 50%)"
                fillOpacity={0.2}
                strokeWidth={2}
                name="Energy"
                connectNulls
              />
              {/* Sentiment line */}
              <Line
                yAxisId="sentiment"
                type="monotone"
                dataKey="sentiment"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                name="Sentiment"
                dot={sentimentDot}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500" />
            <span>Energy</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-green-500" />
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-0.5 bg-red-500" />
            <span>Negative</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
