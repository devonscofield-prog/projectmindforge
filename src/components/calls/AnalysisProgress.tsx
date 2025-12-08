import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle2, Circle, Brain, Target, Fingerprint, Shield, Users, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AnalysisStep {
  id: string;
  label: string;
  agentName: string;
  icon: React.ReactNode;
  startTime: number; // When this step starts (ms)
}

const analysisSteps: AnalysisStep[] = [
  {
    id: 'metadata',
    label: 'Extracting Metadata & Facts',
    agentName: 'The Clerk',
    icon: <Users className="h-4 w-4" />,
    startTime: 0,
  },
  {
    id: 'behavior',
    label: 'Analyzing Behavioral Physics',
    agentName: 'The Referee',
    icon: <Target className="h-4 w-4" />,
    startTime: 3000,
  },
  {
    id: 'strategy',
    label: 'Mapping Strategy & Gaps',
    agentName: 'The Strategist & Skeptic',
    icon: <Brain className="h-4 w-4" />,
    startTime: 6000,
  },
  {
    id: 'competitors',
    label: 'Scanning Competitive Intel',
    agentName: 'The Spy',
    icon: <Shield className="h-4 w-4" />,
    startTime: 10000,
  },
  {
    id: 'psychology',
    label: 'Building Psychology Profile',
    agentName: 'The Profiler',
    icon: <Fingerprint className="h-4 w-4" />,
    startTime: 14000,
  },
  {
    id: 'coaching',
    label: 'Synthesizing Coaching Plan',
    agentName: 'The Coach',
    icon: <Sparkles className="h-4 w-4" />,
    startTime: 18000,
  },
];

interface AnalysisProgressProps {
  isComplete?: boolean;
}

type StepStatus = 'pending' | 'processing' | 'done';

export function AnalysisProgress({ isComplete = false }: AnalysisProgressProps) {
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(() => {
    // Initialize all steps
    const initial: Record<string, StepStatus> = {};
    analysisSteps.forEach((step, index) => {
      initial[step.id] = index === 0 ? 'processing' : 'pending';
    });
    return initial;
  });

  useEffect(() => {
    // If analysis is complete, mark all steps as done immediately
    if (isComplete) {
      const allDone: Record<string, StepStatus> = {};
      analysisSteps.forEach((step) => {
        allDone[step.id] = 'done';
      });
      setStepStatuses(allDone);
      return;
    }

    // Set up timers for each step transition
    const timers: NodeJS.Timeout[] = [];

    analysisSteps.forEach((step, index) => {
      // Timer to start processing this step
      if (step.startTime > 0) {
        const startTimer = setTimeout(() => {
          setStepStatuses((prev) => ({
            ...prev,
            [step.id]: 'processing',
          }));
        }, step.startTime);
        timers.push(startTimer);
      }

      // Timer to mark previous step as done (when this step starts)
      if (index > 0) {
        const prevStep = analysisSteps[index - 1];
        const doneTimer = setTimeout(() => {
          setStepStatuses((prev) => ({
            ...prev,
            [prevStep.id]: 'done',
          }));
        }, step.startTime);
        timers.push(doneTimer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [isComplete]);

  const getStatusIcon = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'processing':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />;
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/40" />;
    }
  };

  const getStatusStyles = (status: StepStatus) => {
    switch (status) {
      case 'done':
        return 'text-green-600 dark:text-green-400';
      case 'processing':
        return 'text-primary font-medium';
      default:
        return 'text-muted-foreground/60';
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardContent className="py-8">
        <div className="flex flex-col items-center space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <Brain className="h-6 w-6 text-primary animate-pulse" />
              <h3 className="text-xl font-semibold">Analyzing Call...</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Our AI agents are reviewing your conversation
            </p>
          </div>

          {/* Steps List */}
          <div className="w-full max-w-md space-y-3">
            {analysisSteps.map((step, index) => {
              const status = stepStatuses[step.id];
              return (
                <div
                  key={step.id}
                  className={cn(
                    'flex items-center gap-4 p-3 rounded-lg transition-all duration-300',
                    status === 'processing' && 'bg-primary/5 border border-primary/20',
                    status === 'done' && 'bg-green-500/5',
                  )}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0">
                    {getStatusIcon(status)}
                  </div>

                  {/* Step Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm transition-colors', getStatusStyles(status))}>
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground/70">
                      {step.agentName}
                    </p>
                  </div>

                  {/* Agent Icon */}
                  <div className={cn(
                    'flex-shrink-0 p-1.5 rounded-full transition-colors',
                    status === 'processing' && 'bg-primary/10 text-primary',
                    status === 'done' && 'bg-green-500/10 text-green-500',
                    status === 'pending' && 'text-muted-foreground/40',
                  )}>
                    {step.icon}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <p className="text-xs text-muted-foreground text-center">
            This usually takes 20-30 seconds
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
