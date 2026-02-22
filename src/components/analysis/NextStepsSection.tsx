import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  CheckCircle2,
  XCircle,
  ListChecks,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BehaviorScore } from '@/utils/analysis-schemas';

type NextStepsMetrics = BehaviorScore['metrics']['next_steps'];

interface NextStepsSectionProps {
  nextSteps: NextStepsMetrics;
}

export function NextStepsSection({ nextSteps }: NextStepsSectionProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Card
        className="cursor-pointer transition-colors hover:bg-accent/50"
        onClick={() => setSheetOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSheetOpen(true);
          }
        }}
        tabIndex={0}
        role="button"
        aria-label="View next steps details"
      >
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full",
                nextSteps.secured
                  ? "bg-green-500/20 text-green-600"
                  : "bg-destructive/20 text-destructive"
              )}>
                {nextSteps.secured ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <XCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Next Steps</span>
                  <span className="text-sm font-bold text-muted-foreground">{nextSteps.score}/15</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {nextSteps.details || (nextSteps.secured ? 'Commitment secured' : 'No clear next steps')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={nextSteps.secured ? 'default' : 'destructive'}>
                {nextSteps.secured ? 'Secured' : 'Missing'}
              </Badge>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Next Steps Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Next Steps Details
            </SheetTitle>
            <SheetDescription>
              {nextSteps.secured
                ? 'A clear commitment was secured during this call'
                : 'No clear next steps were established'}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Status */}
            <div className="flex items-center gap-3 p-4 rounded-lg border">
              <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                nextSteps.secured
                  ? "bg-green-500/20 text-green-600"
                  : "bg-destructive/20 text-destructive"
              )}>
                {nextSteps.secured ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="font-semibold">
                  {nextSteps.secured ? 'Commitment Secured' : 'No Commitment'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Score: {nextSteps.score}/15
                </p>
              </div>
            </div>

            {/* Details */}
            {nextSteps.details && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm text-muted-foreground">Details</h4>
                <p className="text-foreground leading-relaxed">
                  {nextSteps.details}
                </p>
              </div>
            )}

            {/* Tips for improvement if not secured */}
            {!nextSteps.secured && (
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
    </>
  );
}
