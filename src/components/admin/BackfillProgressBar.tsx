import { cn } from '@/lib/utils';
import { Loader2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackfillProgressBarProps {
  label: string;
  processed: number;
  total: number;
  isStalled?: boolean;
  onStop?: () => void;
  variant?: 'embeddings' | 'ner' | 'reindex';
  className?: string;
}

export function BackfillProgressBar({
  label,
  processed,
  total,
  isStalled = false,
  onStop,
  variant = 'embeddings',
  className,
}: BackfillProgressBarProps) {
  const percentage = total > 0 ? Math.min((processed / total) * 100, 100) : 0;
  
  const variantStyles = {
    embeddings: {
      bar: 'bg-blue-500',
      text: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-950/30',
    },
    ner: {
      bar: 'bg-purple-500',
      text: 'text-purple-600',
      bg: 'bg-purple-100 dark:bg-purple-950/30',
    },
    reindex: {
      bar: 'bg-amber-500',
      text: 'text-amber-600',
      bg: 'bg-amber-100 dark:bg-amber-950/30',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2 rounded-lg", styles.bg, className)}>
      <div className="flex items-center gap-2 min-w-[120px]">
        {isStalled ? (
          <AlertTriangle className={cn("h-4 w-4 text-amber-500 animate-pulse")} />
        ) : (
          <Loader2 className={cn("h-4 w-4 animate-spin", styles.text)} />
        )}
        <span className={cn("text-sm font-medium", styles.text)}>
          {label}
        </span>
      </div>
      
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-300 rounded-full",
              styles.bar,
              isStalled && "animate-pulse"
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        
        <div className="flex items-center gap-2 min-w-[100px] justify-end">
          <span className={cn("text-sm font-medium tabular-nums", styles.text)}>
            {processed.toLocaleString()} / {total.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">
            ({percentage.toFixed(0)}%)
          </span>
        </div>
      </div>
      
      {onStop && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onStop}
          className="h-6 px-2 text-muted-foreground hover:text-destructive"
        >
          <XCircle className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
