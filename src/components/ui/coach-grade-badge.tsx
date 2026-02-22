import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface CoachGradeBadgeProps {
  grade?: string | null;
  trend?: 'improving' | 'declining' | 'stable' | null;
  showTrend?: boolean;
  size?: 'sm' | 'default';
}

const gradeColors: Record<string, string> = {
  'A+': 'bg-green-500/10 text-green-600 border-green-500/30',
  'A': 'bg-green-500/10 text-green-600 border-green-500/30',
  'A-': 'bg-green-500/10 text-green-600 border-green-500/30',
  'B+': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'B': 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  'B-': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  'C+': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  'C': 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
  'C-': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'D+': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'D': 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  'D-': 'bg-red-500/10 text-red-600 border-red-500/30',
  'F': 'bg-red-500/10 text-red-600 border-red-500/30',
};

export const CoachGradeBadge = memo(function CoachGradeBadge({ grade, trend, showTrend = false, size = 'default' }: CoachGradeBadgeProps) {
  if (!grade) {
    return <span className="text-muted-foreground">—</span>;
  }

  const colorClass = gradeColors[grade] || 'bg-muted text-muted-foreground border-muted';
  
  const TrendIcon = trend === 'improving' 
    ? TrendingUp 
    : trend === 'declining' 
      ? TrendingDown 
      : Minus;
  
  const trendColor = trend === 'improving' 
    ? 'text-green-500' 
    : trend === 'declining' 
      ? 'text-red-500' 
      : 'text-muted-foreground';

  return (
    <div className="flex items-center gap-1">
      <Badge 
        variant="outline" 
        className={cn(
          'font-semibold border',
          colorClass,
          size === 'sm' && 'text-xs px-1.5 py-0'
        )}
      >
        {grade}
      </Badge>
      {showTrend && trend && (
        <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} aria-hidden="true" />
      )}
    </div>
  );
});
