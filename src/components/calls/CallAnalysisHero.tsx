import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Users,
  Monitor,
  Clock,
  AlertTriangle,
  Pencil,
  RefreshCw,
  Video,
  VideoOff,
  FileText,
  Tag,
  History,
  UserCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { CallAnalysis } from '@/api/aiCallAnalysis';
import type { BehaviorScore, StrategyAudit, PsychologyProfile, CallClassification, CoachingSynthesis } from '@/utils/analysis-schemas';

import { CircularScore } from './CircularScore';
import { StatCard } from './StatCard';
import { ParticipantBadge } from './ParticipantBadge';
import { DetectionSignalsCollapsible } from './DetectionSignalsCollapsible';
import { ProspectPersonaCard } from './ProspectPersonaCard';

interface CallAnalysisHeroProps {
  prospectName: string;
  analysis: CallAnalysis;
  behaviorData: BehaviorScore | null;
  strategyData: StrategyAudit | null;
  psychologyData: PsychologyProfile | null;
  callClassificationData: CallClassification | null;
  coachingData: CoachingSynthesis | null;
  behaviorScore: number;
  strategyScore: number;
  stats: {
    itUsers: string | number;
    endUsers: string | number;
    sourceQuote: string | null;
    duration: string;
    platform: string | null;
    videoOn: boolean | null;
  };
  summary: string | null;
  topics: string[];
  participants: Array<{
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  }>;
  canEdit: boolean;
  onEditUserCounts?: () => void;
  onReanalyze?: () => void;
  isReanalyzing: boolean;
}

export function CallAnalysisHero({
  prospectName,
  analysis,
  behaviorData,
  strategyData,
  psychologyData,
  callClassificationData,
  coachingData,
  behaviorScore,
  strategyScore,
  stats,
  summary,
  topics,
  participants,
  canEdit,
  onEditUserCounts,
  onReanalyze,
  isReanalyzing,
}: CallAnalysisHeroProps) {
  const isLegacyAnalysis = !behaviorData || !strategyData;

  return (
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

              <ProspectPersonaCard psychology={psychologyData} />
            </div>

            {/* Right: Coach Grade + Big Scores */}
            <div className="grid grid-cols-2 gap-4 sm:flex sm:flex-row sm:items-center sm:justify-center sm:gap-8 lg:gap-12">
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

          {/* Call Summary */}
          {summary && (
            <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Call Summary</span>
              </div>
              <p className="text-sm text-foreground/90 leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Key Topics */}
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
  );
}
