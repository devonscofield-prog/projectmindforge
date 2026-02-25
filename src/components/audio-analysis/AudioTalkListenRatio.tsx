import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Mic } from 'lucide-react';
import type { AudioTalkListenRatio as AudioTalkListenRatioData } from '@/types/audioAnalysis';

interface AudioTalkListenRatioProps {
  data: AudioTalkListenRatioData;
  className?: string;
}

interface Segment {
  label: string;
  pct: number;
  color: string;
  textColor: string;
}

/**
 * Score the talk/listen balance on a 0-100 scale.
 * Best score when rep is between 40-60%.
 */
function computeBalanceScore(repPct: number): number {
  const ideal = 50;
  const distance = Math.abs(repPct - ideal);
  // 0 distance = 100 score; 50 distance = 0 score
  return Math.max(0, Math.round(100 - distance * 2));
}

function getAssessmentText(repPct: number): { text: string; className: string } {
  if (repPct >= 40 && repPct <= 60) {
    return { text: 'Good balance', className: 'bg-green-500/20 text-green-700 dark:text-green-400' };
  }
  if (repPct > 60) {
    return { text: 'Rep dominated', className: 'bg-orange-500/20 text-orange-700 dark:text-orange-400' };
  }
  return { text: 'Prospect dominated', className: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' };
}

export function AudioTalkListenRatio({ data, className }: AudioTalkListenRatioProps) {
  const segments = useMemo<Segment[]>(() => {
    const result: Segment[] = [];

    if (data.rep_talk_pct > 0) {
      result.push({
        label: 'Rep',
        pct: data.rep_talk_pct,
        color: 'hsl(var(--primary))',
        textColor: 'text-primary-foreground',
      });
    }

    if (data.prospect_talk_pct > 0) {
      result.push({
        label: 'Prospect',
        pct: data.prospect_talk_pct,
        color: 'hsl(142, 71%, 45%)',
        textColor: 'text-white',
      });
    }

    if (data.silence_pct > 0) {
      result.push({
        label: 'Silence',
        pct: data.silence_pct,
        color: 'hsl(var(--muted))',
        textColor: 'text-muted-foreground',
      });
    }

    return result;
  }, [data]);

  const score = computeBalanceScore(data.rep_talk_pct);
  const assessment = getAssessmentText(data.rep_talk_pct);

  // Format total duration
  const durationLabel = useMemo(() => {
    if (data.total_duration_sec <= 0) return '';
    const mins = Math.floor(data.total_duration_sec / 60);
    const secs = Math.floor(data.total_duration_sec % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [data.total_duration_sec]);

  // Empty / zero state
  const hasData = data.rep_talk_pct > 0 || data.prospect_talk_pct > 0;

  if (!hasData) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Talk/Listen Ratio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            No talk/listen data available
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Talk/Listen Ratio
          </div>
          {durationLabel && (
            <span className="text-xs font-normal text-muted-foreground">{durationLabel} total</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Percentage labels above bar */}
        <div className="flex justify-between text-xs mb-1">
          <span className="text-muted-foreground">Rep: {Math.round(data.rep_talk_pct)}%</span>
          <span className="text-muted-foreground">Prospect: {Math.round(data.prospect_talk_pct)}%</span>
        </div>

        {/* Stacked horizontal bar */}
        <div className="relative h-8 w-full rounded-full overflow-hidden flex">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className="relative h-full flex items-center justify-center transition-all"
              style={{
                width: `${segment.pct}%`,
                backgroundColor: segment.color,
                minWidth: segment.pct > 0 ? '24px' : '0',
              }}
            >
              {segment.pct >= 10 && (
                <span className={cn('text-[10px] font-medium', segment.textColor)}>
                  {Math.round(segment.pct)}%
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Segment legend */}
        <div className="mt-3 flex flex-wrap gap-3">
          {segments.map((segment) => (
            <div key={segment.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: segment.color }}
              />
              <span>{segment.label}</span>
              <span className="tabular-nums font-medium text-foreground">
                {Math.round(segment.pct)}%
              </span>
            </div>
          ))}
        </div>

        {/* Score indicator */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Balance Score</span>
            <span className="text-sm font-bold tabular-nums">{score}/100</span>
          </div>
          <div className="h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                score >= 70
                  ? 'bg-green-500'
                  : score >= 40
                    ? 'bg-yellow-500'
                    : 'bg-orange-500',
              )}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex justify-center">
            <Badge variant="secondary" className={cn('text-xs border-transparent', assessment.className)}>
              {assessment.text}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
