import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
  Quote,
  Package,
  Minus,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Lightbulb,
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner';
import type { StrategyAudit } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface StrategicRelevanceMapProps {
  data: StrategyAudit | null | undefined;
}

// Severity color mapping
function getSeverityStyles(severity: 'High' | 'Medium' | 'Low' | undefined) {
  switch (severity) {
    case 'High':
      return 'border-l-destructive bg-destructive/5';
    case 'Medium':
      return 'border-l-yellow-500 bg-yellow-500/5';
    case 'Low':
      return 'border-l-muted-foreground/30 bg-muted/30';
    default:
      return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
  }
}

function getSeverityBadge(severity: 'High' | 'Medium' | 'Low' | undefined) {
  if (!severity) return null;
  const variants = {
    High: 'destructive' as const,
    Medium: 'secondary' as const,
    Low: 'outline' as const,
  };
  return <Badge variant={variants[severity]} className="text-xs">{severity}</Badge>;
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
  painSeverity?: 'High' | 'Medium' | 'Low';
  painType?: 'Explicit' | 'Implicit';
}

function RelevanceBridge({ painIdentified, featurePitched, isRelevant, reasoning, painSeverity, painType }: RelevanceBridgeProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-xl border bg-card">
      {/* Pain Card */}
      <div className={cn(
        "flex-1 rounded-lg p-4 border-l-4",
        getSeverityStyles(painSeverity)
      )}>
        <div className="flex items-start gap-3">
          <Quote className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <p className="text-xs font-medium text-muted-foreground">Pain Identified</p>
              {getSeverityBadge(painSeverity)}
              {painType && (
                <Badge variant="outline" className="text-xs">
                  {painType}
                </Badge>
              )}
            </div>
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

      {/* Reasoning (shown inline for misaligned items) */}
      {!isRelevant && reasoning && (
        <div className="w-full sm:w-auto sm:max-w-[200px] mt-2 sm:mt-0">
          <div className="p-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive">{reasoning}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Missed Opportunity Card (new structured format)
interface MissedOpportunityCardProps {
  pain: string;
  severity: 'High' | 'Medium';
  suggestedPitch: string;
  talkTrack: string;
}

function MissedOpportunityCard({ pain, severity, suggestedPitch, talkTrack }: MissedOpportunityCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(talkTrack);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Talk track copied to clipboard');
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border-2 space-y-3",
      severity === 'High' 
        ? "border-destructive/50 bg-destructive/5" 
        : "border-yellow-500/50 bg-yellow-500/5"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className={cn(
              "h-4 w-4",
              severity === 'High' ? "text-destructive" : "text-yellow-500"
            )} />
            <Badge variant={severity === 'High' ? 'destructive' : 'secondary'} className="text-xs">
              {severity} Priority
            </Badge>
          </div>
          <p className="text-sm font-medium">{pain}</p>
        </div>
      </div>
      
      <div className="flex items-start gap-2 text-sm text-muted-foreground">
        <TrendingUp className="h-4 w-4 shrink-0 mt-0.5" />
        <span><strong>Pitch:</strong> {suggestedPitch}</span>
      </div>

      <div 
        onClick={handleCopy}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCopy();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Copy talk track to clipboard"
        className={cn(
          "group relative p-3 rounded-lg cursor-pointer transition-all",
          "bg-background/50 border border-dashed hover:border-solid hover:bg-background",
          "dark:bg-background/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        title="Click to copy"
      >
        <div className="flex items-start gap-2">
          <Lightbulb className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Talk Track (click to copy)</p>
            <p className="text-sm italic">"{talkTrack}"</p>
          </div>
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>
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
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(suggestedQuestion);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Question copied to clipboard');
  };

  return (
    <div className={cn(
      "p-4 rounded-xl border-2 space-y-3",
      getImpactStyles(impact)
    )}>
      {/* Top Line: Category + Description */}
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn(
          "h-5 w-5 shrink-0 mt-0.5",
          impact === 'High' && "text-destructive",
          impact === 'Medium' && "text-yellow-500",
          impact === 'Low' && "text-muted-foreground"
        )} />
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-bold text-sm">{category}</span>
            <Badge variant={getImpactBadgeVariant(impact)} className="text-xs">
              {impact}
            </Badge>
          </div>
          <p className="text-sm">{description}</p>
        </div>
      </div>
      
      {/* Bottom Line: Suggested Question - Styled as copyable tip box */}
      <div 
        onClick={handleCopy}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCopy();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Copy suggested question to clipboard"
        className={cn(
          "group relative p-3 rounded-lg cursor-pointer transition-all",
          "bg-background/50 border border-dashed hover:border-solid hover:bg-background",
          "dark:bg-background/30 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        )}
        title="Click to copy"
      >
        <div className="flex items-start gap-2">
          <span className="text-lg shrink-0">💡</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Ask this:</p>
            <p className="text-sm font-medium italic">"{suggestedQuestion}"</p>
          </div>
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </div>
      </div>
    </div>
  );
}

// Score Breakdown Component
interface ScoreBreakdownProps {
  breakdown: {
    high_pains_addressed: number;
    high_pains_total: number;
    medium_pains_addressed?: number;
    medium_pains_total?: number;
    spray_and_pray_count: number;
  };
}

function ScoreBreakdown({ breakdown }: ScoreBreakdownProps) {
  const highPercent = breakdown.high_pains_total > 0 
    ? (breakdown.high_pains_addressed / breakdown.high_pains_total) * 100 
    : 100;
  const mediumPercent = (breakdown.medium_pains_total ?? 0) > 0 
    ? ((breakdown.medium_pains_addressed ?? 0) / (breakdown.medium_pains_total ?? 1)) * 100 
    : 100;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border">
      <div className="text-center">
        <div className="text-2xl font-bold text-destructive">
          {breakdown.high_pains_addressed}/{breakdown.high_pains_total}
        </div>
        <div className="text-xs text-muted-foreground">High Priority Addressed</div>
        <Progress value={highPercent} className="h-1.5 mt-2" />
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-yellow-600">
          {breakdown.medium_pains_addressed ?? 0}/{breakdown.medium_pains_total ?? 0}
        </div>
        <div className="text-xs text-muted-foreground">Medium Priority Addressed</div>
        <Progress value={mediumPercent} className="h-1.5 mt-2" />
      </div>
      <div className="text-center">
        <div className={cn(
          "text-2xl font-bold",
          breakdown.spray_and_pray_count > 0 ? "text-destructive" : "text-green-600"
        )}>
          {breakdown.spray_and_pray_count}
        </div>
        <div className="text-xs text-muted-foreground">Spray & Pray Pitches</div>
        <div className="text-xs mt-2">
          {breakdown.spray_and_pray_count === 0 ? "✓ None" : "⚠️ -5 pts each"}
        </div>
      </div>
    </div>
  );
}

// Exported component for Pain-to-Pitch Alignment (Strategy tab)
export function PainToPitchAlignment({ data }: StrategicRelevanceMapProps) {
  const [showAll, setShowAll] = useState(false);

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Strategic Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { strategic_threading } = data;
  const isPassing = strategic_threading?.grade === 'Pass';
  
  // Sort relevance map: High severity first, then misaligned items
  const sortedRelevanceMap = [...(strategic_threading.relevance_map || [])].sort((a, b) => {
    const severityOrder = { High: 0, Medium: 1, Low: 2 };
    const aSev = severityOrder[a.pain_severity || 'Low'];
    const bSev = severityOrder[b.pain_severity || 'Low'];
    if (aSev !== bSev) return aSev - bSev;
    // Then sort by relevance (irrelevant first for coaching)
    return (a.is_relevant ? 1 : 0) - (b.is_relevant ? 1 : 0);
  });
  
  const displayedItems = showAll ? sortedRelevanceMap : sortedRelevanceMap.slice(0, 5);
  const hasMore = sortedRelevanceMap.length > 5;

  // Parse missed opportunities (can be strings or structured objects)
  const missedOpportunities = strategic_threading.missed_opportunities || [];
  const structuredMissed = missedOpportunities.filter(
    (item): item is { pain: string; severity: 'High' | 'Medium'; suggested_pitch: string; talk_track: string } => 
      typeof item === 'object' && 'pain' in item
  );
  const legacyMissed = missedOpportunities.filter((item): item is string => typeof item === 'string');

  return (
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
        {/* Strategic Summary Banner */}
        {strategic_threading.strategic_summary && (
          <Alert className="border-primary/30 bg-primary/5">
            <Target className="h-4 w-4" />
            <AlertDescription className="text-sm font-medium">
              {strategic_threading.strategic_summary}
            </AlertDescription>
          </Alert>
        )}

        {/* Score Breakdown */}
        {strategic_threading.score_breakdown && (
          <ScoreBreakdown breakdown={strategic_threading.score_breakdown} />
        )}

        {/* Relevance Map */}
        {sortedRelevanceMap.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Minus className="h-4 w-4 mr-2" />
            No pain-to-pitch mappings identified
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-muted-foreground">
                Pain → Solution Connections ({sortedRelevanceMap.length})
              </h4>
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAll(!showAll)}
                  className="text-xs"
                >
                  {showAll ? (
                    <>Show Less <ChevronUp className="h-3 w-3 ml-1" /></>
                  ) : (
                    <>Show All ({sortedRelevanceMap.length}) <ChevronDown className="h-3 w-3 ml-1" /></>
                  )}
                </Button>
              )}
            </div>
            {displayedItems.map((item, index) => (
              <RelevanceBridge
                key={index}
                painIdentified={item.pain_identified}
                featurePitched={item.feature_pitched}
                isRelevant={item.is_relevant}
                reasoning={item.reasoning}
                painSeverity={item.pain_severity}
                painType={item.pain_type}
              />
            ))}
          </div>
        )}

        {/* Missed Opportunities - Structured Format */}
        {structuredMissed.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Missed Opportunities ({structuredMissed.length})
            </h4>
            <div className="grid gap-3 md:grid-cols-2">
              {structuredMissed.map((opportunity, index) => (
                <MissedOpportunityCard
                  key={index}
                  pain={opportunity.pain}
                  severity={opportunity.severity}
                  suggestedPitch={opportunity.suggested_pitch}
                  talkTrack={opportunity.talk_track}
                />
              ))}
            </div>
          </div>
        )}

        {/* Legacy Missed Opportunities (fallback for old data) */}
        {legacyMissed.length > 0 && structuredMissed.length === 0 && (
          <Alert className="border-yellow-500/50 bg-yellow-500/10 mt-6">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle className="text-yellow-700 dark:text-yellow-400">
              Missed Opportunities
            </AlertTitle>
            <AlertDescription>
              <ul className="mt-2 space-y-1">
                {legacyMissed.map((opportunity, index) => (
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
  );
}

// Exported component for Critical Gaps (Hazards tab)
export function CriticalGapsPanel({ data }: StrategicRelevanceMapProps) {
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Deal Hazards & Gaps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { critical_gaps = [] } = data;
  const safeGaps = Array.isArray(critical_gaps) ? critical_gaps : [];
  const highImpactGaps = safeGaps.filter(g => g.impact === 'High');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              ⚠️ Deal Hazards & Gaps
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Critical unknowns that could derail this deal
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
        {safeGaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 mb-2 text-green-500" />
            <p>No critical gaps identified</p>
            <p className="text-xs mt-1">(or this call was analyzed with a previous version)</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {safeGaps.map((gap, index) => (
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
  );
}

// Full component (backward compatibility)
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

  return (
    <div className="space-y-6">
      <PainToPitchAlignment data={data} />
      <CriticalGapsPanel data={data} />
    </div>
  );
}