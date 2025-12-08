import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Timer, 
  HelpCircle,
  Mic,
  ListChecks,
  Sparkles,
  Play,
  ChevronRight
} from 'lucide-react';
import type { BehaviorScore } from '@/utils/analysis-schemas';
import { cn } from '@/lib/utils';

interface BehaviorScorecardProps {
  data: BehaviorScore | null | undefined;
  onSeekToTimestamp?: (timestamp: string) => void;
}

// Stacked Bar Chart for Talk Ratio
function TalkRatioBar({ repPercentage }: { repPercentage: number }) {
  const prospectPercentage = 100 - repPercentage;
  const isIdeal = repPercentage >= 40 && repPercentage <= 60;
  
  return (
    <div className="space-y-2">
      {/* Labels */}
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">Rep: {repPercentage}%</span>
        <span className="text-muted-foreground">Prospect: {prospectPercentage}%</span>
      </div>
      
      {/* Stacked Bar */}
      <div className="relative h-6 w-full rounded-full bg-secondary overflow-hidden">
        {/* Rep portion */}
        <div 
          className={cn(
            "absolute left-0 top-0 h-full transition-all",
            repPercentage > 60 ? "bg-orange-500" : repPercentage < 40 ? "bg-yellow-500" : "bg-primary"
          )}
          style={{ width: `${repPercentage}%` }}
        />
        {/* Prospect portion */}
        <div 
          className="absolute right-0 top-0 h-full bg-green-500/80"
          style={{ width: `${prospectPercentage}%` }}
        />
        
        {/* Ideal Range Markers (40-60%) */}
        <div 
          className="absolute top-0 h-full border-l-2 border-dashed border-foreground/50"
          style={{ left: '40%' }}
        />
        <div 
          className="absolute top-0 h-full border-l-2 border-dashed border-foreground/50"
          style={{ left: '60%' }}
        />
      </div>
      
      {/* Ideal Range Label */}
      <div className="flex justify-center">
        <Badge variant={isIdeal ? "default" : "secondary"} className={cn(
          "text-xs",
          isIdeal && "bg-green-500 hover:bg-green-600"
        )}>
          {isIdeal ? "✓ Ideal Range" : "Target: 40-60%"}
        </Badge>
      </div>
    </div>
  );
}

// Gauge-style Progress Bar
interface GaugeBarProps {
  value: number;
  max: number;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  colorThresholds?: { good: number; fair: number };
}

function GaugeBar({ value, max, label, sublabel, icon, colorThresholds }: GaugeBarProps) {
  const percentage = Math.min((value / max) * 100, 100);
  const thresholds = colorThresholds ?? { good: 70, fair: 40 };
  
  const getColor = () => {
    if (percentage >= thresholds.good) return 'bg-green-500';
    if (percentage >= thresholds.fair) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="text-muted-foreground">{icon}</div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className="text-sm font-bold">{value}/{max}</span>
      </div>
      
      {/* Progress Bar */}
      <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all", getColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      {sublabel && (
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      )}
    </div>
  );
}

// Interactive Monologue Alert
interface MonologueAlertProps {
  violationCount: number;
  longestTurnWords: number;
  onSeekToTimestamp?: (timestamp: string) => void;
}

function MonologueAlert({ violationCount, longestTurnWords, onSeekToTimestamp }: MonologueAlertProps) {
  // Estimate timestamp (in real implementation, this would come from analysis data)
  const estimatedTimestamp = "21:01"; // Placeholder - would come from actual data
  
  return (
    <div className="rounded-lg border border-orange-500/50 bg-orange-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-semibold text-orange-700 dark:text-orange-400">
              Monologue Warning
            </h4>
            <p className="text-sm text-orange-600 dark:text-orange-300">
              {violationCount} monologue{violationCount > 1 ? 's' : ''} detected • 
              Longest turn: {longestTurnWords} words
            </p>
          </div>
        </div>
        
        {onSeekToTimestamp && (
          <Button 
            variant="outline" 
            size="sm"
            className="border-orange-500/50 text-orange-600 hover:bg-orange-500/20"
            onClick={() => onSeekToTimestamp(estimatedTimestamp)}
          >
            <Play className="h-4 w-4 mr-2" />
            Jump to {estimatedTimestamp}
          </Button>
        )}
      </div>
    </div>
  );
}

export function BehaviorScorecard({ data, onSeekToTimestamp }: BehaviorScorecardProps) {
  const [questionsSheetOpen, setQuestionsSheetOpen] = useState(false);
  const [nextStepsSheetOpen, setNextStepsSheetOpen] = useState(false);
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

  const { overall_score, grade, metrics } = data;
  const isPassing = grade === 'Pass';

  // Safe accessors with fallbacks for legacy data compatibility
  const avgQuestionLength = metrics.question_quality?.average_question_length ?? 0;
  const avgAnswerLength = metrics.question_quality?.average_answer_length ?? 0;
  const highLeverageCount = metrics.question_quality?.high_leverage_count ?? 0;
  const lowLeverageCount = metrics.question_quality?.low_leverage_count ?? 0;

  // Detect legacy data (pre-leverage fields)
  const isLegacyData = (metrics.question_quality as any)?.open_ended_count !== undefined;

  // Fix division by zero with Math.max(..., 1)
  const maxLength = Math.max(avgQuestionLength, avgAnswerLength, 1);

  // Calculate leverage ratio safely
  const leverageRatio = avgQuestionLength > 0 
    ? (avgAnswerLength / avgQuestionLength).toFixed(1)
    : '0';
  const totalQuestions = highLeverageCount + lowLeverageCount;
  const highLeveragePercent = totalQuestions > 0 
    ? Math.round((highLeverageCount / totalQuestions) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Monologue Alert - Critical Warning at Top */}
      {metrics.monologue.violation_count > 0 && (
        <MonologueAlert 
          violationCount={metrics.monologue.violation_count}
          longestTurnWords={metrics.monologue.longest_turn_word_count}
          onSeekToTimestamp={onSeekToTimestamp}
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
        >
          <CardContent className="pt-6">
            <GaugeBar 
              value={metrics.patience.score}
              max={30}
              label="Patience"
              sublabel={`${metrics.patience.interruption_count} interruption${metrics.patience.interruption_count !== 1 ? 's' : ''} detected`}
              icon={<Timer className="h-4 w-4" />}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
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
        >
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Question Leverage</span>
              </div>
              <span className="text-sm font-bold">{metrics.question_quality.score}/20</span>
            </div>
            
            {/* Conditional Rendering: Legacy vs New Leverage Chart */}
            {isLegacyData ? (
              /* Legacy Data: Show Open vs Closed summary */
              <div className="space-y-3">
                <div className="flex items-center justify-center gap-4 py-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{(metrics.question_quality as any).open_ended_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Open-ended</p>
                  </div>
                  <div className="text-muted-foreground">/</div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-500">{(metrics.question_quality as any).closed_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Closed</p>
                  </div>
                </div>
                <p className="text-xs text-center text-muted-foreground italic">Legacy analysis data</p>
              </div>
            ) : (
              /* New Data: Show Conversation Yield Chart */
              <div className="space-y-3">
                {/* Yield Ratio Label */}
                <div 
                  className="flex items-center justify-center gap-2"
                  title={`For every 1 word you asked, the prospect spoke ${leverageRatio} words.`}
                >
                  <span className="text-2xl font-bold">1 : {leverageRatio}</span>
                  <span className="text-sm text-muted-foreground">Yield</span>
                </div>
                
                {/* Horizontal Bars */}
                <div className="space-y-2">
                  {/* Question Bar (Gray) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Avg Q</span>
                    <div className="flex-1 h-5 bg-secondary rounded overflow-hidden">
                      <div 
                        className="h-full bg-muted-foreground/50 rounded transition-all"
                        style={{ 
                          width: `${Math.min((avgQuestionLength / maxLength) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{avgQuestionLength}w</span>
                  </div>
                  
                  {/* Answer Bar (Conditional Color) */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-16 shrink-0">Avg A</span>
                    <div className="flex-1 h-5 bg-secondary rounded overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded transition-all",
                          avgAnswerLength < avgQuestionLength 
                            ? "bg-orange-500" 
                            : "bg-green-500"
                        )}
                        style={{ 
                          width: `${Math.min((avgAnswerLength / maxLength) * 100, 100)}%` 
                        }}
                      />
                    </div>
                    <span className="text-xs font-medium w-12 text-right">{avgAnswerLength}w</span>
                  </div>
                </div>
              </div>
            )}
            
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                Click for details
              </span>
              <Badge 
                variant="secondary"
                className={cn(
                  isLegacyData ? 'bg-muted text-muted-foreground' :
                  parseFloat(leverageRatio) >= 2 ? 'bg-green-500/20 text-green-700' :
                  parseFloat(leverageRatio) >= 1 ? 'bg-yellow-500/20 text-yellow-700' : 
                  'bg-orange-500/20 text-orange-700'
                )}
              >
                {isLegacyData ? 'Legacy Data' : 
                  parseFloat(leverageRatio) >= 2 ? 'Good Yield' : 
                  parseFloat(leverageRatio) >= 1 ? 'Fair Yield' : 'Low Yield'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Questions Detail Sheet */}
      <Sheet open={questionsSheetOpen} onOpenChange={setQuestionsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Question Leverage Breakdown
            </SheetTitle>
            <SheetDescription>
              {metrics.question_quality.explanation}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Leverage Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Avg Question Length</p>
                <p className="text-2xl font-bold">{avgQuestionLength} <span className="text-sm font-normal text-muted-foreground">words</span></p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground">Avg Answer Length</p>
                <p className="text-2xl font-bold">{avgAnswerLength} <span className="text-sm font-normal text-muted-foreground">words</span></p>
              </div>
            </div>

            {/* Leverage Ratio */}
            <div className="p-4 rounded-lg border bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium">Leverage Ratio</span>
                <Badge className={cn(
                  "text-lg px-3",
                  parseFloat(leverageRatio) >= 3 ? "bg-green-500" :
                  parseFloat(leverageRatio) >= 2 ? "bg-yellow-500" :
                  "bg-orange-500"
                )}>
                  {leverageRatio}x
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                For every word you ask, the prospect speaks {leverageRatio} words. Higher is better!
              </p>
            </div>

            {/* High vs Low Leverage */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Question Impact</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-medium text-green-700 dark:text-green-400">
                    {highLeverageCount} High-Leverage Questions
                  </p>
                  <p className="text-xs text-muted-foreground">Triggered detailed, long responses</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                <XCircle className="h-5 w-5 text-orange-600 shrink-0" />
                <div>
                  <p className="font-medium text-orange-700 dark:text-orange-400">
                    {lowLeverageCount} Low-Leverage Questions
                  </p>
                  <p className="text-xs text-muted-foreground">Received 1-word or brief answers</p>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Patience Detail Sheet */}
      <Sheet open={patienceSheetOpen} onOpenChange={setPatienceSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              Patience Breakdown
            </SheetTitle>
            <SheetDescription>
              {metrics.patience.interruption_count === 0 
                ? 'No interruptions detected - excellent listening skills!'
                : `${metrics.patience.interruption_count} interruption${metrics.patience.interruption_count !== 1 ? 's' : ''} detected during the call`}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                metrics.patience.status === 'Excellent' ? "bg-green-500/20 text-green-600" :
                metrics.patience.status === 'Good' ? "bg-green-400/20 text-green-600" :
                metrics.patience.status === 'Fair' ? "bg-yellow-500/20 text-yellow-600" :
                "bg-orange-500/20 text-orange-600"
              )}>
                {metrics.patience.status === 'Excellent' || metrics.patience.status === 'Good' ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <AlertTriangle className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="font-semibold">{metrics.patience.status}</p>
                <p className="text-sm text-muted-foreground">
                  Score: {metrics.patience.score}/30
                </p>
              </div>
            </div>

            {/* Interruptions List */}
            {metrics.patience.interruptions && metrics.patience.interruptions.length > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-sm text-muted-foreground">Interruption Details</h4>
                <div className="space-y-3">
                  {metrics.patience.interruptions.map((interruption, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "p-3 rounded-lg border",
                        interruption.severity === 'Severe' ? "border-destructive/50 bg-destructive/5" :
                        interruption.severity === 'Moderate' ? "border-orange-500/50 bg-orange-500/5" :
                        "border-yellow-500/50 bg-yellow-500/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{interruption.interrupter}</span>
                          <span className="text-muted-foreground">interrupted</span>
                          <span className="font-medium">{interruption.interrupted_speaker}</span>
                        </div>
                        <Badge 
                          variant="secondary"
                          className={cn(
                            "text-xs shrink-0",
                            interruption.severity === 'Severe' ? "bg-destructive/20 text-destructive" :
                            interruption.severity === 'Moderate' ? "bg-orange-500/20 text-orange-700" :
                            "bg-yellow-500/20 text-yellow-700"
                          )}
                        >
                          {interruption.severity}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{interruption.context}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : metrics.patience.interruption_count > 0 ? (
              <p className="text-sm text-muted-foreground italic">
                Interruption details not available for this analysis
              </p>
            ) : null}

            {/* Tips for improvement if interruptions detected */}
            {metrics.patience.interruption_count > 0 && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Improvement Tips
                </h4>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Wait 2 full seconds after the prospect finishes before responding
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Take notes while they speak to stay engaged without interrupting
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    If you must interject, acknowledge what they were saying first
                  </li>
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Next Steps - Clickable */}
      <Card 
        className="cursor-pointer transition-colors hover:bg-accent/50"
        onClick={() => setNextStepsSheetOpen(true)}
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                metrics.next_steps.secured 
                  ? "bg-green-500/20 text-green-600" 
                  : "bg-destructive/20 text-destructive"
              )}>
                {metrics.next_steps.secured ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Next Steps</span>
                  <span className="text-sm font-bold text-muted-foreground">{metrics.next_steps.score}/15</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {metrics.next_steps.details || (metrics.next_steps.secured ? 'Commitment secured' : 'No clear next steps')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={metrics.next_steps.secured ? 'default' : 'destructive'}>
                {metrics.next_steps.secured ? 'Secured' : 'Missing'}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps Detail Sheet */}
      <Sheet open={nextStepsSheetOpen} onOpenChange={setNextStepsSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Next Steps Details
            </SheetTitle>
            <SheetDescription>
              {metrics.next_steps.secured 
                ? 'A clear commitment was secured during this call'
                : 'No clear next steps were established'}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                metrics.next_steps.secured 
                  ? "bg-green-500/20 text-green-600" 
                  : "bg-destructive/20 text-destructive"
              )}>
                {metrics.next_steps.secured ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {metrics.next_steps.secured ? 'Commitment Secured' : 'No Commitment'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: {metrics.next_steps.score}/15
                </p>
              </div>
            </div>

            {/* Details */}
            {metrics.next_steps.details && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Details</h4>
                <p className="text-foreground leading-relaxed">
                  {metrics.next_steps.details}
                </p>
              </div>
            )}

            {/* Tips for improvement if not secured */}
            {!metrics.next_steps.secured && (
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Improvement Tips
                </h4>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Always confirm a specific date and time for the next meeting
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Get verbal commitment: "Does that time work for you?"
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Define what will happen in the next call
                  </li>
                  <li className="flex gap-2">
                    <span className="text-primary">•</span>
                    Assign any action items before ending the call
                  </li>
                </ul>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}
