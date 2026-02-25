import { useMemo, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';
import type { WPMDataPoint, SpeakerInfo } from '@/types/audioAnalysis';

/** Fixed speaker color palette */
const SPEAKER_COLORS = [
  'hsl(var(--primary))',
  'hsl(142, 71%, 45%)',
  'hsl(38, 92%, 50%)',
  'hsl(280, 65%, 60%)',
  'hsl(190, 80%, 45%)',
];

/** Gradient ID prefix for area fills */
const GRADIENT_PREFIX = 'wpmGradient';

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface WPMTimelineChartProps {
  data: WPMDataPoint[];
  speakers: SpeakerInfo[];
  callDurationSeconds: number;
  onTimestampClick?: (seconds: number) => void;
  className?: string;
}

interface WPMTooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

interface WPMTooltipProps {
  active?: boolean;
  payload?: WPMTooltipPayloadEntry[];
  label?: number;
  speakerMap: Map<string, SpeakerInfo>;
}

function WPMCustomTooltip({ active, payload, label, speakerMap }: WPMTooltipProps) {
  if (!active || !payload || payload.length === 0 || label == null) {
    return null;
  }

  return (
    <div
      className="rounded-lg border border-border/50 bg-card px-3 py-2 shadow-md"
      style={{ fontSize: '12px' }}
    >
      <p className="mb-1 font-medium text-foreground">{formatTimestamp(label)}</p>
      {payload.map((entry) => {
        const speakerId = entry.dataKey;
        const speaker = speakerMap.get(speakerId);
        const label = speaker?.label ?? speakerId;
        return (
          <p key={speakerId} className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            {label}: <span className="font-medium text-foreground">{Math.round(entry.value)} WPM</span>
          </p>
        );
      })}
    </div>
  );
}

export function WPMTimelineChart({
  data,
  speakers,
  callDurationSeconds,
  onTimestampClick,
  className,
}: WPMTimelineChartProps) {
  const speakerMap = useMemo(
    () => new Map(speakers.map((s) => [s.id, s])),
    [speakers],
  );

  const speakerIds = useMemo(
    () => speakers.map((s) => s.id),
    [speakers],
  );

  /**
   * Pivot the flat WPMDataPoint[] into rows keyed by timestamp_sec,
   * with one column per speaker, suitable for Recharts multi-series.
   */
  const chartData = useMemo(() => {
    if (data.length === 0) return [];

    const byTimestamp = new Map<number, Record<string, number>>();
    for (const point of data) {
      let row = byTimestamp.get(point.timestamp_sec);
      if (!row) {
        row = { timestamp_sec: point.timestamp_sec };
        byTimestamp.set(point.timestamp_sec, row);
      }
      row[point.speaker] = point.wpm;
    }

    return Array.from(byTimestamp.values()).sort(
      (a, b) => (a.timestamp_sec as number) - (b.timestamp_sec as number),
    );
  }, [data]);

  const handleChartClick = useCallback(
    // Recharts CategoricalChartFunc has a complex signature; use any for the event state
    (state: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      if (onTimestampClick && state?.activeLabel != null) {
        onTimestampClick(Number(state.activeLabel));
      }
    },
    [onTimestampClick],
  );

  /** Compute X-axis tick interval based on call duration */
  const xDomain = useMemo<[number, number]>(() => {
    return [0, callDurationSeconds > 0 ? callDurationSeconds : 60];
  }, [callDurationSeconds]);

  // Empty state
  if (data.length === 0) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Speaking Pace
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-muted-foreground">
            No speaking pace data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Speaking Pace
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
            onClick={handleChartClick}
            style={onTimestampClick ? { cursor: 'pointer' } : undefined}
          >
            <defs>
              {speakerIds.map((id, idx) => {
                const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
                return (
                  <linearGradient
                    key={id}
                    id={`${GRADIENT_PREFIX}-${idx}`}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                );
              })}
            </defs>

            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />

            {/* Ideal WPM reference band (120-160 WPM) */}
            <ReferenceArea
              y1={120}
              y2={160}
              fill="hsl(142, 71%, 45%)"
              fillOpacity={0.06}
              stroke="none"
              label={{
                value: 'Ideal 120-160',
                position: 'insideTopRight',
                fill: 'hsl(var(--muted-foreground))',
                fontSize: 10,
              }}
            />

            <XAxis
              dataKey="timestamp_sec"
              type="number"
              domain={xDomain}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatTimestamp}
              className="text-muted-foreground"
            />
            <YAxis
              domain={[0, 250]}
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              className="text-muted-foreground"
              label={{
                value: 'WPM',
                angle: -90,
                position: 'insideLeft',
                fontSize: 11,
                offset: 25,
              }}
            />

            <Tooltip
              content={<WPMCustomTooltip speakerMap={speakerMap} />}
            />

            {speakerIds.map((id, idx) => {
              const color = SPEAKER_COLORS[idx % SPEAKER_COLORS.length];
              return (
                <Area
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={speakerMap.get(id)?.label ?? id}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${GRADIENT_PREFIX}-${idx})`}
                  connectNulls
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>

        {/* Speaker legend */}
        <div className="mt-3 flex flex-wrap gap-4">
          {speakers.map((speaker, idx) => (
            <div key={speaker.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: SPEAKER_COLORS[idx % SPEAKER_COLORS.length] }}
              />
              <span>{speaker.label}</span>
              <span className="tabular-nums">({Math.round(speaker.avg_wpm)} avg)</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
