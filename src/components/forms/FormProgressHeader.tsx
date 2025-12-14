import * as React from 'react';
import { Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FormProgressSection {
  id: string;
  title: string;
  isComplete: boolean;
  isRequired?: boolean;
}

export interface FormProgressHeaderProps {
  sections: FormProgressSection[];
  className?: string;
}

export function FormProgressHeader({ sections, className }: FormProgressHeaderProps) {
  const completedCount = sections.filter((s) => s.isComplete).length;
  const requiredCount = sections.filter((s) => s.isRequired).length;
  const requiredCompleted = sections.filter((s) => s.isRequired && s.isComplete).length;
  const progressPercent = sections.length > 0 ? (completedCount / sections.length) * 100 : 0;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Section Indicators */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        {sections.map((section, index) => (
          <React.Fragment key={section.id}>
            {/* Section Indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center transition-all duration-300',
                  section.isComplete
                    ? 'bg-primary text-primary-foreground scale-110'
                    : 'bg-muted text-muted-foreground border border-border'
                )}
              >
                {section.isComplete ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Circle className="h-2 w-2 fill-current" />
                )}
              </div>
              <span
                className={cn(
                  'text-xs font-medium transition-colors hidden sm:inline',
                  section.isComplete ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {section.title}
              </span>
            </div>

            {/* Connector Line */}
            {index < sections.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 min-w-4 transition-colors duration-300',
                  section.isComplete ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {requiredCompleted}/{requiredCount} required complete
          </span>
          <span>{Math.round(progressPercent)}% complete</span>
        </div>
      </div>
    </div>
  );
}
