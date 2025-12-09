import { ReactNode, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  Users, 
  Monitor, 
  Clock,
  Mic,
  Target,
  Mail,
  AlertTriangle,
  Pencil,
  RefreshCw,
  Video,
  VideoOff,
  Crown,
  Quote,
  UserCircle,
  FileText,
  Tag,
  History,
  ChevronDown
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { 
  BehaviorScoreSchema, 
  StrategyAuditSchema, 
  CallMetadataSchema,
  DealHeatSchema,
  PsychologyProfileSchema,
  CallClassificationSchema,
  CoachingSynthesisSchema,
  type BehaviorScore, 
  type StrategyAudit, 
  type CallMetadata,
  type DealHeat,
  type PsychologyProfile,
  type CallClassification,
  type CoachingSynthesis
} from '@/utils/analysis-schemas';
import { DealHeatCard } from './DealHeatCard';
import { ProspectPersonaCard } from './ProspectPersonaCard';
import { CoachGradeBadge } from '@/components/ui/coach-grade-badge';

interface CallAnalysisLayoutProps {
  transcript: CallTranscript;
  analysis: CallAnalysis | null;
  behaviorContent: ReactNode;
  strategyContent: ReactNode;
  hazardsContent: ReactNode;
  recapContent: ReactNode;
  canEdit?: boolean;
  onEditUserCounts?: () => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

interface CircularScoreProps {
  score: number;
  label: string;
  size?: 'sm' | 'lg';
}

function CircularScore({ score, label, size = 'lg' }: CircularScoreProps) {
  const isPassing = score >= 75;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (score / 100) * circumference;
  
  const sizeClasses = size === 'lg' 
    ? 'h-32 w-32' 
    : 'h-20 w-20';
  
  const textSize = size === 'lg' ? 'text-3xl' : 'text-xl';
  
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", sizeClasses)}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-all duration-500",
              isPassing ? "text-green-500" : "text-destructive"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", textSize, isPassing ? "text-green-600" : "text-destructive")}>
            {score}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Badge 
          variant={isPassing ? 'default' : 'destructive'}
          className={cn(
            "mt-1",
            isPassing ? 'bg-green-500 hover:bg-green-600' : ''
          )}
        >
          {isPassing ? 'PASS' : 'FAIL'}
        </Badge>
      </div>
    </div>
  );
}

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sourceQuote?: string | null;
  extraBadges?: ReactNode;
}

function StatCard({ icon, label, value, sourceQuote, extraBadges }: StatCardProps) {
  const content = (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 h-full">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          {sourceQuote && (
            <Quote className="h-3 w-3 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold">{value}</p>
          {extraBadges}
        </div>
      </div>
    </div>
  );

  if (sourceQuote) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs italic">"{sourceQuote}"</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

// Sentiment badge colors
const sentimentStyles: Record<string, string> = {
  'Positive': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  'Neutral': 'bg-muted text-muted-foreground border-muted-foreground/30',
  'Skeptical': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  'Negative': 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

interface ParticipantBadgeProps {
  participant: {
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  };
}

function ParticipantBadge({ participant }: ParticipantBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs",
            sentimentStyles[participant.sentiment] || sentimentStyles['Neutral']
          )}>
            {participant.is_decision_maker && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
            <span className="font-medium truncate max-w-[180px]">{participant.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">{participant.name}</p>
            <p className="text-muted-foreground">{participant.role}</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className={cn("text-[10px]", sentimentStyles[participant.sentiment])}>
                {participant.sentiment}
              </Badge>
              {participant.is_decision_maker && (
                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                  Decision Maker
                </Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Detection Signals Collapsible Component
function DetectionSignalsCollapsible({ signals }: { signals: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayedSignals = signals.slice(0, 5);
  const hasMore = signals.length > 5;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          isOpen && "rotate-180"
        )} />
        <span>Why this classification? ({signals.length} signals)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 pl-4">
        {displayedSignals.map((signal, idx) => (
          <p key={idx} className="text-xs text-muted-foreground">
            <span className="text-muted-foreground/60 mr-1">•</span>
            <span className="italic">"{signal}"</span>
          </p>
        ))}
        {hasMore && (
          <p className="text-xs text-muted-foreground/60 italic">
            and {signals.length - 5} more signals...
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function CallAnalysisLayout({
  transcript,
  analysis,
  behaviorContent,
  strategyContent,
  hazardsContent,
  recapContent,
  canEdit = false,
  onEditUserCounts,
  onReanalyze,
  isReanalyzing = false,
}: CallAnalysisLayoutProps) {
  // Defensive JSON parsing with Zod validation
  const { behaviorData, strategyData, metadataData, dealHeatData, psychologyData, callClassificationData, coachingData, parseError } = useMemo(() => {
    if (!analysis) {
      return { behaviorData: null, strategyData: null, metadataData: null, dealHeatData: null, psychologyData: null, callClassificationData: null, coachingData: null, parseError: null };
    }

    try {
      const behaviorResult = analysis.analysis_behavior 
        ? BehaviorScoreSchema.safeParse(analysis.analysis_behavior)
        : { success: false, data: null };
      
      const strategyResult = analysis.analysis_strategy 
        ? StrategyAuditSchema.safeParse(analysis.analysis_strategy)
        : { success: false, data: null };
      
      const metadataResult = analysis.analysis_metadata 
        ? CallMetadataSchema.safeParse(analysis.analysis_metadata)
        : { success: false, data: null };

      const dealHeatResult = analysis.deal_heat_analysis 
        ? DealHeatSchema.safeParse(analysis.deal_heat_analysis)
        : { success: false, data: null };

      const psychologyResult = analysis.analysis_psychology 
        ? PsychologyProfileSchema.safeParse(analysis.analysis_psychology)
        : { success: false, data: null };

      // Parse coaching data
      const coachingResult = analysis.analysis_coaching
        ? CoachingSynthesisSchema.safeParse(analysis.analysis_coaching)
        : { success: false, data: null };

      // Parse call classification from raw_json
      const rawJson = analysis.raw_json as { call_classification?: unknown } | null;
      const callClassificationResult = rawJson?.call_classification
        ? CallClassificationSchema.safeParse(rawJson.call_classification)
        : { success: false, data: null };

      // Log validation errors for debugging but don't crash
      if (!behaviorResult.success && analysis.analysis_behavior) {
        console.warn('BehaviorScore validation failed:', 'error' in behaviorResult ? behaviorResult.error : 'unknown');
      }
      if (!strategyResult.success && analysis.analysis_strategy) {
        console.warn('StrategyAudit validation failed:', 'error' in strategyResult ? strategyResult.error : 'unknown');
      }

      const behavior = behaviorResult.success ? behaviorResult.data : null;
      const strategy = strategyResult.success ? strategyResult.data : null;
      const metadata = metadataResult.success ? metadataResult.data : null;
      const dealHeat = dealHeatResult.success ? dealHeatResult.data : null;
      const psychology = psychologyResult.success ? psychologyResult.data : null;
      const callClassification = callClassificationResult.success ? callClassificationResult.data : null;
      const coaching = coachingResult.success ? coachingResult.data : null;

      // If both critical schemas failed but data exists, that's a parse error
      const hasCriticalError = analysis.analysis_behavior && analysis.analysis_strategy 
        && !behavior && !strategy;

      return { 
        behaviorData: behavior as BehaviorScore | null, 
        strategyData: strategy as StrategyAudit | null, 
        metadataData: metadata as CallMetadata | null,
        dealHeatData: dealHeat as DealHeat | null,
        psychologyData: psychology as PsychologyProfile | null,
        callClassificationData: callClassification as CallClassification | null,
        coachingData: coaching as CoachingSynthesis | null,
        parseError: hasCriticalError ? 'Analysis data could not be parsed' : null
      };
    } catch (err) {
      console.error('Error parsing analysis data:', err);
      return { 
        behaviorData: null, 
        strategyData: null, 
        metadataData: null, 
        dealHeatData: null,
        psychologyData: null,
        callClassificationData: null,
        coachingData: null,
        parseError: 'Unexpected error parsing analysis data' 
      };
    }
  }, [analysis]);
  
  const behaviorScore = behaviorData?.overall_score ?? 0;
  const strategyScore = strategyData?.strategic_threading?.score ?? 0;
  
  // Extract key stats from metadata
  const stats = useMemo(() => {
    const itUsers = metadataData?.user_counts?.it_users ?? '-';
    const endUsers = metadataData?.user_counts?.end_users ?? '-';
    const sourceQuote = metadataData?.user_counts?.source_quote ?? null;
    const duration = metadataData?.logistics?.duration_minutes 
      ? `${metadataData.logistics.duration_minutes} min` 
      : '-';
    const platform = metadataData?.logistics?.platform ?? null;
    const videoOn = metadataData?.logistics?.video_on ?? null;
    
    return { itUsers, endUsers, sourceQuote, duration, platform, videoOn };
  }, [metadataData]);

  // Extract summary and topics from metadata (Historian output)
  const summary = metadataData?.summary || null;
  const topics = metadataData?.topics || [];

  // Extract participants from metadata
  const participants = metadataData?.participants ?? [];

  // Display names
  const prospectName = transcript.account_name || transcript.primary_stakeholder_name || 'Unknown Prospect';

  // Show error state if parsing failed completely - but still show Re-run button
  if (parseError) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <div>
                <h3 className="font-semibold text-lg">Analysis Data Error</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {parseError}. Please try re-analyzing this call.
                </p>
              </div>
            </div>
            {canEdit && onReanalyze && (
              <Button
                variant="outline"
                size="sm"
                onClick={onReanalyze}
                disabled={isReanalyzing}
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", isReanalyzing && "animate-spin")} />
                {isReanalyzing ? 'Reanalyzing...' : 'Re-run Analysis'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // If no analysis yet, show skeleton
  if (!analysis) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-6 lg:flex-row lg:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="flex gap-8">
                <Skeleton className="h-32 w-32 rounded-full" />
                <Skeleton className="h-32 w-32 rounded-full" />
              </div>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          </CardContent>
        </Card>
        <Skeleton className="h-[400px]" />
      </div>
    );
  }
  
  // Check if this is a legacy analysis needing re-run
  const isLegacyAnalysis = !behaviorData || !strategyData;

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
          <CardContent className="p-0">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              {/* Left: Names + Persona */}
              <div className="space-y-4 lg:max-w-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-xl font-semibold">{prospectName}</h2>
                      {callClassificationData && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "text-xs capitalize",
                            callClassificationData.confidence === 'high' && "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
                            callClassificationData.confidence === 'medium' && "border-yellow-500/50 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
                            callClassificationData.confidence === 'low' && "border-muted-foreground/50"
                          )}
                        >
                          {callClassificationData.detected_call_type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground text-sm">Coaching Analysis</p>
                    
                    {/* Detection Signals - Enhancement #2 */}
                    {callClassificationData?.detection_signals && callClassificationData.detection_signals.length > 0 && (
                      <DetectionSignalsCollapsible signals={callClassificationData.detection_signals} />
                    )}
                  </div>
                  {canEdit && onReanalyze && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onReanalyze}
                      disabled={isReanalyzing}
                      className="shrink-0"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", isReanalyzing && "animate-spin")} />
                      {isReanalyzing ? 'Reanalyzing...' : 'Re-run Analysis'}
                    </Button>
                  )}
                </div>
                
                {/* Prospect Persona Card */}
                <ProspectPersonaCard psychology={psychologyData} />
              </div>
              
              {/* Right: Coach Grade + Big Scores */}
              <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-row sm:items-center sm:justify-center sm:gap-8 lg:gap-12">
                {/* Coach Grade - Prominent Display */}
                {coachingData?.overall_grade && (
                  <div className="flex flex-col items-center gap-2 col-span-2 sm:col-span-1">
                    <div 
                      className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-primary/30 bg-primary/10"
                      role="img"
                      aria-label={`Overall coach grade: ${coachingData.overall_grade}`}
                    >
                      <span className="text-3xl font-bold text-primary">{coachingData.overall_grade}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">Coach Grade</p>
                      {analysis?.created_at && (
                        <p className="text-xs text-muted-foreground/70 flex items-center gap-1 justify-center mt-1">
                          <History className="h-3 w-3" aria-hidden="true" />
                          <span>Analyzed {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true })}</span>
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {isLegacyAnalysis ? (
                  <Alert className="col-span-2 border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-sm">
                      <span className="font-medium text-amber-700 dark:text-amber-400">Legacy Analysis</span>
                      <span className="text-muted-foreground"> — This call was analyzed with an older pipeline. Re-run to get full insights.</span>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <CircularScore score={behaviorScore} label="Behavior" size="sm" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">75+ is passing</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <CircularScore score={strategyScore} label="Strategy" size="sm" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p className="text-xs">75+ is passing</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                )}
              </div>
            </div>

            {/* Call Summary (Historian output) */}
            {summary && (
              <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Call Summary</span>
                </div>
                <p className="text-sm text-foreground/90 leading-relaxed">{summary}</p>
              </div>
            )}

            {/* Key Topics (Historian output) */}
            {topics.length > 0 && (
              <div className="mt-3">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Key Topics</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((topic, idx) => (
                    <Badge 
                      key={idx} 
                      variant="secondary" 
                      className="text-xs font-normal"
                    >
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Participants Row */}
            {participants.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <UserCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Participants</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {participants.map((participant, idx) => (
                    <ParticipantBadge key={idx} participant={participant} />
                  ))}
                </div>
              </div>
            )}

            {/* Key Stats Row */}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="relative group">
                <StatCard 
                  icon={<Monitor className="h-5 w-5" />}
                  label="IT Users"
                  value={stats.itUsers}
                  sourceQuote={stats.sourceQuote}
                />
                {canEdit && onEditUserCounts && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onEditUserCounts}
                    aria-label="Edit user counts"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="relative group">
                <StatCard 
                  icon={<Users className="h-5 w-5" />}
                  label="End Users"
                  value={stats.endUsers}
                  sourceQuote={stats.sourceQuote}
                />
                {canEdit && onEditUserCounts && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={onEditUserCounts}
                    aria-label="Edit user counts"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <StatCard 
                icon={<Clock className="h-5 w-5" />}
                label="Duration"
                value={stats.duration}
                extraBadges={
                  <div className="flex items-center gap-1">
                    {stats.videoOn !== null && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className={cn(
                              "p-0.5 rounded",
                              stats.videoOn ? "text-green-600" : "text-muted-foreground"
                            )}>
                              {stats.videoOn ? <Video className="h-3.5 w-3.5" /> : <VideoOff className="h-3.5 w-3.5" />}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p className="text-xs">{stats.videoOn ? 'Video was on' : 'Video was off'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {stats.platform && (
                      <Badge variant="outline" className="text-[10px] px-1 py-0">
                        {stats.platform}
                      </Badge>
                    )}
                  </div>
                }
              />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Deal Heat Card - Always Visible */}
      <DealHeatCard
        transcript={transcript.raw_text}
        strategyData={strategyData}
        behaviorData={behaviorData}
        metadataData={metadataData}
        existingHeatData={dealHeatData}
        callId={transcript.id}
      />

      {/* Tabbed Interface */}
      <Tabs defaultValue="behavior" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger 
            value="behavior" 
            className="flex items-center gap-1 sm:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Behavior</span>
          </TabsTrigger>
          <TabsTrigger 
            value="strategy" 
            className="flex items-center gap-1 sm:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Strategy</span>
          </TabsTrigger>
          <TabsTrigger 
            value="hazards" 
            className="flex items-center gap-1 sm:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Hazards</span>
          </TabsTrigger>
          <TabsTrigger 
            value="recap" 
            className="flex items-center gap-1 sm:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Recap</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="behavior" className="mt-6 animate-in fade-in-50 duration-300">
          {behaviorContent}
        </TabsContent>
        
        <TabsContent value="strategy" className="mt-6 animate-in fade-in-50 duration-300">
          {strategyContent}
        </TabsContent>
        
        <TabsContent value="hazards" className="mt-6 animate-in fade-in-50 duration-300">
          {hazardsContent}
        </TabsContent>
        
        <TabsContent value="recap" className="mt-6 animate-in fade-in-50 duration-300">
          {recapContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
