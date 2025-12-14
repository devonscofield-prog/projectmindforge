import * as React from 'react';
import { ChevronDown, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface FormSectionProps {
  title: string;
  icon: React.ReactNode;
  isComplete: boolean;
  completionCount?: number;
  totalCount?: number;
  isRequired?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function FormSection({
  title,
  icon,
  isComplete,
  completionCount,
  totalCount,
  isRequired = false,
  defaultOpen = false,
  children,
  className,
}: FormSectionProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className={cn('group', className)}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between p-4 rounded-xl transition-all duration-200',
            'bg-muted/30 hover:bg-muted/50 border border-border/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            isOpen && 'rounded-b-none border-b-0 bg-muted/40'
          )}
        >
          <div className="flex items-center gap-3">
            {/* Progress Indicator */}
            <div
              className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center transition-colors',
                isComplete
                  ? 'bg-primary text-primary-foreground'
                  : completionCount && completionCount > 0
                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/50'
                  : 'bg-muted text-muted-foreground border border-border'
              )}
            >
              {isComplete ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Circle className="h-2.5 w-2.5 fill-current" />
              )}
            </div>

            {/* Icon and Title */}
            <span className="text-muted-foreground">{icon}</span>
            <span className="font-medium text-foreground">{title}</span>

            {/* Required Badge */}
            {isRequired && !isComplete && (
              <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded font-medium uppercase tracking-wider">
                Required
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Completion Count Badge */}
            {totalCount !== undefined && totalCount > 0 && (
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  isComplete
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {completionCount ?? 0}/{totalCount}
              </span>
            )}

            {/* Chevron */}
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
        <div className="p-4 pt-0 bg-muted/30 rounded-b-xl border border-t-0 border-border/50">
          <div className="pt-4 border-t border-border/30">{children}</div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
