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
  Minus
} from 'lucide-react';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface StrategicRelevanceMapProps {
  data: StrategyAudit | null | undefined;
}

// MEDDPICC element configuration
const MEDDPICC_ELEMENTS = [
  { key: 'metrics', label: 'Metrics', letter: 'M', description: 'Quantifiable outcomes' },
  { key: 'economic_buyer', label: 'Economic Buyer', letter: 'E', description: 'Decision maker identified' },
  { key: 'decision_criteria', label: 'Decision Criteria', letter: 'D', description: 'Evaluation criteria' },
  { key: 'decision_process', label: 'Decision Process', letter: 'D', description: 'Buying process' },
  { key: 'paper_process', label: 'Paper Process', letter: 'P', description: 'Procurement steps' },
  { key: 'implicate_pain', label: 'Implicate Pain', letter: 'I', description: 'Business impact' },
  { key: 'champion', label: 'Champion', letter: 'C', description: 'Internal advocate' },
  { key: 'competition', label: 'Competition', letter: 'C', description: 'Alternatives' },
] as const;

type MEDDPICCKey = keyof StrategyAudit['meddpicc']['breakdown'];

function getScoreState(score: number): 'empty' | 'weak' | 'fair' | 'good' | 'strong' {
  if (score >= 80) return 'strong';
  if (score >= 60) return 'good';
  if (score >= 40) return 'fair';
  if (score >= 20) return 'weak';
  return 'empty';
}

function getScoreStyles(state: ReturnType<typeof getScoreState>) {
  switch (state) {
    case 'strong':
      return 'bg-green-500 text-white border-green-600';
    case 'good':
      return 'bg-green-400/80 text-white border-green-500';
    case 'fair':
      return 'bg-yellow-400/80 text-yellow-900 border-yellow-500';
    case 'weak':
      return 'bg-orange-400/50 text-orange-900 border-orange-500/50';
    case 'empty':
      return 'bg-muted/50 text-muted-foreground border-muted';
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

// MEDDPICC Card with Tooltip
interface MEDDPICCCardProps {
  letter: string;
  label: string;
  description: string;
  score: number;
  evidence?: string;
  missingInfo?: string;
}

function MEDDPICCCard({ letter, label, description, score, evidence, missingInfo }: MEDDPICCCardProps) {
  const state = getScoreState(score);
  const styles = getScoreStyles(state);
  
  const hasDetails = evidence || missingInfo;
  
  const cardContent = (
    <div 
      className={cn(
        "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
        styles,
        hasDetails && "cursor-pointer hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      )}
      tabIndex={hasDetails ? 0 : undefined}
      role={hasDetails ? "button" : undefined}
      aria-label={hasDetails ? `${label}: ${score}%. Click for details.` : `${label}: ${score}%`}
    >
      {/* Letter Badge */}
      <span className="text-2xl font-bold" aria-hidden="true">{letter}</span>
      
      {/* Label */}
      <span className="text-xs font-medium mt-1 text-center">{label}</span>
      
      {/* Score */}
      <span className={cn(
        "text-xs mt-2 px-2 py-0.5 rounded-full",
        state === 'strong' || state === 'good' 
          ? "bg-white/20" 
          : "bg-foreground/10"
      )}>
        {score}%
      </span>
    </div>
  );

  if (!hasDetails) {
    return cardContent;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          {cardContent}
        </TooltipTrigger>
        <TooltipContent 
          side="bottom" 
          className="max-w-sm p-4 space-y-3"
          sideOffset={8}
        >
          <div className="font-medium">{label}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
          
          {evidence && (
            <div>
              <p className="text-xs font-medium text-green-600 mb-1">Evidence Found:</p>
              <p className="text-sm text-muted-foreground">{evidence}</p>
            </div>
          )}
          
          {missingInfo && score < 80 && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1">Still Missing:</p>
              <p className="text-sm text-muted-foreground">{missingInfo}</p>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
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

      {/* MEDDPICC Evidence Board */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>MEDDPICC Evidence Board</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Tap or hover for details • Based on verbal evidence
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-2xl font-bold",
                meddpicc.overall_score >= 70 ? "text-green-600" :
                meddpicc.overall_score >= 40 ? "text-yellow-600" : "text-destructive"
              )}>
                {meddpicc.overall_score}
              </span>
              <span className="text-sm text-muted-foreground">/ 100</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Grid of 8 cards */}
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
            {MEDDPICC_ELEMENTS.map((element) => {
              const breakdown = meddpicc.breakdown[element.key];
              
              return (
                <MEDDPICCCard
                  key={element.key}
                  letter={element.letter}
                  label={element.label}
                  description={element.description}
                  score={breakdown.score}
                  evidence={breakdown.evidence ?? undefined}
                  missingInfo={breakdown.missing_info ?? undefined}
                />
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 pt-4 border-t">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-green-500" />
              <span>Strong (80+)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-green-400/80" />
              <span>Good (60-79)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-yellow-400/80" />
              <span>Fair (40-59)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-orange-400/50" />
              <span>Weak (20-39)</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-3 w-3 rounded bg-muted/50 border" />
              <span>Not Covered (0-19)</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
