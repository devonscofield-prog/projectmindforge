import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CoachingSummary } from '@/api/aiCallAnalysis';
import { cn } from '@/lib/utils';
import {
  BarChart3,
  Flame,
  Award,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowRight,
} from 'lucide-react';

interface CoachingSummaryComparisonProps {
  period1: CoachingSummary;
  period2: CoachingSummary;
  period1Label: string;
  period2Label: string;
}

function calculateChange(oldVal: number | null, newVal: number | null): {
  diff: number | null;
  percent: number | null;
  direction: 'up' | 'down' | 'same';
} {
  if (oldVal === null || newVal === null) {
    return { diff: null, percent: null, direction: 'same' };
  }
  const diff = newVal - oldVal;
  const percent = oldVal !== 0 ? (diff / oldVal) * 100 : (newVal !== 0 ? 100 : 0);
  const direction = diff > 0.1 ? 'up' : diff < -0.1 ? 'down' : 'same';
  return { diff, percent, direction };
}

function ChangeIndicator({ 
  change, 
  positiveIsGood = true,
  showPercent = true 
}: { 
  change: ReturnType<typeof calculateChange>; 
  positiveIsGood?: boolean;
  showPercent?: boolean;
}) {
  if (change.diff === null) return <span className="text-muted-foreground">-</span>;
  
  const isPositive = change.direction === 'up';
  const isGood = positiveIsGood ? isPositive : !isPositive;
  
  return (
    <span className={cn(
      "flex items-center gap-1 text-sm font-medium",
      change.direction === 'same' && "text-muted-foreground",
      change.direction !== 'same' && isGood && "text-green-600",
      change.direction !== 'same' && !isGood && "text-destructive"
    )}>
      {change.direction === 'up' && <TrendingUp className="h-3 w-3" />}
      {change.direction === 'down' && <TrendingDown className="h-3 w-3" />}
      {change.direction === 'same' && <Minus className="h-3 w-3" />}
      {showPercent && change.percent !== null && (
        <span>{change.percent > 0 ? '+' : ''}{change.percent.toFixed(1)}%</span>
      )}
      {!showPercent && change.diff !== null && (
        <span>{change.diff > 0 ? '+' : ''}{change.diff.toFixed(1)}</span>
      )}
    </span>
  );
}

function ComparisonMetricCard({
  title,
  icon: Icon,
  period1Value,
  period2Value,
  period1Label,
  period2Label,
  format = 'number',
  positiveIsGood = true,
}: {
  title: string;
  icon: React.ElementType;
  period1Value: number | null;
  period2Value: number | null;
  period1Label: string;
  period2Label: string;
  format?: 'number' | 'score' | 'percent';
  positiveIsGood?: boolean;
}) {
  const change = calculateChange(period1Value, period2Value);
  
  const formatValue = (val: number | null) => {
    if (val === null) return '-';
    if (format === 'score') return `${val.toFixed(1)}/10`;
    if (format === 'percent') return `${val.toFixed(0)}%`;
    return val.toString();
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1">{period1Label}</p>
            <p className="text-2xl font-bold">{formatValue(period1Value)}</p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
            <ChangeIndicator change={change} positiveIsGood={positiveIsGood} />
          </div>
          <div className="text-center flex-1">
            <p className="text-xs text-muted-foreground mb-1">{period2Label}</p>
            <p className="text-2xl font-bold">{formatValue(period2Value)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PatternComparison({
  title,
  period1Items,
  period2Items,
  period1Label,
  period2Label,
}: {
  title: string;
  period1Items: Array<{ item: string; count: number }>;
  period2Items: Array<{ item: string; count: number }>;
  period1Label: string;
  period2Label: string;
}) {
  // Get all unique items across both periods
  const allItems = new Set([
    ...period1Items.map(i => i.item),
    ...period2Items.map(i => i.item),
  ]);
  
  const combinedItems = Array.from(allItems).map(item => {
    const p1 = period1Items.find(i => i.item === item);
    const p2 = period2Items.find(i => i.item === item);
    const p1Count = p1?.count ?? 0;
    const p2Count = p2?.count ?? 0;
    return {
      item,
      period1Count: p1Count,
      period2Count: p2Count,
      change: p2Count - p1Count,
    };
  }).sort((a, b) => b.period2Count - a.period2Count).slice(0, 5);

  if (combinedItems.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr,60px,20px,60px] gap-2 text-xs text-muted-foreground border-b pb-2">
            <span>Pattern</span>
            <span className="text-center">{period1Label}</span>
            <span></span>
            <span className="text-center">{period2Label}</span>
          </div>
          {combinedItems.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr,60px,20px,60px] gap-2 items-center text-sm">
              <span className="capitalize truncate">{item.item}</span>
              <Badge variant="outline" className="justify-center">
                {item.period1Count}x
              </Badge>
              <span className={cn(
                "text-xs text-center font-medium",
                item.change > 0 && "text-destructive",
                item.change < 0 && "text-green-600",
                item.change === 0 && "text-muted-foreground"
              )}>
                {item.change > 0 ? `+${item.change}` : item.change}
              </span>
              <Badge variant="secondary" className="justify-center">
                {item.period2Count}x
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StrengthsComparison({
  title,
  period1Items,
  period2Items,
  period1Label,
  period2Label,
  variant = 'strength',
}: {
  title: string;
  period1Items: Array<{ area: string; count: number }>;
  period2Items: Array<{ area: string; count: number }>;
  period1Label: string;
  period2Label: string;
  variant?: 'strength' | 'opportunity';
}) {
  const allAreas = new Set([
    ...period1Items.map(i => i.area),
    ...period2Items.map(i => i.area),
  ]);
  
  const combinedItems = Array.from(allAreas).map(area => {
    const p1 = period1Items.find(i => i.area === area);
    const p2 = period2Items.find(i => i.area === area);
    const p1Count = p1?.count ?? 0;
    const p2Count = p2?.count ?? 0;
    return {
      area,
      period1Count: p1Count,
      period2Count: p2Count,
      change: p2Count - p1Count,
    };
  }).sort((a, b) => b.period2Count - a.period2Count).slice(0, 5);

  const isStrength = variant === 'strength';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {isStrength ? <Award className="h-4 w-4 text-green-500" /> : <Lightbulb className="h-4 w-4 text-yellow-500" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {combinedItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data available</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr,60px,20px,60px] gap-2 text-xs text-muted-foreground border-b pb-2">
              <span>Area</span>
              <span className="text-center">{period1Label}</span>
              <span></span>
              <span className="text-center">{period2Label}</span>
            </div>
            {combinedItems.map((item, i) => (
              <div key={i} className="grid grid-cols-[1fr,60px,20px,60px] gap-2 items-center text-sm">
                <span className="capitalize truncate">{item.area.replace(/_/g, ' ')}</span>
                <Badge variant="outline" className="justify-center">
                  {item.period1Count}x
                </Badge>
                <span className={cn(
                  "text-xs text-center font-medium",
                  isStrength && item.change > 0 && "text-green-600",
                  isStrength && item.change < 0 && "text-destructive",
                  !isStrength && item.change > 0 && "text-destructive",
                  !isStrength && item.change < 0 && "text-green-600",
                  item.change === 0 && "text-muted-foreground"
                )}>
                  {item.change > 0 ? `+${item.change}` : item.change}
                </span>
                <Badge variant="secondary" className="justify-center">
                  {item.period2Count}x
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CoachingSummaryComparison({
  period1,
  period2,
  period1Label,
  period2Label,
}: CoachingSummaryComparisonProps) {
  return (
    <div className="space-y-6">
      {/* Key Metrics Comparison */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ComparisonMetricCard
          title="Calls Analyzed"
          icon={BarChart3}
          period1Value={period1.totalCalls}
          period2Value={period2.totalCalls}
          period1Label={period1Label}
          period2Label={period2Label}
          positiveIsGood={true}
        />
        <ComparisonMetricCard
          title="Avg Heat Score"
          icon={Flame}
          period1Value={period1.heatScoreStats.average}
          period2Value={period2.heatScoreStats.average}
          period1Label={period1Label}
          period2Label={period2Label}
          format="score"
          positiveIsGood={true}
        />
        <ComparisonMetricCard
          title="Critical Gaps"
          icon={TrendingDown}
          period1Value={period1.recurringPatterns.criticalInfoMissing.reduce((s, i) => s + i.count, 0)}
          period2Value={period2.recurringPatterns.criticalInfoMissing.reduce((s, i) => s + i.count, 0)}
          period1Label={period1Label}
          period2Label={period2Label}
          positiveIsGood={false}
        />
        <ComparisonMetricCard
          title="Strengths Identified"
          icon={Award}
          period1Value={period1.strengthsAndOpportunities.topStrengths.reduce((s, i) => s + i.count, 0)}
          period2Value={period2.strengthsAndOpportunities.topStrengths.reduce((s, i) => s + i.count, 0)}
          period1Label={period1Label}
          period2Label={period2Label}
          positiveIsGood={true}
        />
      </div>

      {/* Pattern Comparisons */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Pattern Changes</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <PatternComparison
            title="Critical Info Missing"
            period1Items={period1.recurringPatterns.criticalInfoMissing}
            period2Items={period2.recurringPatterns.criticalInfoMissing}
            period1Label={period1Label}
            period2Label={period2Label}
          />
          <PatternComparison
            title="BANT Improvements"
            period1Items={period1.recurringPatterns.bantImprovements}
            period2Items={period2.recurringPatterns.bantImprovements}
            period1Label={period1Label}
            period2Label={period2Label}
          />
          <PatternComparison
            title="Gap Selling Improvements"
            period1Items={period1.recurringPatterns.gapSellingImprovements}
            period2Items={period2.recurringPatterns.gapSellingImprovements}
            period1Label={period1Label}
            period2Label={period2Label}
          />
        </div>
      </div>

      {/* Strengths & Opportunities Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Strengths & Opportunities</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <StrengthsComparison
            title="Top Strengths"
            period1Items={period1.strengthsAndOpportunities.topStrengths}
            period2Items={period2.strengthsAndOpportunities.topStrengths}
            period1Label={period1Label}
            period2Label={period2Label}
            variant="strength"
          />
          <StrengthsComparison
            title="Growth Opportunities"
            period1Items={period1.strengthsAndOpportunities.topOpportunities}
            period2Items={period2.strengthsAndOpportunities.topOpportunities}
            period1Label={period1Label}
            period2Label={period2Label}
            variant="opportunity"
          />
        </div>
      </div>

      {/* Tags Comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Tag Changes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Skill Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {period2.aggregatedTags.skillTags.slice(0, 5).map((tag, i) => {
                  const p1Tag = period1.aggregatedTags.skillTags.find(t => t.tag === tag.tag);
                  const change = tag.count - (p1Tag?.count ?? 0);
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <Badge variant="secondary">{tag.tag.replace(/_/g, ' ')}</Badge>
                      <span className={cn(
                        "text-xs font-medium",
                        change > 0 && "text-green-600",
                        change < 0 && "text-destructive",
                        change === 0 && "text-muted-foreground"
                      )}>
                        {p1Tag?.count ?? 0} → {tag.count} ({change > 0 ? '+' : ''}{change})
                      </span>
                    </div>
                  );
                })}
                {period2.aggregatedTags.skillTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No skill tags in selected period</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Deal Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {period2.aggregatedTags.dealTags.slice(0, 5).map((tag, i) => {
                  const p1Tag = period1.aggregatedTags.dealTags.find(t => t.tag === tag.tag);
                  const change = tag.count - (p1Tag?.count ?? 0);
                  return (
                    <div key={i} className="flex items-center justify-between">
                      <Badge variant="outline">{tag.tag.replace(/_/g, ' ')}</Badge>
                      <span className={cn(
                        "text-xs font-medium",
                        change > 0 && "text-muted-foreground",
                        change < 0 && "text-muted-foreground",
                        change === 0 && "text-muted-foreground"
                      )}>
                        {p1Tag?.count ?? 0} → {tag.count} ({change > 0 ? '+' : ''}{change})
                      </span>
                    </div>
                  );
                })}
                {period2.aggregatedTags.dealTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">No deal tags in selected period</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
