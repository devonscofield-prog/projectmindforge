import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HeatScoreBadgeProps {
  score: number | null;
  variant?: 'default' | 'card';
  showNull?: boolean;
  className?: string;
}

/**
 * Reusable heat score badge component with color-coded visual indicators
 * 
 * @param score - The heat score value (0-10) or null
 * @param variant - Display style: 'default' (compact inline) or 'card' (with background)
 * @param showNull - Whether to show "—" for null values (default: true for 'default', false for 'card')
 * @param className - Additional CSS classes
 */
export function HeatScoreBadge({ 
  score, 
  variant = 'default', 
  showNull = variant === 'default',
  className 
}: HeatScoreBadgeProps) {
  if (score === null) {
    if (!showNull) return null;
    return <span className="text-muted-foreground">—</span>;
  }

  // Determine color based on score
  let colorClass = 'text-muted-foreground bg-muted';
  if (score >= 8) {
    colorClass = 'text-red-600 bg-red-100 dark:bg-red-900/30';
  } else if (score >= 6) {
    colorClass = 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
  } else if (score >= 4) {
    colorClass = 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
  } else {
    colorClass = 'text-blue-600 bg-blue-100 dark:bg-blue-900/30';
  }

  if (variant === 'card') {
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 md:py-3 rounded-lg', colorClass, className)}>
        <Flame className="h-4 w-4 md:h-5 md:w-5 shrink-0" />
        <div>
          <p className="text-xs md:text-sm font-medium">Heat Score</p>
          <p className="text-base md:text-lg font-bold">{score}/10</p>
        </div>
      </div>
    );
  }

  // Default compact variant
  const textColorClass = colorClass.split(' ')[0]; // Extract just the text color
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Flame className={cn('h-4 w-4', textColorClass)} />
      <span className={textColorClass}>{score}/10</span>
    </div>
  );
}
