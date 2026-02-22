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
  XCircle,
  HelpCircle,
  Mic,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionLeverageSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  explanation: string;
  leverageRatio: string;
  avgQuestionLength: number;
  avgAnswerLength: number;
  highLeverageCount: number;
  lowLeverageCount: number;
  highLeverageExamples: string[];
  lowLeverageExamples: string[];
}

export function QuestionLeverageSheet({
  open,
  onOpenChange,
  explanation,
  leverageRatio,
  avgQuestionLength,
  avgAnswerLength,
  highLeverageCount,
  lowLeverageCount,
  highLeverageExamples,
  lowLeverageExamples,
}: QuestionLeverageSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Question Leverage
          </SheetTitle>
          <SheetDescription>
            {explanation}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Explanation Box */}
          <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
            <h4 className="font-medium text-sm mb-2">What is Question Leverage?</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Leverage measures how much talking your questions trigger. High-leverage
              questions get prospects to share detailed information, while low-leverage
              questions get one-word answers.
            </p>
          </div>

          {/* Hero Ratio Display */}
          <div className="flex flex-col items-center py-4 border rounded-lg bg-card">
            <div
              className={cn(
                "text-5xl font-bold tabular-nums",
                parseFloat(leverageRatio) >= 2 ? "text-green-600" :
                parseFloat(leverageRatio) >= 1 ? "text-yellow-600" :
                "text-orange-600"
              )}
            >
              {leverageRatio}x
            </div>
            <p className="text-sm text-muted-foreground mt-1">Yield Ratio</p>
            <p className="text-xs text-muted-foreground mt-2 px-4 text-center">
              For every word you ask, the prospect speaks <span className="font-medium">{leverageRatio}</span> words
            </p>
            <Badge
              variant="secondary"
              className={cn(
                "mt-3",
                parseFloat(leverageRatio) >= 2 ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                parseFloat(leverageRatio) >= 1 ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                'bg-orange-500/20 text-orange-700 dark:text-orange-400'
              )}
            >
              {parseFloat(leverageRatio) >= 2 ? '✓ Good Yield (2x+ is ideal)' :
                parseFloat(leverageRatio) >= 1 ? 'Fair Yield (aim for 2x+)' : 'Low Yield (needs improvement)'}
            </Badge>
          </div>

          {/* Stats Cards */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Avg Question</p>
              </div>
              <p className="text-2xl font-bold">{avgQuestionLength} <span className="text-sm font-normal text-muted-foreground">words</span></p>
            </div>
            <div className="flex-1 p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <Mic className="h-4 w-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Avg Answer</p>
              </div>
              <p className="text-2xl font-bold">{avgAnswerLength} <span className="text-sm font-normal text-muted-foreground">words</span></p>
            </div>
          </div>

          {/* Question Impact Summary */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Question Impact</h4>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                <div>
                  <p className="font-semibold text-green-700 dark:text-green-400">{highLeverageCount}</p>
                  <p className="text-xs text-muted-foreground">High-Leverage</p>
                </div>
              </div>
              <div className="flex-1 flex items-center gap-3 p-3 rounded-lg border border-orange-500/30 bg-orange-500/5">
                <XCircle className="h-5 w-5 text-orange-600 shrink-0" />
                <div>
                  <p className="font-semibold text-orange-700 dark:text-orange-400">{lowLeverageCount}</p>
                  <p className="text-xs text-muted-foreground">Low-Leverage</p>
                </div>
              </div>
            </div>
          </div>

          {/* Question Examples */}
          {highLeverageExamples.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Best Questions
              </h4>
              <div className="space-y-2">
                {highLeverageExamples.map((example, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-green-500/20 bg-green-500/5"
                  >
                    <p className="text-sm text-foreground/90 italic leading-relaxed">"{example}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lowLeverageExamples.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2 text-orange-600 dark:text-orange-400">
                <AlertTriangle className="h-4 w-4" />
                Missed Opportunities
              </h4>
              <div className="space-y-2">
                {lowLeverageExamples.map((example, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5"
                  >
                    <p className="text-sm text-foreground/90 italic leading-relaxed">"{example}"</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Coaching Tips Section */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Coaching Tips
            </h4>
            <div className="space-y-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-lg leading-none">💬</span>
                <div>
                  <p className="text-sm font-medium">Start with "Tell me about..." or "Walk me through..."</p>
                  <p className="text-xs text-muted-foreground mt-0.5">These prompts invite detailed, story-like answers</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-lg leading-none">🎯</span>
                <div>
                  <p className="text-sm font-medium">Avoid yes/no questions unless confirming</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Use them only to verify specific details you already heard</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <span className="text-lg leading-none">🔄</span>
                <div>
                  <p className="text-sm font-medium">Follow up on short answers</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Try: "Can you expand on that?" or "What does that look like day-to-day?"</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
