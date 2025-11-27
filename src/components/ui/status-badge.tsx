import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'on-track' | 'at-risk' | 'off-track';
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        status === 'on-track' && "bg-success/10 text-success",
        status === 'at-risk' && "bg-warning/10 text-warning",
        status === 'off-track' && "bg-destructive/10 text-destructive",
        className
      )}
    >
      {children}
    </span>
  );
}

export function getPerformanceStatus(actual: number, goal: number): 'on-track' | 'at-risk' | 'off-track' {
  if (goal === 0) return 'on-track';
  const percentage = (actual / goal) * 100;
  
  // Get current day of month to calculate expected progress
  const now = new Date();
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const expectedProgress = (dayOfMonth / daysInMonth) * 100;
  
  // Compare actual progress to expected progress
  if (percentage >= expectedProgress * 0.9) return 'on-track';
  if (percentage >= expectedProgress * 0.5) return 'at-risk';
  return 'off-track';
}
