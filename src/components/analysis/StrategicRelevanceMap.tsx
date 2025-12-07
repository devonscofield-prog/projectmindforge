import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Target,
  Quote,
  Package,
  Minus,
  HelpCircle
} from 'lucide-react';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface StrategicRelevanceMapProps {
  data: StrategyAudit | null | undefined;
}

// Impact color mapping
function getImpactStyles(impact: 'High' | 'Medium' | 'Low') {
  switch (impact) {
    case 'High':
      return 'bg-destructive/10 border-destructive/50 text-destructive';
    case 'Medium':
      return 'bg-yellow-500/10 border-yellow-500/50 text-yellow-700 dark:text-yellow-400';
    case 'Low':
      return 'bg-muted border-muted-foreground/30 text-muted-foreground';
  }
}

function getImpactBadgeVariant(impact: 'High' | 'Medium' | 'Low') {
  switch (impact) {
    case 'High':
      return 'destructive' as const;
    case 'Medium':
      return 'secondary' as const;
    case 'Low':
      return 'outline' as const;
  }
}

// Connected Cards for Relevance Bridge
interface RelevanceBridgeProps {
  painIdentified: string;
  featurePitched: string;
  isRelevant: boolean;
  reasoning?: string;
}

function RelevanceBridge({ painIdentified, featurePitched, isRelevant, reasoning }: RelevanceBridgeProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl border bg-card">
      {/* Pain Card */}
      <div className={cn(
        "flex-1 rounded-lg p-4 border-l-4",
        isRelevant 
          ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-blue-500" 
          : "bg-muted/50 border-l-muted-foreground/30"
      )}>
        <div className="flex items-start gap-3">
          <Quote className="h-4 w-4 text-blue-500 shrink-0 mt-1" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Pain Identified</p>
            <p className="text-sm italic">"{painIdentified}"</p>
          </div>
        </div>
      </div>

      {/* Connection Arrow */}
      <div className="flex items-center justify-center shrink-0 py-2 sm:py-0">
        <div className={cn(
          "flex items-center gap-1 px-3 py-2 rounded-full",
          isRelevant 
            ? "bg-green-100 dark:bg-green-950/30" 
            : "bg-destructive/10"
        )}>
          {isRelevant ? (
            <>
              <div className="h-px w-4 bg-green-500" />
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <div className="h-px w-4 bg-green-500" />
            </>
          ) : (
            <>
              <div className="h-px w-4 border-t-2 border-dashed border-destructive" />
              <XCircle className="h-5 w-5 text-destructive" />
              <div className="h-px w-4 border-t-2 border-dashed border-destructive" />
            </>
          )}
        </div>
      </div>

      {/* Feature Card */}
      <div className={cn(
        "flex-1 rounded-lg p-4 border-r-4",
        isRelevant 
          ? "bg-green-50/50 dark:bg-green-950/20 border-r-green-500" 
          : "bg-destructive/5 border-r-destructive/30"
      )}>
        <div className="flex items-start gap-3">
          <Package className="h-4 w-4 text-green-600 shrink-0 mt-1" />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1">Solution Pitched</p>
            <p className="text-sm font-medium">{featurePitched}</p>
          </div>
        </div>
      </div>

      {/* Reasoning (for mismatches) */}
      {!isRelevant && reasoning && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 sm:relative sm:bottom-auto sm:left-auto sm:translate-x-0">
                <Badge variant="outline" className="text-xs border-destructive/50 text-destructive cursor-help">
                  Why?
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="text-sm">{reasoning}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// Critical Gap Card
interface CriticalGapCardProps {
  category: string;
  description: string;
  impact: 'High' | 'Medium' | 'Low';
  suggestedQuestion: string;
}

function CriticalGapCard({ category, description, impact, suggestedQuestion }: CriticalGapCardProps) {
  return (
    <div className={cn(
      "p-4 rounded-xl border-2 space-y-3",
      getImpactStyles(impact)
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant={getImpactBadgeVariant(impact)} className="text-xs">
            {impact} Impact
          </Badge>
          <span className="font-semibold text-sm">{category}</span>
        </div>
      </div>
      
      <p className="text-sm">{description}</p>
      
      <div className="pt-2 border-t border-current/10">
        <div className="flex items-start gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 mt-0.5 opacity-70" />
          <div>
            <p className="text-xs font-medium opacity-70 mb-1">Ask This:</p>
            <p className="text-sm italic">"{suggestedQuestion}"</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StrategicRelevanceMap({ data }: StrategicRelevanceMapProps) {
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
              {[...Array(2)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { strategic_threading, critical_gaps } = data;
  const isPassing = strategic_threading.grade === 'Pass';
  const highImpactGaps = critical_gaps.filter(g => g.impact === 'High');

  return (
    <div className="space-y-6">
      {/* Strategic Threading - Relevance Bridge */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Pain-to-Pitch Alignment
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                How well solutions addressed customer pains
              </p>
            </div>
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
        </CardHeader>
        <CardContent className="space-y-4">
          {strategic_threading.relevance_map.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Minus className="h-4 w-4 mr-2" />
              No pain-to-pitch mappings identified
            </div>
          ) : (
            <div className="space-y-3">
              {strategic_threading.relevance_map.map((item, index) => (
                <RelevanceBridge
                  key={index}
                  painIdentified={item.pain_identified}
                  featurePitched={item.feature_pitched}
                  isRelevant={item.is_relevant}
                  reasoning={item.reasoning}
                />
              ))}
            </div>
          )}

          {/* Missed Opportunities */}
          {strategic_threading.missed_opportunities.length > 0 && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 mt-6">
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

      {/* Critical Gaps */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Critical Deal Gaps
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Key information blocking deal progress
              </p>
            </div>
            {highImpactGaps.length > 0 && (
              <Badge variant="destructive">
                {highImpactGaps.length} High Impact
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {critical_gaps.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              No critical gaps identified
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {critical_gaps.map((gap, index) => (
                <CriticalGapCard
                  key={index}
                  category={gap.category}
                  description={gap.description}
                  impact={gap.impact}
                  suggestedQuestion={gap.suggested_question}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
