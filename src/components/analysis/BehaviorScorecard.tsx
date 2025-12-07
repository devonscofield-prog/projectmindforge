import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  MessageSquare, 
  Timer, 
  HelpCircle,
  Mic,
  ListChecks,
  Lightbulb
} from 'lucide-react';
import type { BehaviorScore } from '@/utils/analysis-schemas';

interface BehaviorScorecardProps {
  data: BehaviorScore | null | undefined;
}

export function BehaviorScorecard({ data }: BehaviorScorecardProps) {
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
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { overall_score, grade, metrics, coaching_tip } = data;
  const isPassing = grade === 'Pass';

  // Calculate question ratio
  const totalQuestions = metrics.question_quality.open_ended_count + metrics.question_quality.closed_count;
  const openRatio = totalQuestions > 0 
    ? Math.round((metrics.question_quality.open_ended_count / totalQuestions) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="h-5 w-5" />
          Behavioral Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header Section - Overall Score */}
        <div className="flex items-center gap-6">
          <div className="relative">
            <div 
              className={`flex h-20 w-20 items-center justify-center rounded-full border-4 ${
                isPassing ? 'border-green-500 bg-green-500/10' : 'border-destructive bg-destructive/10'
              }`}
            >
              <span className={`text-2xl font-bold ${isPassing ? 'text-green-600' : 'text-destructive'}`}>
                {overall_score}
              </span>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">Overall Score</span>
              <Badge 
                variant={isPassing ? 'default' : 'destructive'}
                className={isPassing ? 'bg-green-500 hover:bg-green-600' : ''}
              >
                {grade}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {isPassing 
                ? 'Good conversational dynamics' 
                : 'Needs improvement in key areas'}
            </p>
          </div>
        </div>

        {/* Monologue Alert - Critical Warning */}
        {metrics.monologue.violation_count > 0 && (
          <Alert variant="destructive" className="border-orange-500 bg-orange-500/10">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-orange-700 dark:text-orange-400">
              Monologue Warning
            </AlertTitle>
            <AlertDescription className="text-orange-600 dark:text-orange-300">
              ⚠️ {metrics.monologue.violation_count} monologue{metrics.monologue.violation_count > 1 ? 's' : ''} detected. 
              Longest turn was {metrics.monologue.longest_turn_word_count} words.
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {/* Patience */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Timer className="h-4 w-4" />
              Patience
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.patience.score}</span>
              <span className="text-sm text-muted-foreground">/ 30</span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              <Badge 
                variant={metrics.patience.status === 'Excellent' || metrics.patience.status === 'Good' ? 'default' : 'secondary'}
                className={
                  metrics.patience.status === 'Excellent' ? 'bg-green-500' :
                  metrics.patience.status === 'Good' ? 'bg-green-400' :
                  metrics.patience.status === 'Fair' ? 'bg-yellow-500' : 'bg-orange-500'
                }
              >
                {metrics.patience.status}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {metrics.patience.interruption_count} interruption{metrics.patience.interruption_count !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Question Quality */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <HelpCircle className="h-4 w-4" />
              Questions
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.question_quality.score}</span>
              <span className="text-sm text-muted-foreground">/ 20</span>
            </div>
            <div className="mt-1">
              <span className="text-xs font-medium text-green-600">
                {openRatio}% open-ended
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {metrics.question_quality.open_ended_count} open / {metrics.question_quality.closed_count} closed
            </p>
          </div>

          {/* Talk Ratio */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Talk Ratio
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.talk_listen_ratio.score}</span>
              <span className="text-sm text-muted-foreground">/ 15</span>
            </div>
            <div className="mt-1">
              <span className={`text-xs font-medium ${
                metrics.talk_listen_ratio.rep_talk_percentage <= 40 ? 'text-green-600' :
                metrics.talk_listen_ratio.rep_talk_percentage <= 60 ? 'text-yellow-600' : 'text-orange-600'
              }`}>
                Rep: {metrics.talk_listen_ratio.rep_talk_percentage}%
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Prospect: {100 - metrics.talk_listen_ratio.rep_talk_percentage}%
            </p>
          </div>

          {/* Next Steps */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ListChecks className="h-4 w-4" />
              Next Steps
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold">{metrics.next_steps.score}</span>
              <span className="text-sm text-muted-foreground">/ 15</span>
            </div>
            <div className="mt-1 flex items-center gap-1">
              {metrics.next_steps.secured ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              <span className={`text-xs font-medium ${
                metrics.next_steps.secured ? 'text-green-600' : 'text-destructive'
              }`}>
                {metrics.next_steps.secured ? 'Secured' : 'Missing'}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
              {metrics.next_steps.details}
            </p>
          </div>
        </div>

        {/* Coaching Tip */}
        <div className="rounded-lg border-l-4 border-primary bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <Lightbulb className="h-5 w-5 text-primary mt-0.5 shrink-0" />
            <div>
              <h4 className="font-medium text-primary">Coach's Corner</h4>
              <p className="mt-1 text-sm text-muted-foreground">{coaching_tip}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
