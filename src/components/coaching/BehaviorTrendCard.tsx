import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PatienceTrend, StrategicThreadingTrend, MonologueTrend } from '@/api/aiCallAnalysis';

interface BehaviorTrendCardProps {
  title: string;
  icon: React.ReactNode;
  trend: 'improving' | 'stable' | 'declining';
  startingAvg: number;
  endingAvg: number;
  keyInsight: string;
  evidence: string[];
  recommendation: string;
  // Additional Analysis 2.0 metrics
  extraMetrics?: {
    label: string;
    value: string | number;
  }[];
  maxScore?: number; // For proper progress bar scaling
}

export function BehaviorTrendCard({
  title,
  icon,
  trend,
  startingAvg,
  endingAvg,
  keyInsight,
  evidence,
  recommendation,
  extraMetrics,
  maxScore = 100,
}: BehaviorTrendCardProps) {
  const change = endingAvg - startingAvg;

  const getTrendIcon = () => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-5 w-5 text-destructive" />;
      default:
        return <Minus className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getTrendBadge = () => {
    switch (trend) {
      case 'improving':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Improving</Badge>;
      case 'declining':
        return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">Declining</Badge>;
      default:
        return <Badge variant="secondary">Stable</Badge>;
    }
  };

  const getRecommendationStyle = () => {
    switch (trend) {
      case 'improving':
        return 'bg-green-500/5 border-green-500/20 text-green-700 dark:text-green-400';
      case 'declining':
        return 'bg-destructive/5 border-destructive/20 text-destructive';
      default:
        return 'bg-muted/50 border-border text-muted-foreground';
    }
  };

  // Calculate progress percentage based on maxScore
  const progressValue = (endingAvg / maxScore) * 100;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          {getTrendBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Change */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold">{Math.round(endingAvg)}</span>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon()}
              <span className={cn(
                'font-medium',
                trend === 'improving' && 'text-green-600',
                trend === 'declining' && 'text-destructive',
                trend === 'stable' && 'text-muted-foreground'
              )}>
                {change >= 0 ? '+' : ''}{Math.round(change)} pts
              </span>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <span>{Math.round(startingAvg)}</span>
            <span className="mx-1">→</span>
            <span className="font-medium text-foreground">{Math.round(endingAvg)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <Progress value={progressValue} className="h-2" />

        {/* Extra Metrics (Analysis 2.0 specific) */}
        {extraMetrics && extraMetrics.length > 0 && (
          <div className="flex flex-wrap gap-3 text-sm">
            {extraMetrics.map((metric, idx) => (
              <div key={idx} className="flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded">
                <span className="text-muted-foreground">{metric.label}:</span>
                <span className="font-medium">{metric.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Key Insight */}
        <p className="text-sm text-muted-foreground italic">"{keyInsight}"</p>

        {/* Evidence */}
        {evidence.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Evidence</p>
            <ul className="text-sm space-y-1">
              {evidence.slice(0, 2).map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-muted-foreground mt-1">•</span>
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommendation */}
        <div className={cn('p-3 rounded-lg border text-sm', getRecommendationStyle())}>
          <div className="flex items-start gap-2">
            {trend === 'improving' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{recommendation}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Helper to create props from PatienceTrend
export function createPatienceProps(trend: PatienceTrend) {
  return {
    trend: trend.trend,
    startingAvg: trend.startingAvg,
    endingAvg: trend.endingAvg,
    keyInsight: trend.keyInsight,
    evidence: trend.evidence,
    recommendation: trend.recommendation,
    maxScore: 30, // Patience score is 0-30
    extraMetrics: [
      { label: 'Avg Interruptions', value: trend.avgInterruptions?.toFixed(1) ?? 'N/A' },
    ],
  };
}

// Helper to create props from StrategicThreadingTrend
export function createStrategicThreadingProps(trend: StrategicThreadingTrend) {
  return {
    trend: trend.trend,
    startingAvg: trend.startingAvg,
    endingAvg: trend.endingAvg,
    keyInsight: trend.keyInsight,
    evidence: trend.evidence,
    recommendation: trend.recommendation,
    maxScore: 100, // Strategic threading is 0-100
    extraMetrics: [
      { label: 'Relevance Ratio', value: `${(trend.avgRelevanceRatio * 100)?.toFixed(0) ?? 0}%` },
      { label: 'Missed Opps', value: trend.avgMissedOpportunities?.toFixed(1) ?? 'N/A' },
    ],
  };
}

// Helper to create props from MonologueTrend
export function createMonologueProps(trend: MonologueTrend) {
  return {
    trend: trend.trend,
    startingAvg: trend.avgPerCall,
    endingAvg: trend.avgPerCall,
    keyInsight: trend.keyInsight,
    evidence: trend.evidence,
    recommendation: trend.recommendation,
    maxScore: 5, // Lower is better, cap at 5 for display
    extraMetrics: [
      { label: 'Total Violations', value: trend.totalViolations ?? 0 },
      { label: 'Avg Longest Turn', value: `${trend.avgLongestTurn ?? 0} words` },
    ],
  };
}
