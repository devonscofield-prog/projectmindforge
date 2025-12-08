import { ReactNode, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Monitor, 
  Clock,
  Mic,
  Target,
  Mail,
  AlertTriangle,
  Pencil,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import { 
  BehaviorScoreSchema, 
  StrategyAuditSchema, 
  CallMetadataSchema,
  DealHeatSchema,
  PsychologyProfileSchema,
  CallClassificationSchema,
  type BehaviorScore, 
  type StrategyAudit, 
  type CallMetadata,
  type DealHeat,
  type PsychologyProfile,
  type CallClassification
} from '@/utils/analysis-schemas';
import { DealHeatCard } from './DealHeatCard';
import { ProspectPersonaCard } from './ProspectPersonaCard';

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
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold">{value}</p>
      </div>
    </div>
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
  const { behaviorData, strategyData, metadataData, dealHeatData, psychologyData, callClassificationData, parseError } = useMemo(() => {
    if (!analysis) {
      return { behaviorData: null, strategyData: null, metadataData: null, dealHeatData: null, psychologyData: null, callClassificationData: null, parseError: null };
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
    const duration = metadataData?.logistics?.duration_minutes 
      ? `${metadataData.logistics.duration_minutes} min` 
      : '-';
    
    return { itUsers, endUsers, duration };
  }, [metadataData]);

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
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          Why this classification? ({callClassificationData.detection_signals.length} signals)
                        </summary>
                        <ul className="mt-2 space-y-1 text-xs text-muted-foreground pl-4">
                          {callClassificationData.detection_signals.slice(0, 5).map((signal, idx) => (
                            <li key={idx} className="list-disc">
                              <span className="italic">"{signal}"</span>
                            </li>
                          ))}
                        </ul>
                      </details>
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
                {psychologyData && (
                  <ProspectPersonaCard psychology={psychologyData} />
                )}
              </div>
              
              {/* Right: Big Scores */}
              <div className="flex justify-center gap-8 lg:gap-12">
                {isLegacyAnalysis ? (
                  <div className="text-center p-4 border rounded-lg bg-muted/50">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      This call was analyzed with an older pipeline.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Re-run to get full insights.
                    </p>
                  </div>
                ) : (
                  <>
                    <CircularScore score={behaviorScore} label="Behavior" />
                    <CircularScore score={strategyScore} label="Strategy" />
                  </>
                )}
              </div>
            </div>

            {/* Key Stats Row */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="relative">
                <StatCard 
                  icon={<Monitor className="h-5 w-5" />}
                  label="IT Users"
                  value={stats.itUsers}
                />
                {canEdit && onEditUserCounts && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-60 hover:opacity-100"
                    onClick={onEditUserCounts}
                    aria-label="Edit user counts"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <StatCard 
                  icon={<Users className="h-5 w-5" />}
                  label="End Users"
                  value={stats.endUsers}
                />
                {canEdit && onEditUserCounts && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-60 hover:opacity-100"
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
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Behavior</span>
            <span className="sm:hidden">Behavior</span>
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Strategy</span>
            <span className="sm:hidden">Strategy</span>
          </TabsTrigger>
          <TabsTrigger value="hazards" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="hidden sm:inline">Deal Hazards</span>
            <span className="sm:hidden">Hazards</span>
          </TabsTrigger>
          <TabsTrigger value="recap" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Recap</span>
            <span className="sm:hidden">Recap</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="behavior" className="mt-6">
          {behaviorContent}
        </TabsContent>
        
        <TabsContent value="strategy" className="mt-6">
          {strategyContent}
        </TabsContent>
        
        <TabsContent value="hazards" className="mt-6">
          {hazardsContent}
        </TabsContent>
        
        <TabsContent value="recap" className="mt-6">
          {recapContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
