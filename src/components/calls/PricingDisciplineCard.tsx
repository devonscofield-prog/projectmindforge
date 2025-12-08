import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, DollarSign, CheckCircle, XCircle, AlertTriangle, Lightbulb, Clock, HandCoins } from 'lucide-react';
import { useState } from 'react';
import type { PricingDiscipline } from '@/utils/analysis-schemas';

interface PricingDisciplineCardProps {
  data: PricingDiscipline | null | undefined;
}

export function PricingDisciplineCard({ data }: PricingDisciplineCardProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (!data) {
    return null;
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600 dark:text-green-400';
    if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 70) return 'bg-green-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getTimingBadgeVariant = (timing: string) => {
    switch (timing) {
      case 'Appropriate':
        return 'default';
      case 'Premature':
        return 'destructive';
      case 'Late/Reactive':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getTimingIcon = (timing: string) => {
    switch (timing) {
      case 'Appropriate':
        return <CheckCircle className="h-3 w-3" />;
      case 'Premature':
        return <AlertTriangle className="h-3 w-3" />;
      case 'Late/Reactive':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <HandCoins className="h-5 w-5 text-primary" />
                Pricing Discipline
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className={`text-2xl font-bold ${getScoreColor(data.pricing_score)}`}>
                    {data.pricing_score}
                  </span>
                  <span className="text-sm text-muted-foreground">/100</span>
                </div>
                <Badge variant={data.grade === 'Pass' ? 'default' : 'destructive'}>
                  {data.grade}
                </Badge>
                <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Score Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Score</span>
                <span className={getScoreColor(data.pricing_score)}>{data.pricing_score}%</span>
              </div>
              <Progress 
                value={data.pricing_score} 
                className="h-2"
                style={{ ['--progress-background' as string]: getProgressColor(data.pricing_score) }}
              />
            </div>

            {/* Summary */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm">{data.summary}</p>
            </div>

            {/* Discounts Offered */}
            {data.discounts_offered && data.discounts_offered.length > 0 ? (
              <div className="space-y-4">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Discounts Offered ({data.discounts_offered.length})
                </h4>
                <div className="space-y-3">
                  {data.discounts_offered.map((discount, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline">{discount.type}</Badge>
                          <span className="font-medium">{discount.discount_value}</span>
                        </div>
                        <Badge variant={getTimingBadgeVariant(discount.timing_assessment)} className="flex items-center gap-1">
                          {getTimingIcon(discount.timing_assessment)}
                          {discount.timing_assessment}
                        </Badge>
                      </div>
                      
                      <div className="text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                        "{discount.context_quote}"
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant={discount.value_established_before ? 'default' : 'secondary'}>
                          {discount.value_established_before ? '✓ Value first' : '✗ No value established'}
                        </Badge>
                        <Badge variant={discount.prospect_requested ? 'default' : 'secondary'}>
                          {discount.prospect_requested ? '✓ Prospect requested' : '✗ Volunteered'}
                        </Badge>
                      </div>

                      <div className="text-sm bg-primary/5 p-2 rounded flex items-start gap-2">
                        <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{discount.coaching_note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-center border rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400 mx-auto mb-2" />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">
                  No discounts offered
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Excellent pricing discipline - held firm on value
                </p>
              </div>
            )}

            {/* Coaching Tips */}
            {data.coaching_tips && data.coaching_tips.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Coaching Tips
                </h4>
                <ul className="space-y-2">
                  {data.coaching_tips.map((tip, index) => (
                    <li key={index} className="text-sm flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
