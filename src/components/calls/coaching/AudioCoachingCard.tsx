import { useState, useMemo, memo } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Mic,
  MessageSquare,
  Zap,
  PauseCircle,
  Volume2,
  Users,
  Headphones,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { AudioCoachingData, TimestampedCoachingTip } from '@/types/audioAnalysis';

interface AudioCoachingCardProps {
  data: AudioCoachingData | null;
  className?: string;
  isLoading?: boolean;
  defaultOpen?: boolean;
  onSeekTo?: (seconds: number) => void;
}

// ---------------------------------------------------------------------------
// Grade styling — matches CoachingCard.tsx exactly
// ---------------------------------------------------------------------------

const getGradeStyles = (grade: string) => {
  const normalized = grade.replace(/[^A-F+]/gi, '').toUpperCase();
  switch (normalized) {
    case 'A+':
    case 'A':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-400',
        border: 'border-green-200 dark:border-green-800',
      };
    case 'B':
      return {
        bg: 'bg-lime-100 dark:bg-lime-900/30',
        text: 'text-lime-700 dark:text-lime-400',
        border: 'border-lime-200 dark:border-lime-800',
      };
    case 'C':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-400',
        border: 'border-amber-200 dark:border-amber-800',
      };
    case 'D':
    case 'F':
    default:
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-400',
        border: 'border-red-200 dark:border-red-800',
      };
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format seconds into M:SS */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Get a category icon component */
function CategoryIcon({ category, className }: { category: TimestampedCoachingTip['category']; className?: string }) {
  const iconClass = cn('h-4 w-4', className);
  switch (category) {
    case 'pace':
      return <Mic className={iconClass} />;
    case 'filler':
      return <MessageSquare className={iconClass} />;
    case 'energy':
      return <Zap className={iconClass} />;
    case 'silence':
      return <PauseCircle className={iconClass} />;
    case 'talk_ratio':
      return <Users className={iconClass} />;
    case 'general':
    default:
      return <Volume2 className={iconClass} />;
  }
}

/** Map category to a readable label */
function categoryLabel(category: TimestampedCoachingTip['category']): string {
  switch (category) {
    case 'pace':
      return 'Pace';
    case 'filler':
      return 'Filler Words';
    case 'energy':
      return 'Energy';
    case 'silence':
      return 'Silence';
    case 'talk_ratio':
      return 'Talk Ratio';
    case 'general':
    default:
      return 'General';
  }
}

/** Severity color for left border */
function severityBorderColor(severity: TimestampedCoachingTip['severity']): string {
  switch (severity) {
    case 'info':
      return 'border-l-green-500 dark:border-l-green-400';
    case 'suggestion':
      return 'border-l-amber-500 dark:border-l-amber-400';
    case 'warning':
      return 'border-l-red-500 dark:border-l-red-400';
    default:
      return 'border-l-muted-foreground';
  }
}

/** Derive call segment label from timestamp position */
function getSegmentLabel(timestampSec: number, totalDuration: number): string {
  if (totalDuration <= 0) return 'Call';
  const pct = timestampSec / totalDuration;
  if (pct <= 0.15) return 'Opener';
  if (pct <= 0.4) return 'Discovery';
  if (pct <= 0.7) return 'Key Moment';
  if (pct <= 0.85) return 'Wrap-Up';
  return 'Close';
}

// ---------------------------------------------------------------------------
// Tip item
// ---------------------------------------------------------------------------

function TipItem({
  tip,
  totalDuration,
  onSeekTo,
}: {
  tip: TimestampedCoachingTip;
  totalDuration: number;
  onSeekTo?: (seconds: number) => void;
}) {
  const segment = getSegmentLabel(tip.timestamp_sec, totalDuration);

  return (
    <div
      className={cn(
        'flex gap-3 rounded-md border border-border bg-muted/30 p-3 border-l-4',
        severityBorderColor(tip.severity),
      )}
    >
      {/* Timestamp badge */}
      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
        <Badge
          variant="outline"
          className={cn(
            'text-xs font-mono tabular-nums px-2 py-0.5',
            onSeekTo && 'cursor-pointer hover:bg-primary/10 hover:border-primary/40 transition-colors',
          )}
          onClick={() => onSeekTo?.(tip.timestamp_sec)}
        >
          {formatTimestamp(tip.timestamp_sec)}
        </Badge>
        <CategoryIcon category={tip.category} className="text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="text-sm font-medium text-foreground">
            {categoryLabel(tip.category)}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {segment}
          </Badge>
          {tip.speaker && (
            <span className="text-[10px] text-muted-foreground">{tip.speaker}</span>
          )}
        </div>
        <p className="text-sm text-foreground/80 leading-relaxed">{tip.tip}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped tips by segment
// ---------------------------------------------------------------------------

interface GroupedTips {
  segment: string;
  tips: TimestampedCoachingTip[];
}

function groupTipsBySegment(tips: TimestampedCoachingTip[], totalDuration: number): GroupedTips[] {
  const grouped = new Map<string, TimestampedCoachingTip[]>();
  const order: string[] = [];

  for (const tip of tips) {
    const segment = getSegmentLabel(tip.timestamp_sec, totalDuration);
    if (!grouped.has(segment)) {
      grouped.set(segment, []);
      order.push(segment);
    }
    grouped.get(segment)!.push(tip);
  }

  return order.map((segment) => ({
    segment,
    tips: grouped.get(segment)!,
  }));
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const AudioCoachingCard = memo(function AudioCoachingCard({
  data,
  className,
  isLoading = false,
  defaultOpen = true,
  onSeekTo,
}: AudioCoachingCardProps) {
  const [isCardOpen, setIsCardOpen] = useState(defaultOpen);

  // Estimate a total duration from the max tip timestamp (fallback for grouping)
  const estimatedDuration = useMemo(() => {
    if (!data?.tips || data.tips.length === 0) return 300; // default 5 min
    return Math.max(...data.tips.map((t) => t.timestamp_sec)) * 1.1;
  }, [data?.tips]);

  const groupedTips = useMemo(() => {
    if (!data?.tips || data.tips.length === 0) return [];
    const sorted = [...data.tips].sort((a, b) => a.timestamp_sec - b.timestamp_sec);
    return groupTipsBySegment(sorted, estimatedDuration);
  }, [data?.tips, estimatedDuration]);

  const shouldGroup = (data?.tips?.length ?? 0) > 6;

  // ---- Loading skeleton ----
  if (isLoading) {
    return (
      <Card className={cn('overflow-hidden', className)}>
        <div className="flex items-center gap-6 p-6 border-b border-border bg-muted/30">
          <Skeleton className="w-20 h-20 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <Skeleton className="h-16 w-full rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
            <Skeleton className="h-20 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Empty state ----
  if (!data) {
    return (
      <Card className={cn('overflow-hidden border-dashed border-2 border-muted-foreground/25', className)}>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-muted/50 mb-3">
            <Headphones className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Voice coaching insights will appear when audio analysis completes
          </p>
        </CardContent>
      </Card>
    );
  }

  const gradeStyles = getGradeStyles(data.voice_grade);

  return (
    <Collapsible open={isCardOpen} onOpenChange={setIsCardOpen}>
      <Card className={cn('overflow-hidden', className)}>
        {/* Header — matches CoachingCard structure */}
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between gap-6 p-6 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-6">
              <div
                className={cn(
                  'flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-xl border-2 font-bold text-2xl md:text-3xl',
                  gradeStyles.bg,
                  gradeStyles.text,
                  gradeStyles.border,
                )}
              >
                {data.voice_grade}
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Headphones className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">Voice Coaching</span>
                </div>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  {data.tips.length} coaching {data.tips.length === 1 ? 'tip' : 'tips'}
                </Badge>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'h-5 w-5 text-muted-foreground transition-transform shrink-0',
                isCardOpen && 'rotate-180',
              )}
            />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="p-6 space-y-6">
            {/* Voice summary */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Voice Summary</h4>
              <p className="text-foreground leading-relaxed">{data.voice_summary}</p>
            </div>

            {/* Strengths & Improvements Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Strengths</h4>
                <ul className="space-y-2">
                  {data.voice_strengths.map((strength, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{strength}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Areas for Improvement</h4>
                <ul className="space-y-2">
                  {data.voice_improvements.map((improvement, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-foreground">{improvement}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Timestamped Coaching Tips */}
            {data.tips.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">
                  Timestamped Coaching Tips
                </h4>

                <div className="max-h-[480px] overflow-y-auto pr-1 space-y-3">
                  {shouldGroup ? (
                    // Grouped by segment
                    groupedTips.map((group) => (
                      <div key={group.segment}>
                        <div className="flex items-center gap-2 mb-2 mt-1">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            {group.segment}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                        <div className="space-y-2">
                          {group.tips.map((tip, idx) => (
                            <TipItem
                              key={`${group.segment}-${idx}`}
                              tip={tip}
                              totalDuration={estimatedDuration}
                              onSeekTo={onSeekTo}
                            />
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    // Flat list
                    data.tips
                      .slice()
                      .sort((a, b) => a.timestamp_sec - b.timestamp_sec)
                      .map((tip, idx) => (
                        <TipItem
                          key={idx}
                          tip={tip}
                          totalDuration={estimatedDuration}
                          onSeekTo={onSeekTo}
                        />
                      ))
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
});
