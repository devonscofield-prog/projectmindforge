import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronUp, 
  User, 
  Phone, 
  Flame, 
  TrendingUp, 
  TrendingDown,
  BarChart3,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RepContribution {
  repId: string;
  repName: string;
  teamName?: string;
  callCount: number;
  percentageOfTotal: number;
  averageHeatScore: number | null;
  frameworkScores: {
    bant: number | null;
    gapSelling: number | null;
    activeListening: number | null;
  };
}

interface RepContributionBreakdownProps {
  contributions: RepContribution[];
  totalCalls: number;
  scope: 'organization' | 'team';
}

export function RepContributionBreakdown({ 
  contributions, 
  totalCalls, 
  scope 
}: RepContributionBreakdownProps) {
  const [expanded, setExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'calls' | 'heat'>('calls');

  const sortedContributions = [...contributions].sort((a, b) => {
    if (sortBy === 'calls') {
      return b.callCount - a.callCount;
    }
    return (b.averageHeatScore ?? 0) - (a.averageHeatScore ?? 0);
  });

  const displayedContributions = expanded 
    ? sortedContributions 
    : sortedContributions.slice(0, 5);

  const topContributors = sortedContributions.slice(0, 3);
  const topCallsPercent = topContributors.reduce((sum, c) => sum + c.percentageOfTotal, 0);

  const getHeatColor = (score: number | null) => {
    if (score === null) return 'text-muted-foreground';
    if (score >= 7) return 'text-green-600 dark:text-green-400';
    if (score >= 4) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-muted';
    if (score >= 7) return 'bg-green-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5 text-primary" />
            Rep Contribution Breakdown
          </CardTitle>
          <Badge variant="outline">
            {contributions.length} rep{contributions.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold text-primary">{contributions.length}</p>
            <p className="text-xs text-muted-foreground">Total Reps</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{totalCalls}</p>
            <p className="text-xs text-muted-foreground">Total Calls</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">
              {(totalCalls / Math.max(contributions.length, 1)).toFixed(1)}
            </p>
            <p className="text-xs text-muted-foreground">Avg Calls/Rep</p>
          </div>
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <p className="text-2xl font-bold">{topCallsPercent.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Top 3 Contribution</p>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Sort by:</span>
          <Button
            variant={sortBy === 'calls' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('calls')}
            className="h-7 text-xs"
          >
            <Phone className="h-3 w-3 mr-1" />
            Call Count
          </Button>
          <Button
            variant={sortBy === 'heat' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('heat')}
            className="h-7 text-xs"
          >
            <Flame className="h-3 w-3 mr-1" />
            Heat Score
          </Button>
        </div>

        {/* Rep List */}
        <ScrollArea className={cn("pr-4", expanded && contributions.length > 5 ? "h-[400px]" : "")}>
          <div className="space-y-3">
            {displayedContributions.map((rep, index) => (
              <div 
                key={rep.repId}
                className={cn(
                  "p-3 rounded-lg border bg-card transition-colors",
                  index < 3 && sortBy === 'calls' && "border-primary/30 bg-primary/5"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium",
                      index === 0 && sortBy === 'calls' ? "bg-amber-500 text-white" :
                      index === 1 && sortBy === 'calls' ? "bg-slate-400 text-white" :
                      index === 2 && sortBy === 'calls' ? "bg-amber-700 text-white" :
                      "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{rep.repName}</p>
                      {rep.teamName && scope === 'organization' && (
                        <p className="text-xs text-muted-foreground truncate">{rep.teamName}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    {/* Call Count */}
                    <div className="text-right">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        <span className="font-semibold">{rep.callCount}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {rep.percentageOfTotal.toFixed(1)}%
                      </p>
                    </div>
                    {/* Heat Score */}
                    <div className="text-right min-w-[60px]">
                      <div className={cn("flex items-center gap-1 justify-end", getHeatColor(rep.averageHeatScore))}>
                        <Flame className="h-3 w-3" />
                        <span className="font-semibold">
                          {rep.averageHeatScore?.toFixed(1) ?? 'N/A'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">heat</p>
                    </div>
                  </div>
                </div>
                
                {/* Progress bar showing contribution */}
                <div className="mt-2">
                  <Progress 
                    value={rep.percentageOfTotal} 
                    className="h-1.5"
                  />
                </div>

                {/* Framework Scores - Collapsed Mini View */}
                {(rep.frameworkScores.bant !== null || 
                  rep.frameworkScores.gapSelling !== null || 
                  rep.frameworkScores.activeListening !== null) && (
                  <div className="flex items-center gap-3 mt-2 pt-2 border-t border-dashed">
                    <span className="text-xs text-muted-foreground">Framework Scores:</span>
                    {rep.frameworkScores.bant !== null && (
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", getScoreColor(rep.frameworkScores.bant))} />
                        <span className="text-xs">BANT: {rep.frameworkScores.bant.toFixed(1)}</span>
                      </div>
                    )}
                    {rep.frameworkScores.gapSelling !== null && (
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", getScoreColor(rep.frameworkScores.gapSelling))} />
                        <span className="text-xs">Gap: {rep.frameworkScores.gapSelling.toFixed(1)}</span>
                      </div>
                    )}
                    {rep.frameworkScores.activeListening !== null && (
                      <div className="flex items-center gap-1">
                        <div className={cn("w-2 h-2 rounded-full", getScoreColor(rep.frameworkScores.activeListening))} />
                        <span className="text-xs">Listen: {rep.frameworkScores.activeListening.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Show More/Less */}
        {contributions.length > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Show Less
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Show All {contributions.length} Reps
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
