import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Timer, 
  HelpCircle,
  Mic,
  ListChecks,
  Sparkles,
  Play
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

  const { overall_score, grade, metrics, coaching_tip } = data;
  const isPassing = grade === 'Pass';

  // Calculate question ratio
  const totalQuestions = metrics.question_quality.open_ended_count + metrics.question_quality.closed_count;
  const openRatio = totalQuestions > 0 
    ? Math.round((metrics.question_quality.open_ended_count / totalQuestions) * 100)
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
          <CardTitle className="text-base flex items-center gap-2">
            <Mic className="h-4 w-4" />
            Talk vs Listen Ratio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TalkRatioBar repPercentage={metrics.talk_listen_ratio.rep_talk_percentage} />
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Patience */}
        <Card>
          <CardContent className="pt-6">
            <GaugeBar 
              value={metrics.patience.score}
              max={30}
              label="Patience"
              sublabel={`${metrics.patience.interruption_count} interruption${metrics.patience.interruption_count !== 1 ? 's' : ''} detected`}
              icon={<Timer className="h-4 w-4" />}
            />
            <div className="mt-2 flex justify-end">
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

        {/* Questions */}
        <Card>
          <CardContent className="pt-6">
            <GaugeBar 
              value={metrics.question_quality.score}
              max={20}
              label="Question Quality"
              sublabel={`${metrics.question_quality.open_ended_count} open • ${metrics.question_quality.closed_count} closed`}
              icon={<HelpCircle className="h-4 w-4" />}
            />
            <div className="mt-2 flex justify-end">
              <Badge 
                variant="secondary"
                className={cn(
                  openRatio >= 60 ? 'bg-green-500/20 text-green-700' :
                  openRatio >= 40 ? 'bg-yellow-500/20 text-yellow-700' : 
                  'bg-orange-500/20 text-orange-700'
                )}
              >
                {openRatio}% Open-Ended
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps - Compact */}
      <Card>
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
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {metrics.next_steps.details || (metrics.next_steps.secured ? 'Commitment secured' : 'No clear next steps')}
                </p>
              </div>
            </div>
            <Badge variant={metrics.next_steps.secured ? 'default' : 'destructive'}>
              {metrics.next_steps.secured ? 'Secured' : 'Missing'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Coaching Corner - Distinct "Quote of the Day" Style */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-6 border border-primary/20">
        <div className="absolute top-0 right-0 opacity-10">
          <Sparkles className="h-24 w-24 text-primary" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <h4 className="font-semibold text-primary">Coach's Corner</h4>
          </div>
          <blockquote className="text-base italic text-foreground/90 leading-relaxed">
            "{coaching_tip}"
          </blockquote>
        </div>
      </div>
    </div>
  );
}
