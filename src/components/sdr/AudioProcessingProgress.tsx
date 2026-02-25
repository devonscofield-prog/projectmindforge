import { useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Upload,
  Mic,
  Brain,
  CheckCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAudioProcessingStatus } from '@/hooks/sdr/useAudioProcessingStatus';

interface AudioProcessingProgressProps {
  transcriptId: string;
  pipeline: 'full_cycle' | 'sdr';
  onComplete?: () => void;
  /** Optional retry handler. If not provided, falls back to page reload. */
  onRetry?: () => void;
}

type StepStatus = 'pending' | 'active' | 'complete';

interface ProcessingStep {
  id: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
}

const steps: ProcessingStep[] = [
  {
    id: 'uploading',
    label: 'Uploading Audio',
    icon: <Upload className="h-4 w-4" />,
  },
  {
    id: 'transcribing',
    label: 'Transcribing Speech',
    subtitle: 'This usually takes 30-60 seconds',
    icon: <Mic className="h-4 w-4" />,
  },
  {
    id: 'analyzing',
    label: 'Analyzing Call',
    subtitle: 'Generating coaching insights',
    icon: <Brain className="h-4 w-4" />,
  },
  {
    id: 'complete',
    label: 'Complete',
    icon: <CheckCircle className="h-4 w-4" />,
  },
];

function getStepStatus(
  stepId: string,
  currentStatus: string | null,
  isComplete: boolean,
  isError: boolean,
): StepStatus {
  if (isComplete) return 'complete';
  if (isError) return stepId === 'uploading' ? 'complete' : 'pending';

  switch (stepId) {
    case 'uploading':
      // Upload step completes immediately (we show this after upload succeeds)
      return 'complete';
    case 'transcribing':
      if (currentStatus === 'transcribing') return 'active';
      if (
        currentStatus === 'processing' ||
        currentStatus === 'analyzing' ||
        currentStatus === 'completed'
      )
        return 'complete';
      return 'pending';
    case 'analyzing':
      if (currentStatus === 'processing' || currentStatus === 'analyzing') return 'active';
      if (currentStatus === 'completed') return 'complete';
      return 'pending';
    case 'complete':
      if (currentStatus === 'completed') return 'complete';
      return 'pending';
    default:
      return 'pending';
  }
}

export function AudioProcessingProgress({
  transcriptId,
  pipeline,
  onComplete,
  onRetry: onRetryProp,
}: AudioProcessingProgressProps) {
  const handleComplete = useCallback(() => {
    toast.success('Audio processing complete!', {
      description: 'Your call analysis is ready to view.',
    });
    onComplete?.();
  }, [onComplete]);

  const handleError = useCallback((errorMessage: string) => {
    toast.error('Audio processing failed', {
      description: errorMessage,
    });
  }, []);

  const { status, error, isComplete, isError } = useAudioProcessingStatus(
    transcriptId,
    pipeline,
    {
      onComplete: handleComplete,
      onError: handleError,
    },
  );

  const handleRetry = () => {
    if (onRetryProp) {
      onRetryProp();
    } else {
      // Fallback: reload the page if no retry handler is provided
      window.location.reload();
    }
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardContent className="py-8">
        <div className="flex flex-col items-center space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              {isComplete ? (
                <CheckCircle className="h-6 w-6 text-green-500" />
              ) : isError ? (
                <AlertCircle className="h-6 w-6 text-destructive" />
              ) : (
                <Mic className="h-6 w-6 text-primary animate-pulse" />
              )}
              <h3 className="text-xl font-semibold">
                {isComplete
                  ? 'Processing Complete'
                  : isError
                    ? 'Processing Failed'
                    : 'Processing Audio...'}
              </h3>
            </div>
            {!isComplete && !isError && (
              <p className="text-sm text-muted-foreground">
                Your audio is being transcribed and analyzed
              </p>
            )}
          </div>

          {/* Vertical stepper */}
          <div className="w-full max-w-md space-y-1">
            {steps.map((step, index) => {
              const stepStatus = getStepStatus(step.id, status, isComplete, isError);
              const isLast = index === steps.length - 1;

              return (
                <div key={step.id} className="flex gap-3">
                  {/* Vertical line + icon */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-colors',
                        stepStatus === 'complete' && 'bg-green-500/10 text-green-500',
                        stepStatus === 'active' && 'bg-primary/10 text-primary',
                        stepStatus === 'pending' && 'bg-muted text-muted-foreground/40',
                      )}
                    >
                      {stepStatus === 'active' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : stepStatus === 'complete' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          'w-0.5 flex-1 min-h-[16px] transition-colors',
                          stepStatus === 'complete' ? 'bg-green-500/30' : 'bg-border',
                        )}
                      />
                    )}
                  </div>

                  {/* Step content */}
                  <div className="pb-4">
                    <p
                      className={cn(
                        'text-sm leading-8 transition-colors',
                        stepStatus === 'complete' && 'text-green-600 dark:text-green-400',
                        stepStatus === 'active' && 'text-primary font-medium',
                        stepStatus === 'pending' && 'text-muted-foreground/60',
                      )}
                    >
                      {step.label}
                    </p>
                    {step.subtitle && stepStatus === 'active' && (
                      <p className="text-xs text-muted-foreground/70 mt-0.5">{step.subtitle}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Error state */}
          {isError && error && (
            <div className="w-full max-w-md space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
              <Button variant="outline" onClick={handleRetry} className="w-full">
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          )}

          {/* Footer hint */}
          {!isComplete && !isError && (
            <p className="text-xs text-muted-foreground text-center">
              This usually takes 30-60 seconds
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
