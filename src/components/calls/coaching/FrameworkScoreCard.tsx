import { useState, memo } from 'react';
import { ChevronDown, ChevronUp, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Status = 'on-track' | 'at-risk' | 'off-track';

interface FrameworkScoreCardProps {
  label: string;
  score: number | null;
  maxScore: number;
  summary?: string;
  icon: LucideIcon;
  colorScheme: 'heat' | 'blue' | 'green' | 'purple';
}

function getStatus(score: number | null, maxScore: number): Status {
  if (score === null) return 'off-track';
  const percentage = (score / maxScore) * 100;
  if (percentage >= 70) return 'on-track';
  if (percentage >= 50) return 'at-risk';
  return 'off-track';
}

function getStatusLabel(status: Status): string {
  switch (status) {
    case 'on-track': return 'On Track';
    case 'at-risk': return 'Needs Work';
    case 'off-track': return 'Critical';
  }
}

function getStatusStyles(status: Status): string {
  switch (status) {
    case 'on-track': return 'bg-success/10 text-success';
    case 'at-risk': return 'bg-warning/10 text-warning';
    case 'off-track': return 'bg-destructive/10 text-destructive';
  }
}

function getColorSchemeStyles(colorScheme: FrameworkScoreCardProps['colorScheme'], status: Status) {
  // For heat, use status-based colors
  if (colorScheme === 'heat') {
    switch (status) {
      case 'on-track': return { stroke: 'stroke-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' };
      case 'at-risk': return { stroke: 'stroke-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/30' };
      case 'off-track': return { stroke: 'stroke-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' };
    }
  }
  
  // Fixed color schemes for frameworks
  const schemes = {
    blue: { stroke: 'stroke-blue-500', text: 'text-blue-600 dark:text-blue-400', bg: 'bg-transparent' },
    green: { stroke: 'stroke-green-500', text: 'text-green-600 dark:text-green-400', bg: 'bg-transparent' },
    purple: { stroke: 'stroke-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-transparent' },
  };
  
  return schemes[colorScheme] || schemes.blue;
}

export const FrameworkScoreCard = memo(function FrameworkScoreCard({
  label,
  score,
  maxScore,
  summary,
  icon: Icon,
  colorScheme
}: FrameworkScoreCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const status = getStatus(score, maxScore);
  const colors = getColorSchemeStyles(colorScheme, status);
  const percentage = score !== null ? (score / maxScore) * 100 : 0;
  
  // SVG circle math
  const size = 80;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const hasSummary = summary && summary.trim().length > 0;

  return (
    <div 
      className={cn(
        'p-4 md:p-6 flex flex-col items-center gap-3 transition-colors',
        colorScheme === 'heat' && colors.bg,
        hasSummary && 'cursor-pointer hover:bg-muted/50'
      )}
      onClick={hasSummary ? () => setIsExpanded(!isExpanded) : undefined}
    >
      {/* Circular Progress Ring */}
      <div className="relative">
        <svg width={size} height={size} className="-rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/30"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn('transition-all duration-500', colors.stroke)}
          />
        </svg>
        
        {/* Score in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-xl font-bold', colors.text)}>
            {score ?? '-'}
          </span>
          <span className="text-[10px] text-muted-foreground">
            /{maxScore}
          </span>
        </div>
      </div>
      
      {/* Label with icon */}
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-4 w-4', colors.text)} />
        <span className="text-xs md:text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      
      {/* Status Badge */}
      <span className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium',
        getStatusStyles(status)
      )}>
        {getStatusLabel(status)}
      </span>
      
      {/* Expand/Collapse indicator */}
      {hasSummary && (
        <div className="flex items-center gap-1 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          <span className="text-[10px]">{isExpanded ? 'Less' : 'Details'}</span>
        </div>
      )}
      
      {/* Expandable Summary */}
      {hasSummary && isExpanded && (
        <div className="w-full pt-2 border-t border-border mt-1">
          <p className="text-xs text-muted-foreground leading-relaxed text-center">
            {summary}
          </p>
        </div>
      )}
    </div>
  );
});
