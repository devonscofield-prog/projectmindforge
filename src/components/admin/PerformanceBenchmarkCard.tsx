import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus, HelpCircle, Target, History, BarChart3 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { BenchmarkComparison } from '@/api/performanceBenchmarks';
import { INDUSTRY_BENCHMARKS } from '@/api/performanceBenchmarks';

interface PerformanceBenchmarkCardProps {
  comparisons: BenchmarkComparison[];
  isLoading?: boolean;
}

const ratingColors = {
  excellent: 'bg-emerald-500',
  good: 'bg-green-500',
  acceptable: 'bg-yellow-500',
  warning: 'bg-orange-500',
  critical: 'bg-destructive',
} as const;

const ratingBadgeVariants = {
  excellent: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  good: 'bg-green-500/10 text-green-500 border-green-500/20',
  acceptable: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  warning: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  critical: 'bg-destructive/10 text-destructive border-destructive/20',
} as const;

const trendIcons = {
  improving: TrendingDown,
  stable: Minus,
  degrading: TrendingUp,
  unknown: HelpCircle,
} as const;

const trendColors = {
  improving: 'text-emerald-500',
  stable: 'text-muted-foreground',
  degrading: 'text-destructive',
  unknown: 'text-muted-foreground',
} as const;

function getProgressValue(current: number, benchmark: number): number {
  // Scale where benchmark is 100%, and we show relative performance
  // If current < benchmark, progress > 100 (better than benchmark)
  // If current > benchmark, progress < 100 (worse than benchmark)
  const ratio = benchmark / current;
  return Math.min(Math.max(ratio * 50, 0), 100); // Scale to 0-100 range
}

function getMetricUnit(metric: string): string {
  if (metric.includes('Rate')) return '%';
  return 'ms';
}

export function PerformanceBenchmarkCard({ comparisons, isLoading }: PerformanceBenchmarkCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Performance Benchmarks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (comparisons.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4" />
            Performance Benchmarks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">
            No benchmark data available. Metrics will appear as the system is used.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="h-4 w-4" />
          Performance Benchmarks
        </CardTitle>
        <CardDescription>
          Compare current metrics against historical baselines and industry standards
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {comparisons.map((comparison) => {
          const TrendIcon = trendIcons[comparison.trend];
          const unit = getMetricUnit(comparison.metric);
          const progressValue = getProgressValue(comparison.current, comparison.industryBenchmark);

          return (
            <div key={comparison.metric} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{comparison.metric}</span>
                  <Badge variant="outline" className={ratingBadgeVariants[comparison.vsIndustry]}>
                    {comparison.vsIndustry}
                  </Badge>
                </div>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className={`flex items-center gap-1 ${trendColors[comparison.trend]}`}>
                        <TrendIcon className="h-4 w-4" />
                        <span className="text-xs capitalize">{comparison.trend}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Trend compared to 7-day baseline</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="relative">
                <Progress
                  value={progressValue}
                  className="h-2"
                />
                <div
                  className="absolute top-0 h-2 w-0.5 bg-primary"
                  style={{ left: '50%' }}
                  title="Industry benchmark"
                />
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Current</div>
                    <div className="font-semibold">
                      {comparison.current}
                      {unit}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Historical</div>
                    <div className="font-semibold">
                      {comparison.historical !== null ? (
                        <>
                          {Math.round(comparison.historical)}
                          {unit}
                          {comparison.vsHistorical !== null && (
                            <span
                              className={`text-xs ml-1 ${
                                comparison.vsHistorical < 0
                                  ? 'text-emerald-500'
                                  : comparison.vsHistorical > 0
                                  ? 'text-destructive'
                                  : 'text-muted-foreground'
                              }`}
                            >
                              ({comparison.vsHistorical > 0 ? '+' : ''}
                              {comparison.vsHistorical}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="text-muted-foreground text-xs">Industry</div>
                    <div className="font-semibold">
                      {comparison.industryBenchmark}
                      {unit}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">Industry Standards Reference</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {Object.entries(INDUSTRY_BENCHMARKS).map(([key, benchmark]) => (
              <div key={key} className="flex justify-between items-center p-2 rounded bg-muted/50">
                <span className="text-muted-foreground">{benchmark.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-500">≤{benchmark.excellent}</span>
                  <span className="text-yellow-500">≤{benchmark.acceptable}</span>
                  <span className="text-destructive">&gt;{benchmark.critical}</span>
                  <span className="text-muted-foreground">{benchmark.unit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
