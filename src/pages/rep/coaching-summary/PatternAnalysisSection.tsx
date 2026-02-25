import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquareQuote, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { CriticalInfoTrends } from '@/components/coaching/CriticalInfoTrends';
import { CoachingTrendAnalysis } from '@/api/aiCallAnalysis';

interface PatternAnalysisSectionProps {
  analysis: CoachingTrendAnalysis;
}

function getTrendBadge(trend: 'improving' | 'declining' | 'stable') {
  switch (trend) {
    case 'improving':
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Improving</Badge>;
    case 'declining':
      return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Declining</Badge>;
    default:
      return <Badge variant="secondary">Stable</Badge>;
  }
}

export function PatternAnalysisSection({ analysis }: PatternAnalysisSectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Critical Info Trends */}
      <CriticalInfoTrends
        persistentGaps={analysis.patternAnalysis.criticalInfoMissing.persistentGaps}
        newIssues={analysis.patternAnalysis.criticalInfoMissing.newIssues}
        resolvedIssues={analysis.patternAnalysis.criticalInfoMissing.resolvedIssues}
        recommendation={analysis.patternAnalysis.criticalInfoMissing.recommendation}
      />

      {/* Follow-up Questions Analysis */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-blue-500" />
            Follow-up Question Patterns
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Quality Trend</span>
            {getTrendBadge(analysis.patternAnalysis.followUpQuestions.qualityTrend)}
          </div>

          {analysis.patternAnalysis.followUpQuestions.recurringThemes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Recurring Themes
              </p>
              <div className="flex flex-wrap gap-2">
                {analysis.patternAnalysis.followUpQuestions.recurringThemes.map((theme, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {theme}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {analysis.patternAnalysis.followUpQuestions.recommendation && (
            <div className="p-3 rounded-lg bg-muted/50 border text-sm">
              <p className="font-medium mb-1">Recommendation</p>
              <p className="text-muted-foreground">
                {analysis.patternAnalysis.followUpQuestions.recommendation}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
