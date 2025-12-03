import { Flame, Target, TrendingUp, Ear, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FrameworkScoreCard } from './FrameworkScoreCard';
import type { CoachOutput } from '@/api/aiCallAnalysis/types';

interface CoachingHeroCardProps {
  coachOutput: CoachOutput;
}

export function CoachingHeroCard({ coachOutput }: CoachingHeroCardProps) {
  const heatScore = coachOutput.heat_signature?.score ?? null;
  const heatExplanation = coachOutput.heat_signature?.explanation ?? '';
  
  const meddpicc = coachOutput.framework_scores?.meddpicc;
  const bant = coachOutput.framework_scores?.bant;
  const hasMeddpicc = meddpicc && typeof meddpicc === 'object';
  const overallScore = hasMeddpicc ? meddpicc.overall_score : bant?.score;
  const frameworkSummary = hasMeddpicc ? meddpicc.summary : bant?.summary;
  
  const gapSellingScore = coachOutput.framework_scores?.gap_selling?.score ?? null;
  const gapSellingSummary = coachOutput.framework_scores?.gap_selling?.summary ?? '';
  
  const activeListeningScore = coachOutput.framework_scores?.active_listening?.score ?? null;
  const activeListeningSummary = coachOutput.framework_scores?.active_listening?.summary ?? '';

  // Find the top priority action
  const criticalMissing = coachOutput.critical_info_missing;
  const topPriority = criticalMissing?.[0];
  const topPriorityText = typeof topPriority === 'object' && topPriority !== null 
    ? topPriority.info 
    : topPriority;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
          {/* Heat Score */}
          <FrameworkScoreCard
            label="Heat Score"
            score={heatScore}
            maxScore={10}
            summary={heatExplanation}
            icon={Flame}
            colorScheme="heat"
          />

          {/* MEDDPICC/BANT Overall */}
          <FrameworkScoreCard
            label={hasMeddpicc ? 'MEDDPICC' : 'BANT'}
            score={overallScore ?? null}
            maxScore={100}
            summary={frameworkSummary}
            icon={Target}
            colorScheme="blue"
          />

          {/* Gap Selling */}
          <FrameworkScoreCard
            label="Gap Selling"
            score={gapSellingScore}
            maxScore={100}
            summary={gapSellingSummary}
            icon={TrendingUp}
            colorScheme="green"
          />

          {/* Active Listening */}
          <FrameworkScoreCard
            label="Listening"
            score={activeListeningScore}
            maxScore={100}
            summary={activeListeningSummary}
            icon={Ear}
            colorScheme="purple"
          />
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
