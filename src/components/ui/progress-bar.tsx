import { memo } from 'react';
import { cn } from '@/lib/utils';
import { getPerformanceStatus } from './status-badge';

interface ProgressBarProps {
  value: number;
  goal: number;
  showLabel?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProgressBar = memo(function ProgressBar({ value, goal, showLabel = true, className, size = 'md' }: ProgressBarProps) {
  const percentage = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  const status = getPerformanceStatus(value, goal);

  const sizeClasses = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn("w-full", className)}>
      <div className={cn("w-full bg-muted rounded-full overflow-hidden", sizeClasses[size])}>
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            status === 'on-track' && "bg-success",
            status === 'at-risk' && "bg-warning",
            status === 'off-track' && "bg-destructive"
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <div className="flex justify-between mt-1 text-xs text-muted-foreground">
          <span>{value.toLocaleString()}</span>
          <span>{goal.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
});
