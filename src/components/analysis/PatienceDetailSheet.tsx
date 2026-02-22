import { Badge } from '@/components/ui/badge';
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
  Timer,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BehaviorScore } from '@/utils/analysis-schemas';

type PatienceMetrics = BehaviorScore['metrics']['patience'];

interface PatienceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patience: PatienceMetrics;
}

export function PatienceDetailSheet({ open, onOpenChange, patience }: PatienceDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            Acknowledgment Quality
          </SheetTitle>
          <SheetDescription>
            {patience.missed_acknowledgment_count === 0
              ? 'Excellent acknowledgment skills - you validated prospect statements before responding!'
              : `${patience.missed_acknowledgment_count} missed acknowledgment${patience.missed_acknowledgment_count !== 1 ? 's' : ''} detected during the call`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Status */}
          <div className="flex items-center gap-3 p-4 rounded-lg border">
            <div className={cn(
              "flex h-12 w-12 items-center justify-center rounded-full",
              patience.status === 'Excellent' ? "bg-green-500/20 text-green-600" :
              patience.status === 'Good' ? "bg-green-400/20 text-green-600" :
              patience.status === 'Fair' ? "bg-yellow-500/20 text-yellow-600" :
              "bg-orange-500/20 text-orange-600"
            )}>
              {patience.status === 'Excellent' || patience.status === 'Good' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <div>
              <p className="font-semibold">{patience.status}</p>
              <p className="text-sm text-muted-foreground">
                Score: {patience.score}/30
              </p>
            </div>
          </div>

          {/* Acknowledgment Issues List */}
          {patience.acknowledgment_issues && patience.acknowledgment_issues.length > 0 ? (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-muted-foreground">Missed Acknowledgments</h4>
              <div className="space-y-3">
                {patience.acknowledgment_issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "p-3 rounded-lg border",
                      issue.severity === 'Severe' ? "border-destructive/50 bg-destructive/5" :
                      issue.severity === 'Moderate' ? "border-orange-500/50 bg-orange-500/5" :
                      "border-yellow-500/50 bg-yellow-500/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-xs text-muted-foreground">Prospect said:</span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-xs shrink-0",
                          issue.severity === 'Severe' ? "bg-destructive/20 text-destructive" :
                          issue.severity === 'Moderate' ? "bg-orange-500/20 text-orange-700" :
                          "bg-yellow-500/20 text-yellow-700"
                        )}
                      >
                        {issue.severity}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium mb-2">"{issue.what_prospect_said}"</p>
                    <p className="text-xs text-muted-foreground mb-2">
                      <span className="font-medium">Rep responded:</span> {issue.how_rep_responded}
                    </p>
                    <div className="p-2 rounded bg-primary/5 border border-primary/20">
                      <p className="text-xs text-primary flex items-start gap-1">
                        <Sparkles className="h-3 w-3 mt-0.5 shrink-0" />
                        {issue.coaching_tip}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : patience.missed_acknowledgment_count > 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Acknowledgment details not available for this analysis
            </p>
          ) : null}

          {/* Tips for improvement if issues detected */}
          {patience.missed_acknowledgment_count > 0 && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
              <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Acknowledgment Techniques
              </h4>
              <ul className="space-y-2 text-sm text-foreground/80">
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Start with phrases like "I hear you," "That makes sense," or "Thanks for sharing that"
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  Paraphrase what the prospect said before responding with your point
                </li>
                <li className="flex gap-2">
                  <span className="text-primary">•</span>
                  For objections, acknowledge the concern before addressing it: "I understand that concern, and..."
                </li>
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
