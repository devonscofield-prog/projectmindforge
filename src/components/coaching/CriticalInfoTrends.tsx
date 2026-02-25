import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
// cn import removed - unused

interface PersistentGap {
  gap: string;
  frequency: string;
  trend: 'improving' | 'stable' | 'worse';
}

interface CriticalInfoTrendsProps {
  persistentGaps: PersistentGap[];
  newIssues: string[];
  resolvedIssues: string[];
  recommendation: string;
}

export function CriticalInfoTrends({
  persistentGaps,
  newIssues,
  resolvedIssues,
  recommendation,
}: CriticalInfoTrendsProps) {
  const getTrendIcon = (trend: 'improving' | 'stable' | 'worse') => { void getTrendIcon;
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-3.5 w-3.5 text-green-500" />;
      case 'worse':
        return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
      default:
        return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getTrendBadge = (trend: 'improving' | 'stable' | 'worse') => {
    switch (trend) {
      case 'improving':
        return <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">↑ Improving</Badge>;
      case 'worse':
        return <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">↓ Getting Worse</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">Stable</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Critical Info Patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Persistent Gaps */}
        {persistentGaps.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h4 className="text-sm font-medium">Persistent Gaps</h4>
              <span className="text-xs text-muted-foreground">(still occurring)</span>
            </div>
            <div className="space-y-2">
              {persistentGaps.map((gap, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{gap.gap}</span>
                    <span className="text-xs text-muted-foreground">({gap.frequency})</span>
                  </div>
                  {getTrendBadge(gap.trend)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New Issues */}
        {newIssues.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h4 className="text-sm font-medium">Newly Emerging</h4>
              <span className="text-xs text-muted-foreground">(appeared recently)</span>
            </div>
            <div className="space-y-2">
              {newIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <span className="text-sm text-destructive">{issue}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved Issues */}
        {resolvedIssues.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <h4 className="text-sm font-medium">Resolved</h4>
              <span className="text-xs text-muted-foreground">(no longer appearing)</span>
            </div>
            <div className="space-y-2">
              {resolvedIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20"
                >
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm text-green-700 dark:text-green-400 line-through opacity-70">{issue}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {persistentGaps.length === 0 && newIssues.length === 0 && resolvedIssues.length === 0 && (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">No critical information gaps detected!</p>
          </div>
        )}

        {/* Recommendation */}
        {recommendation && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm">
            <p className="font-medium mb-1">Recommendation</p>
            <p className="text-muted-foreground">{recommendation}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
