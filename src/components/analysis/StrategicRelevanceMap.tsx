import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Target,
  ChevronDown,
  Info
} from 'lucide-react';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface StrategicRelevanceMapProps {
  data: StrategyAudit | null | undefined;
}

// MEDDPICC element configuration
const MEDDPICC_ELEMENTS = [
  { key: 'metrics', label: 'Metrics', short: 'M' },
  { key: 'economic_buyer', label: 'Economic Buyer', short: 'E' },
  { key: 'decision_criteria', label: 'Decision Criteria', short: 'D' },
  { key: 'decision_process', label: 'Decision Process', short: 'D' },
  { key: 'paper_process', label: 'Paper Process', short: 'P' },
  { key: 'implicate_pain', label: 'Implicate Pain', short: 'I' },
  { key: 'champion', label: 'Champion', short: 'C' },
  { key: 'competition', label: 'Competition', short: 'C' },
] as const;

type MEDDPICCKey = typeof MEDDPICC_ELEMENTS[number]['key'];

function getScoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-destructive';
}

function getProgressColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-destructive';
}

function getScoreStatus(score: number): string {
  if (score >= 80) return 'Strong';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  if (score >= 20) return 'Weak';
  return 'Not Covered';
}

export function StrategicRelevanceMap({ data }: StrategicRelevanceMapProps) {
  const [expandedElement, setExpandedElement] = useState<MEDDPICCKey | null>(null);

  // Loading skeleton state
  if (!data) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strategic Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-16 w-1/3" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-16 w-1/3" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { strategic_threading, meddpicc } = data;
  const isPassing = strategic_threading.grade === 'Pass';

  return (
    <div className="space-y-6">
      {/* Section 1: Strategic Threading - Relevance Map */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Strategic Threading
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{strategic_threading.score}</span>
              <Badge 
                variant={isPassing ? 'default' : 'destructive'}
                className={isPassing ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                {strategic_threading.grade}
              </Badge>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Pain-to-Pitch alignment analysis
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Relevance Map */}
          <div className="space-y-4">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Relevance Map
            </h4>
            
            {strategic_threading.relevance_map.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No pain-to-pitch mappings identified in this call.
              </p>
            ) : (
              <div className="space-y-3">
                {strategic_threading.relevance_map.map((item, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "rounded-lg border p-4",
                      item.is_relevant 
                        ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20" 
                        : "border-destructive/30 bg-destructive/5"
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                      {/* Pain Identified */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Pain Identified
                        </div>
                        <p className="text-sm italic">"{item.pain_identified}"</p>
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center justify-center shrink-0 sm:pt-4">
                        <ArrowRight className={cn(
                          "h-5 w-5",
                          item.is_relevant ? "text-green-500" : "text-destructive"
                        )} />
                      </div>

                      {/* Feature Pitched */}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-muted-foreground mb-1">
                          Solution Pitched
                        </div>
                        <p className="text-sm font-medium">{item.feature_pitched}</p>
                      </div>

                      {/* Status */}
                      <div className="flex items-start shrink-0 sm:pt-4">
                        {item.is_relevant ? (
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-destructive" />
                        )}
                      </div>
                    </div>

                    {/* Reasoning for mismatches */}
                    {!item.is_relevant && item.reasoning && (
                      <div className="mt-3 pt-3 border-t border-destructive/20">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">Why this was a mismatch:</span> {item.reasoning}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Missed Opportunities */}
          {strategic_threading.missed_opportunities.length > 0 && (
            <Alert className="border-yellow-500 bg-yellow-500/10">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-700 dark:text-yellow-400">
                Missed Opportunities
              </AlertTitle>
              <AlertDescription>
                <ul className="mt-2 space-y-1">
                  {strategic_threading.missed_opportunities.map((opportunity, index) => (
                    <li key={index} className="text-sm text-yellow-600 dark:text-yellow-300 flex items-start gap-2">
                      <span className="text-yellow-500 shrink-0">•</span>
                      {opportunity}
                    </li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Section 2: MEDDPICC Scorecard */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>MEDDPICC Scorecard</CardTitle>
            <div className="flex items-center gap-2">
              <span className={cn("text-2xl font-bold", getScoreColor(meddpicc.overall_score))}>
                {meddpicc.overall_score}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Deal qualification rigor based on verbal evidence
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {MEDDPICC_ELEMENTS.map((element) => {
              const breakdown = meddpicc.breakdown[element.key];
              const isExpanded = expandedElement === element.key;
              
              return (
                <Collapsible 
                  key={element.key}
                  open={isExpanded}
                  onOpenChange={(open) => setExpandedElement(open ? element.key : null)}
                >
                  <div className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
                    <CollapsibleTrigger className="w-full text-left">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-bold text-lg w-6 h-6 rounded flex items-center justify-center text-xs",
                            breakdown.score >= 70 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
                            breakdown.score >= 40 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" :
                            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                          )}>
                            {element.short}
                          </span>
                          <span className="text-sm font-medium truncate">{element.label}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className={cn("text-lg font-bold", getScoreColor(breakdown.score))}>
                            {breakdown.score}
                          </span>
                          <ChevronDown className={cn(
                            "h-4 w-4 text-muted-foreground transition-transform",
                            isExpanded && "rotate-180"
                          )} />
                        </div>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="relative h-2 w-full bg-secondary rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full transition-all", getProgressColor(breakdown.score))}
                          style={{ width: `${breakdown.score}%` }}
                        />
                      </div>
                      
                      <div className="mt-1 flex items-center justify-between">
                        <span className={cn("text-xs", getScoreColor(breakdown.score))}>
                          {getScoreStatus(breakdown.score)}
                        </span>
                        {(breakdown.evidence || breakdown.missing_info) && (
                          <Info className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-3 space-y-2">
                      {breakdown.evidence && (
                        <div className="text-xs">
                          <span className="font-medium text-green-600">Evidence:</span>
                          <p className="text-muted-foreground mt-0.5">{breakdown.evidence}</p>
                        </div>
                      )}
                      {breakdown.missing_info && breakdown.score < 70 && (
                        <div className="text-xs">
                          <span className="font-medium text-destructive">Missing:</span>
                          <p className="text-muted-foreground mt-0.5">{breakdown.missing_info}</p>
                        </div>
                      )}
                      {!breakdown.evidence && !breakdown.missing_info && (
                        <p className="text-xs text-muted-foreground italic">
                          No additional details available.
                        </p>
                      )}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
