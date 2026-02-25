import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  HelpCircle,
  Mic,
  Timer,
  ChevronRight,
  ArrowLeftRight
} from 'lucide-react';
import type { BehaviorScore } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

import { TalkRatioBar } from './TalkRatioBar';
import { GaugeBar } from './GaugeBar';
import { MonologueAlert } from './MonologueAlert';
import { QuestionLeverageSheet } from './QuestionLeverageSheet';
import { PatienceDetailSheet } from './PatienceDetailSheet';
import { NextStepsSection } from './NextStepsSection';

interface BehaviorScorecardProps {
  data: BehaviorScore | null | undefined;
  onSeekToTimestamp?: (timestamp: string) => void;
}

export function BehaviorScorecard({ data, onSeekToTimestamp: _onSeekToTimestamp }: BehaviorScorecardProps) {
  const [questionsSheetOpen, setQuestionsSheetOpen] = useState(false);
  const [patienceSheetOpen, setPatienceSheetOpen] = useState(false);

  // Loading skeleton state
  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Behavioral Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const { metrics } = data;

  // Safe accessors with fallbacks for legacy data compatibility
  const avgQuestionLength = metrics.question_quality?.average_question_length ?? 0;
  const avgAnswerLength = metrics.question_quality?.average_answer_length ?? 0;
  const highLeverageCount = metrics.question_quality?.high_leverage_count ?? 0;
  const lowLeverageCount = metrics.question_quality?.low_leverage_count ?? 0;
  const highLeverageExamples = metrics.question_quality?.high_leverage_examples ?? [];
  const lowLeverageExamples = metrics.question_quality?.low_leverage_examples ?? [];

  // Detect legacy data (pre-leverage fields)
  const questionQualityExtra = metrics.question_quality as typeof metrics.question_quality & { open_ended_count?: number; closed_count?: number };
  const isLegacyData = questionQualityExtra.open_ended_count !== undefined;

  // Fix division by zero with Math.max(..., 1)
  const maxLength = Math.max(avgQuestionLength, avgAnswerLength, 1);

  // Calculate leverage ratio safely
  const leverageRatio = avgQuestionLength > 0
    ? (avgAnswerLength / avgQuestionLength).toFixed(1)
    : '0';
  const totalQuestions = highLeverageCount + lowLeverageCount;
  void (totalQuestions > 0
    ? Math.round((highLeverageCount / totalQuestions) * 100)
    : 0);

  return (
    <div className="space-y-6">
      {/* Monologue Alert - Critical Warning at Top */}
      {metrics.monologue.violation_count > 0 && (
        <MonologueAlert
          violationCount={metrics.monologue.violation_count}
          longestTurnWords={metrics.monologue.longest_turn_word_count}
        />
      )}

      {/* Talk Ratio - Hero Visual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Talk vs Listen Ratio
            </div>
            <span className="text-sm font-bold">{metrics.talk_listen_ratio.score}/15</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalkRatioBar repPercentage={metrics.talk_listen_ratio.rep_talk_percentage} />
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Patience - Clickable */}
        <Card
          className="cursor-pointer transition-colors hover:bg-accent/50"
          onClick={() => setPatienceSheetOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setPatienceSheetOpen(true);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="View patience details"
        >
          <CardContent className="pt-6">
            <GaugeBar
              value={metrics.patience.score}
              max={30}
              label="Acknowledgment"
              sublabel={`${metrics.patience.missed_acknowledgment_count} missed acknowledgment${metrics.patience.missed_acknowledgment_count !== 1 ? 's' : ''}`}
              icon={<Timer className="h-4 w-4" />}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronRight className="h-3 w-3" aria-hidden="true" />
                Click to view details
              </span>
              <Badge
                variant="secondary"
                className={cn(
                  metrics.patience.status === 'Excellent' ? 'bg-green-500/20 text-green-700' :
                  metrics.patience.status === 'Good' ? 'bg-green-400/20 text-green-600' :
                  metrics.patience.status === 'Fair' ? 'bg-yellow-500/20 text-yellow-700' :
                  'bg-orange-500/20 text-orange-700'
                )}
              >
                {metrics.patience.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Questions - Conversation Yield Chart */}
        <Card
          className="cursor-pointer transition-colors hover:bg-accent/50"
          onClick={() => setQuestionsSheetOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setQuestionsSheetOpen(true);
            }
          }}
          tabIndex={0}
          role="button"
          aria-label="View question leverage details"
        >
          <CardContent className="pt-6">
            {/* Header with Score */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Question Leverage</span>
              </div>
              <span className="text-sm font-bold">{metrics.question_quality.score}/20</span>
            </div>

            {/* Conditional Rendering: Legacy vs New Leverage Chart */}
            {isLegacyData ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{questionQualityExtra.open_ended_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Open-ended</p>
                  </div>
                  <div className="text-muted-foreground">/</div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">{questionQualityExtra.closed_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Closed</p>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground italic">Legacy analysis data</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Prominent Yield Ratio */}
                <div className="flex flex-col items-center justify-center py-2">
                  <div
                    className={cn(
                      "text-4xl font-bold tabular-nums",
                      parseFloat(leverageRatio) >= 2 ? "text-green-600" :
                      parseFloat(leverageRatio) >= 1 ? "text-yellow-600" :
                      "text-orange-600"
                    )}
                  >
                    {leverageRatio}x
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Yield Ratio</p>
                </div>

                {/* Simplified Bar Visualization */}
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Your Question</span>
                      <span>{avgQuestionLength} words</span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-muted-foreground/60 rounded-full transition-all"
                        style={{ width: `${Math.min((avgQuestionLength / maxLength) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Their Answer</span>
                      <span>{avgAnswerLength} words</span>
                    </div>
                    <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          avgAnswerLength < avgQuestionLength ? "bg-orange-500" : "bg-green-500"
                        )}
                        style={{ width: `${Math.min((avgAnswerLength / maxLength) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {highLeverageCount > 0 && (
                  <p className="text-xs text-center text-muted-foreground">
                    <span className="text-green-600 font-medium">{highLeverageCount}</span> great question{highLeverageCount !== 1 ? 's' : ''} identified
                  </p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 flex items-center justify-between pt-3 border-t border-border/50">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs",
                  isLegacyData ? 'bg-muted text-muted-foreground' :
                  parseFloat(leverageRatio) >= 2 ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                  parseFloat(leverageRatio) >= 1 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                  'bg-orange-500/20 text-orange-700 dark:text-orange-400'
                )}
              >
                {isLegacyData ? 'Legacy Data' :
                  parseFloat(leverageRatio) >= 2 ? 'Good Yield' :
                  parseFloat(leverageRatio) >= 1 ? 'Fair Yield' : 'Low Yield'}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                View details
                <ChevronRight className="h-3 w-3" />
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Interactivity - Turn-Taking Score */}
        {metrics.interactivity && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Interactivity</span>
                </div>
                <span className="text-sm font-bold">{metrics.interactivity.score}/15</span>
              </div>

              <div className="flex flex-col items-center py-2">
                <div
                  className={cn(
                    "text-3xl font-bold tabular-nums",
                    metrics.interactivity.turns_per_minute >= 8 ? "text-green-600" :
                    metrics.interactivity.turns_per_minute >= 5 ? "text-green-500" :
                    metrics.interactivity.turns_per_minute >= 3 ? "text-yellow-600" :
                    "text-orange-600"
                  )}
                >
                  {metrics.interactivity.turns_per_minute.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">turns/min</p>
              </div>

              <div className="flex justify-between text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                <span>{metrics.interactivity.total_turns} total turns</span>
                <span>~{metrics.interactivity.avg_turn_length_words} words/turn</span>
              </div>

              <div className="mt-3 flex justify-end">
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs",
                    metrics.interactivity.status === 'Excellent' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                    metrics.interactivity.status === 'Good' ? 'bg-green-400/20 text-green-600 dark:text-green-400' :
                    metrics.interactivity.status === 'Fair' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                    'bg-orange-500/20 text-orange-700 dark:text-orange-400'
                  )}
                >
                  {metrics.interactivity.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <QuestionLeverageSheet
        open={questionsSheetOpen}
        onOpenChange={setQuestionsSheetOpen}
        explanation={metrics.question_quality.explanation}
        leverageRatio={leverageRatio}
        avgQuestionLength={avgQuestionLength}
        avgAnswerLength={avgAnswerLength}
        highLeverageCount={highLeverageCount}
        lowLeverageCount={lowLeverageCount}
        highLeverageExamples={highLeverageExamples}
        lowLeverageExamples={lowLeverageExamples}
      />

      <PatienceDetailSheet
        open={patienceSheetOpen}
        onOpenChange={setPatienceSheetOpen}
        patience={metrics.patience}
      />

      <NextStepsSection nextSteps={metrics.next_steps} />
    </div>
  );
}
