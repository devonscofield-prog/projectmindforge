import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mic,
  Target,
  AlertTriangle,
  RefreshCw,
  Headphones,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';

import { CallAnalysisHero } from './CallAnalysisHero';
import { useCallAnalysisData } from './useCallAnalysisData';

interface CallAnalysisLayoutProps {
  transcript: CallTranscript;
  analysis: CallAnalysis | null;
  behaviorContent: ReactNode;
  strategyContent: ReactNode;
  hazardsContent: ReactNode;
  audioContent?: ReactNode;
  hasAudioAnalysis?: boolean;
  canEdit?: boolean;
  onEditUserCounts?: () => void;
  onReanalyze?: () => void;
  isReanalyzing?: boolean;
}

export function CallAnalysisLayout({
  transcript,
  analysis,
  behaviorContent,
  strategyContent,
  hazardsContent,
  audioContent,
  hasAudioAnalysis = false,
  canEdit = false,
  onEditUserCounts,
  onReanalyze,
  isReanalyzing = false,
}: CallAnalysisLayoutProps) {
  const {
    behaviorData,
    strategyData,
    psychologyData,
    callClassificationData,
    coachingData,
    parseError,
    behaviorScore,
    strategyScore,
    stats,
    summary,
    topics,
    participants,
  } = useCallAnalysisData(analysis);

  const prospectName = transcript.account_name || transcript.primary_stakeholder_name || 'Unknown Prospect';

  // Show error state if parsing failed completely
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

  return (
    <div className="space-y-6">
      <CallAnalysisHero
        prospectName={prospectName}
        analysis={analysis}
        behaviorData={behaviorData}
        strategyData={strategyData}
        psychologyData={psychologyData}
        callClassificationData={callClassificationData}
        coachingData={coachingData}
        behaviorScore={behaviorScore}
        strategyScore={strategyScore}
        stats={stats}
        summary={summary}
        topics={topics}
        participants={participants}
        canEdit={canEdit}
        onEditUserCounts={onEditUserCounts}
        onReanalyze={onReanalyze}
        isReanalyzing={isReanalyzing}
      />

      {/* Tabbed Interface */}
      <Tabs defaultValue="behavior" className="w-full">
        <TabsList className={cn(
          "grid w-full",
          hasAudioAnalysis ? "grid-cols-4" : "grid-cols-3",
        )}>
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
          {hasAudioAnalysis && (
            <TabsTrigger
              value="voice"
              className="flex items-center gap-1 sm:gap-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Headphones className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voice</span>
            </TabsTrigger>
          )}
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

        {hasAudioAnalysis && (
          <TabsContent value="voice" className="mt-6 animate-in fade-in-50 duration-300">
            {audioContent}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
