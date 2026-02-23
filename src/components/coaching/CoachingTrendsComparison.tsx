import { 
  CoachingTrendAnalysis, 
  FrameworkTrend, 
  PersistentGap,
  getPrimaryFrameworkTrend,
  getPrimaryFrameworkLabel,
} from '@/api/aiCallAnalysis';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  MessageSquareQuote,
  Ear,
  Flame,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CoachingTrendsComparisonProps {
  periodA: {
    label: string;
    dateRange: { from: Date; to: Date };
    analysis: CoachingTrendAnalysis;
  };
  periodB: {
    label: string;
    dateRange: { from: Date; to: Date };
    analysis: CoachingTrendAnalysis;
  };
}

type TrendDirection = 'improving' | 'stable' | 'declining';
type ChangeType = 'improved' | 'maintained' | 'declined';

interface FrameworkChange {
  label: string;
  type: ChangeType;
}

function getTrendIcon(trend: TrendDirection, className?: string) {
  switch (trend) {
    case 'improving':
      return <TrendingUp className={cn("h-4 w-4 text-green-500", className)} />;
    case 'declining':
      return <TrendingDown className={cn("h-4 w-4 text-destructive", className)} />;
    default:
      return <Minus className={cn("h-4 w-4 text-muted-foreground", className)} />;
  }
}

function getTrendBadge(trend: TrendDirection) {
  switch (trend) {
    case 'improving':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">↑ Improving</Badge>;
    case 'declining':
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">↓ Declining</Badge>;
    default:
      return <Badge variant="secondary">→ Stable</Badge>;
  }
}

function calculateFrameworkChange(periodA: FrameworkTrend, periodB: FrameworkTrend): FrameworkChange {
  // Check if there was a recovery (declining -> improving)
  if (periodA.trend === 'declining' && periodB.trend === 'improving') {
    return { label: 'Recovered', type: 'improved' };
  }
  // Check if there was acceleration (improving -> improving with higher gain)
  if (periodA.trend === 'improving' && periodB.trend === 'improving') {
    const gainA = periodA.endingAvg - periodA.startingAvg;
    const gainB = periodB.endingAvg - periodB.startingAvg;
    if (gainB > gainA) return { label: 'Accelerated', type: 'improved' };
    return { label: 'Continued', type: 'maintained' };
  }
  // Check if there was regression (improving -> declining)
  if (periodA.trend === 'improving' && periodB.trend === 'declining') {
    return { label: 'Regressed', type: 'declined' };
  }
  // Check if stable declined
  if (periodA.trend === 'stable' && periodB.trend === 'declining') {
    return { label: 'Declined', type: 'declined' };
  }
  // Check if stable improved
  if (periodA.trend === 'stable' && periodB.trend === 'improving') {
    return { label: 'Started Improving', type: 'improved' };
  }
  // Check if declining got worse or stabilized
  if (periodA.trend === 'declining' && periodB.trend === 'declining') {
    return { label: 'Still Declining', type: 'declined' };
  }
  if (periodA.trend === 'declining' && periodB.trend === 'stable') {
    return { label: 'Stabilized', type: 'improved' };
  }
  return { label: 'Maintained', type: 'maintained' };
}

function findGapChanges(periodA: PersistentGap[], periodB: PersistentGap[]): {
  stillMissing: string[];
  resolved: string[];
  newGaps: string[];
} {
  const gapsA = new Set(periodA.map(g => g.gap.toLowerCase()));
  const gapsB = new Set(periodB.map(g => g.gap.toLowerCase()));
  
  const stillMissing: string[] = [];
  const resolved: string[] = [];
  const newGaps: string[] = [];
  
  // Find gaps that exist in both periods
  periodA.forEach(gap => {
    if (gapsB.has(gap.gap.toLowerCase())) {
      stillMissing.push(gap.gap);
    } else {
      resolved.push(gap.gap);
    }
  });
  
  // Find new gaps in period B
  periodB.forEach(gap => {
    if (!gapsA.has(gap.gap.toLowerCase())) {
      newGaps.push(gap.gap);
    }
  });
  
  return { stillMissing, resolved, newGaps };
}

function getChangeTypeBadge(type: ChangeType) {
  switch (type) {
    case 'improved':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">✓ Improved</Badge>;
    case 'declined':
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">⚠ Declined</Badge>;
    default:
      return <Badge variant="secondary">→ Maintained</Badge>;
  }
}

export function CoachingTrendsComparison({ periodA, periodB }: CoachingTrendsComparisonProps) {
  // Use helper functions for backward compatibility with BANT/MEDDPICC
  const primaryFrameworkA = getPrimaryFrameworkTrend(periodA.analysis.trendAnalysis);
  const primaryFrameworkB = getPrimaryFrameworkTrend(periodB.analysis.trendAnalysis);
  const primaryLabel = getPrimaryFrameworkLabel(periodB.analysis.trendAnalysis); // Use latest period's label
  
  const primaryChange = calculateFrameworkChange(primaryFrameworkA, primaryFrameworkB);
  const gapSellingChange = calculateFrameworkChange(periodA.analysis.trendAnalysis.gapSelling, periodB.analysis.trendAnalysis.gapSelling);
  const activeListeningChange = calculateFrameworkChange(periodA.analysis.trendAnalysis.activeListening, periodB.analysis.trendAnalysis.activeListening);
  
  const gapChanges = findGapChanges(
    periodA.analysis.patternAnalysis.criticalInfoMissing.persistentGaps,
    periodB.analysis.patternAnalysis.criticalInfoMissing.persistentGaps
  );

  const heatScoreChangeValue = (periodB.analysis.periodAnalysis.averageHeatScore || 0) - (periodA.analysis.periodAnalysis.averageHeatScore || 0);
  const heatScoreChange = heatScoreChangeValue > 0.3 ? 'improved' : heatScoreChangeValue < -0.3 ? 'declined' : 'maintained';

  return (
    <div className="space-y-6">
      {/* Period Headers */}
      <div className="flex items-center justify-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="text-center">
          <Badge variant="outline" className="mb-1">{periodA.label}</Badge>
          <p className="text-sm text-muted-foreground">
            {format(periodA.dateRange.from, 'MMM d')} - {format(periodA.dateRange.to, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {periodA.analysis.periodAnalysis.totalCalls} calls
          </p>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
        <div className="text-center">
          <Badge variant="outline" className="mb-1">{periodB.label}</Badge>
          <p className="text-sm text-muted-foreground">
            {format(periodB.dateRange.from, 'MMM d')} - {format(periodB.dateRange.to, 'MMM d, yyyy')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {periodB.analysis.periodAnalysis.totalCalls} calls
          </p>
        </div>
      </div>

      {/* Executive Summary Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Executive Summary Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border">
              <Badge variant="secondary" className="mb-2">{periodA.label}</Badge>
              <p className="text-sm">{periodA.analysis.summary}</p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Avg Heat: <strong>{periodA.analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}</strong></span>
                {getTrendIcon(periodA.analysis.periodAnalysis.heatScoreTrend)}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border">
              <Badge variant="secondary" className="mb-2">{periodB.label}</Badge>
              <p className="text-sm">{periodB.analysis.summary}</p>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Flame className="h-4 w-4 text-orange-500" />
                <span className="text-sm">Avg Heat: <strong>{periodB.analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}</strong></span>
                {getTrendIcon(periodB.analysis.periodAnalysis.heatScoreTrend)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Framework Trends Comparison Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Framework Trends Comparison
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Framework</th>
                  <th className="text-center py-2 font-medium">{periodA.label}</th>
                  <th className="text-center py-2 font-medium">{periodB.label}</th>
                  <th className="text-center py-2 font-medium">Change</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{primaryLabel}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{primaryFrameworkA.startingAvg} → {primaryFrameworkA.endingAvg}</span>
                      {getTrendBadge(primaryFrameworkA.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{primaryFrameworkB.startingAvg} → {primaryFrameworkB.endingAvg}</span>
                      {getTrendBadge(primaryFrameworkB.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {getChangeTypeBadge(primaryChange.type)}
                    <p className="text-xs text-muted-foreground mt-1">{primaryChange.label}</p>
                  </td>
                </tr>
                <tr className="border-b">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <MessageSquareQuote className="h-4 w-4 text-purple-500" />
                      <span className="font-medium">Gap Selling</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{periodA.analysis.trendAnalysis.gapSelling.startingAvg} → {periodA.analysis.trendAnalysis.gapSelling.endingAvg}</span>
                      {getTrendBadge(periodA.analysis.trendAnalysis.gapSelling.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{periodB.analysis.trendAnalysis.gapSelling.startingAvg} → {periodB.analysis.trendAnalysis.gapSelling.endingAvg}</span>
                      {getTrendBadge(periodB.analysis.trendAnalysis.gapSelling.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {getChangeTypeBadge(gapSellingChange.type)}
                    <p className="text-xs text-muted-foreground mt-1">{gapSellingChange.label}</p>
                  </td>
                </tr>
                <tr>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Ear className="h-4 w-4 text-teal-500" />
                      <span className="font-medium">Active Listening</span>
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{periodA.analysis.trendAnalysis.activeListening.startingAvg} → {periodA.analysis.trendAnalysis.activeListening.endingAvg}</span>
                      {getTrendBadge(periodA.analysis.trendAnalysis.activeListening.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    <div className="flex flex-col items-center">
                      <span>{periodB.analysis.trendAnalysis.activeListening.startingAvg} → {periodB.analysis.trendAnalysis.activeListening.endingAvg}</span>
                      {getTrendBadge(periodB.analysis.trendAnalysis.activeListening.trend)}
                    </div>
                  </td>
                  <td className="py-3 text-center">
                    {getChangeTypeBadge(activeListeningChange.type)}
                    <p className="text-xs text-muted-foreground mt-1">{activeListeningChange.label}</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Critical Info Gaps: What Changed? */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Critical Info Gaps: What Changed?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {gapChanges.stillMissing.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <Circle className="h-3 w-3 fill-red-500 text-red-500" />
                Still Missing (both periods)
              </p>
              <div className="flex flex-wrap gap-2">
                {gapChanges.stillMissing.map((gap, idx) => (
                  <Badge key={idx} variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {gapChanges.resolved.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                Resolved in {periodB.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {gapChanges.resolved.map((gap, idx) => (
                  <Badge key={idx} variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          
          {gapChanges.newGaps.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-amber-500" />
                New in {periodB.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {gapChanges.newGaps.map((gap, idx) => (
                  <Badge key={idx} variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                    {gap}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {gapChanges.stillMissing.length === 0 && gapChanges.resolved.length === 0 && gapChanges.newGaps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No significant gap changes detected between periods.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Priority Shifts */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Priority Shifts
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {periodA.label} Top Priority
              </p>
              {periodA.analysis.topPriorities[0] && (
                <div>
                  <p className="font-medium">{periodA.analysis.topPriorities[0].area}</p>
                  <p className="text-sm text-muted-foreground mt-1">{periodA.analysis.topPriorities[0].reason}</p>
                </div>
              )}
            </div>
            <div className="p-4 rounded-lg bg-muted/30 border">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {periodB.label} Top Priority
              </p>
              {periodB.analysis.topPriorities[0] && (
                <div>
                  <p className="font-medium">{periodB.analysis.topPriorities[0].area}</p>
                  <p className="text-sm text-muted-foreground mt-1">{periodB.analysis.topPriorities[0].reason}</p>
                </div>
              )}
            </div>
          </div>

          {/* Summary of Changes */}
          <div className="p-4 rounded-lg bg-gradient-to-br from-primary/5 to-background border">
            <p className="font-medium mb-2">Period-over-Period Summary</p>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <span>Heat Score:</span>
                <span className={cn(
                  "font-semibold",
                  heatScoreChange === 'improved' ? 'text-green-600' : 
                  heatScoreChange === 'declined' ? 'text-destructive' : 'text-muted-foreground'
                )}>
                  {periodA.analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'} → {periodB.analysis.periodAnalysis.averageHeatScore?.toFixed(1) || 'N/A'}
                  {heatScoreChange === 'improved' && ' ↑'}
                  {heatScoreChange === 'declined' && ' ↓'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-500" />
                <span>Calls Analyzed:</span>
                <span className="font-semibold">
                  {periodA.analysis.periodAnalysis.totalCalls} → {periodB.analysis.periodAnalysis.totalCalls}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
