import { Flame, Target, TrendingUp, Ear, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CoachOutput } from '@/api/aiCallAnalysis/types';

interface CoachingHeroCardProps {
  coachOutput: CoachOutput;
}

export function CoachingHeroCard({ coachOutput }: CoachingHeroCardProps) {
  const heatScore = coachOutput.heat_signature?.score ?? null;
  const meddpicc = coachOutput.framework_scores?.meddpicc;
  const bant = coachOutput.framework_scores?.bant;
  const hasMeddpicc = meddpicc && typeof meddpicc === 'object';
  const overallScore = hasMeddpicc ? meddpicc.overall_score : bant?.score;
  
  const gapSellingScore = coachOutput.framework_scores?.gap_selling?.score ?? null;
  const activeListeningScore = coachOutput.framework_scores?.active_listening?.score ?? null;

  // Find the top priority action
  const criticalMissing = coachOutput.critical_info_missing;
  const topPriority = criticalMissing?.[0];
  const topPriorityText = typeof topPriority === 'object' && topPriority !== null 
    ? topPriority.info 
    : topPriority;

  // Score color helpers
  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getHeatColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground bg-muted';
    if (score >= 8) return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    if (score >= 6) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
    if (score >= 4) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
  };

  const getProgressColor = (score: number | null) => {
    if (score === null) return 'bg-muted';
    if (score >= 70) return 'bg-green-500';
    if (score >= 50) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
          {/* Heat Score - Featured */}
          <div className={cn('p-4 md:p-6 flex flex-col items-center justify-center gap-2', getHeatColor(heatScore))}>
            <Flame className="h-6 w-6 md:h-8 md:w-8 shrink-0" />
            <div className="text-center">
              <p className="text-xs md:text-sm font-medium opacity-80">Heat Score</p>
              <p className="text-2xl md:text-3xl font-bold">{heatScore ?? '-'}<span className="text-lg opacity-60">/10</span></p>
            </div>
          </div>

          {/* MEDDPICC Overall */}
          <div className="p-4 md:p-6 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <span className="text-xs md:text-sm font-medium text-muted-foreground">
                {hasMeddpicc ? 'MEDDPICC' : 'BANT'}
              </span>
            </div>
            <p className={cn('text-2xl md:text-3xl font-bold', getScoreColor(overallScore ?? null))}>
              {overallScore ?? '-'}
            </p>
            <div className="w-full max-w-[80px] h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full transition-all', getProgressColor(overallScore ?? null))}
                style={{ width: `${overallScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Gap Selling */}
          <div className="p-4 md:p-6 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-xs md:text-sm font-medium text-muted-foreground">Gap Selling</span>
            </div>
            <p className={cn('text-2xl md:text-3xl font-bold', getScoreColor(gapSellingScore))}>
              {gapSellingScore ?? '-'}
            </p>
            <div className="w-full max-w-[80px] h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full transition-all', getProgressColor(gapSellingScore))}
                style={{ width: `${gapSellingScore ?? 0}%` }}
              />
            </div>
          </div>

          {/* Active Listening */}
          <div className="p-4 md:p-6 flex flex-col items-center justify-center gap-2">
            <div className="flex items-center gap-2">
              <Ear className="h-5 w-5 text-purple-500" />
              <span className="text-xs md:text-sm font-medium text-muted-foreground">Listening</span>
            </div>
            <p className={cn('text-2xl md:text-3xl font-bold', getScoreColor(activeListeningScore))}>
              {activeListeningScore ?? '-'}
            </p>
            <div className="w-full max-w-[80px] h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn('h-full transition-all', getProgressColor(activeListeningScore))}
                style={{ width: `${activeListeningScore ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Top Priority Banner */}
        {topPriorityText && (
          <div className="px-4 py-3 bg-destructive/10 border-t border-destructive/20 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-destructive uppercase tracking-wide">Top Priority</p>
              <p className="text-sm text-foreground truncate">{topPriorityText}</p>
            </div>
            <Badge variant="destructive" className="shrink-0">Action Needed</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
