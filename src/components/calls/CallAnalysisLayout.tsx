import { ReactNode, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  Monitor, 
  Clock,
  Mic,
  Target,
  Mail
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CallAnalysis, CallTranscript } from '@/api/aiCallAnalysis';
import type { BehaviorScore, StrategyAudit, CallMetadata } from '@/utils/analysis-schemas';

interface CallAnalysisLayoutProps {
  transcript: CallTranscript;
  analysis: CallAnalysis | null;
  behaviorContent: ReactNode;
  strategyContent: ReactNode;
  recapContent: ReactNode;
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
  recapContent,
}: CallAnalysisLayoutProps) {
  // Extract scores and metadata
  const behaviorData = analysis?.analysis_behavior as BehaviorScore | null;
  const strategyData = analysis?.analysis_strategy as StrategyAudit | null;
  const metadataData = analysis?.analysis_metadata as CallMetadata | null;
  
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
  const repName = transcript.rep_id ? 'Sales Rep' : 'Unknown Rep'; // Could be enhanced with actual rep lookup
  const prospectName = transcript.account_name || transcript.primary_stakeholder_name || 'Unknown Prospect';

  // If no analysis yet, show skeleton
  if (!analysis || !behaviorData || !strategyData) {
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
      {/* Hero Section */}
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6">
          <CardContent className="p-0">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              {/* Left: Names */}
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{prospectName}</h2>
                <p className="text-muted-foreground text-sm">Coaching Analysis</p>
              </div>
              
              {/* Center: Big Scores */}
              <div className="flex justify-center gap-8 lg:gap-12">
                <CircularScore score={behaviorScore} label="Behavior" />
                <CircularScore score={strategyScore} label="Strategy" />
              </div>
            </div>

            {/* Key Stats Row */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <StatCard 
                icon={<Monitor className="h-5 w-5" />}
                label="IT Users"
                value={stats.itUsers}
              />
              <StatCard 
                icon={<Users className="h-5 w-5" />}
                label="End Users"
                value={stats.endUsers}
              />
              <StatCard 
                icon={<Clock className="h-5 w-5" />}
                label="Duration"
                value={stats.duration}
              />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* Tabbed Interface */}
      <Tabs defaultValue="behavior" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="behavior" className="flex items-center gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">Behavior & Mechanics</span>
            <span className="sm:hidden">Behavior</span>
          </TabsTrigger>
          <TabsTrigger value="strategy" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Strategy & Threading</span>
            <span className="sm:hidden">Strategy</span>
          </TabsTrigger>
          <TabsTrigger value="recap" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Recap & Actions</span>
            <span className="sm:hidden">Recap</span>
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="behavior" className="mt-6">
          {behaviorContent}
        </TabsContent>
        
        <TabsContent value="strategy" className="mt-6">
          {strategyContent}
        </TabsContent>
        
        <TabsContent value="recap" className="mt-6">
          {recapContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
