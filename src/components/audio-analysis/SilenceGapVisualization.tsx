import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { PauseCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SilenceGap } from '@/types/audioAnalysis';

interface SilenceGapVisualizationProps {
  gaps: SilenceGap[];
  callDurationSeconds: number;
  onTimestampClick?: (seconds: number) => void;
  className?: string;
}

type GapAssessment = 'productive' | 'neutral' | 'awkward';

/** Derive an assessment from gap characteristics when no explicit assessment exists. */
function assessGap(gap: SilenceGap): GapAssessment {
  // Short pauses after questions (preceded by question marks) are productive
  const afterQuestion = gap.preceding_text?.trim().endsWith('?') ?? false;

  if (gap.duration_sec <= 3) {
    return afterQuestion ? 'productive' : 'neutral';
  }
  if (gap.duration_sec <= 6) {
    return afterQuestion ? 'productive' : 'neutral';
  }
  // Long silences are awkward unless they follow a question (thinking time)
  if (gap.duration_sec <= 10) {
    return afterQuestion ? 'neutral' : 'awkward';
  }
  return 'awkward';
}

const ASSESSMENT_COLORS: Record<GapAssessment, { bg: string; border: string; label: string }> = {
  productive: {
    bg: 'bg-green-500/70 hover:bg-green-500/90',
    border: 'border-green-600',
    label: 'Productive pause',
  },
  neutral: {
    bg: 'bg-amber-400/70 hover:bg-amber-400/90',
    border: 'border-amber-500',
    label: 'Neutral silence',
  },
  awkward: {
    bg: 'bg-red-500/70 hover:bg-red-500/90',
    border: 'border-red-600',
    label: 'Awkward silence',
  },
};

/** Format seconds into M:SS */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function SilenceGapVisualization({
  gaps,
  callDurationSeconds,
  onTimestampClick,
  className,
}: SilenceGapVisualizationProps) {
  const [hoveredGapIndex, setHoveredGapIndex] = useState<number | null>(null);

  const assessedGaps = useMemo(() => {
    if (!gaps || gaps.length === 0) return [];
    return gaps.map((gap) => ({
      ...gap,
      assessment: assessGap(gap),
    }));
  }, [gaps]);

  const stats = useMemo(() => {
    const counts: Record<GapAssessment, number> = { productive: 0, neutral: 0, awkward: 0 };
    for (const gap of assessedGaps) {
      counts[gap.assessment]++;
    }
    return counts;
  }, [assessedGaps]);

  if (!gaps || gaps.length === 0) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PauseCircle className="h-5 w-5" />
            Silence Patterns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-6 text-sm">
            No significant silences detected in this call.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <PauseCircle className="h-5 w-5" />
          Silence Patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Timeline bar */}
        <TooltipProvider delayDuration={150}>
          <div className="relative">
            {/* Time labels */}
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>0:00</span>
              <span>{formatTime(callDurationSeconds)}</span>
            </div>

            {/* The timeline track */}
            <div className="relative h-8 bg-muted/50 rounded-md border border-border overflow-hidden">
              {assessedGaps.map((gap, index) => {
                const leftPct = (gap.start_sec / callDurationSeconds) * 100;
                const widthPct = (gap.duration_sec / callDurationSeconds) * 100;
                // Ensure a minimum visible width
                const minWidthPct = 0.5;
                const displayWidth = Math.max(widthPct, minWidthPct);
                const assessment = gap.assessment;
                const colors = ASSESSMENT_COLORS[assessment];

                return (
                  <Tooltip key={index}>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          'absolute top-0 h-full transition-all duration-150 rounded-sm',
                          colors.bg,
                          onTimestampClick && 'cursor-pointer',
                          hoveredGapIndex === index && 'ring-2 ring-foreground/30 z-10',
                        )}
                        style={{
                          left: `${leftPct}%`,
                          width: `${displayWidth}%`,
                        }}
                        onClick={() => onTimestampClick?.(gap.start_sec)}
                        onMouseEnter={() => setHoveredGapIndex(index)}
                        onMouseLeave={() => setHoveredGapIndex(null)}
                        aria-label={`${colors.label} at ${formatTime(gap.start_sec)} — ${gap.duration_sec.toFixed(1)}s`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-foreground">
                            {formatTime(gap.start_sec)} - {formatTime(gap.end_sec)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {gap.duration_sec.toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-xs capitalize">
                          <span
                            className={cn(
                              'inline-block w-2 h-2 rounded-full mr-1.5',
                              assessment === 'productive' && 'bg-green-500',
                              assessment === 'neutral' && 'bg-amber-400',
                              assessment === 'awkward' && 'bg-red-500',
                            )}
                          />
                          {colors.label}
                        </p>
                        {gap.preceding_text && (
                          <p className="text-xs text-muted-foreground italic truncate">
                            Before: &ldquo;{gap.preceding_text}&rdquo;
                          </p>
                        )}
                        {gap.following_text && (
                          <p className="text-xs text-muted-foreground italic truncate">
                            After: &ldquo;{gap.following_text}&rdquo;
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        </TooltipProvider>

        {/* Summary stats */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
          {stats.productive > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>
                {stats.productive} productive{' '}
                {stats.productive === 1 ? 'pause' : 'pauses'}
              </span>
            </div>
          )}
          {stats.neutral > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>
                {stats.neutral} neutral{' '}
                {stats.neutral === 1 ? 'silence' : 'silences'}
              </span>
            </div>
          )}
          {stats.awkward > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>
                {stats.awkward} awkward{' '}
                {stats.awkward === 1 ? 'silence' : 'silences'}
              </span>
            </div>
          )}
          <span className="ml-auto">
            {assessedGaps.length} total &middot;{' '}
            {assessedGaps.reduce((sum, g) => sum + g.duration_sec, 0).toFixed(1)}s total silence
          </span>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-border text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-green-500/70" />
            <span>Productive (thinking time)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-400/70" />
            <span>Neutral</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-red-500/70" />
            <span>Awkward</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
