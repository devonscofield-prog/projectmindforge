import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CircularScoreProps {
  score: number;
  label: string;
  size?: 'sm' | 'lg';
}

export function CircularScore({ score, label, size = 'lg' }: CircularScoreProps) {
  const isPassing = score >= 75;
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const sizeClasses = size === 'lg'
    ? 'h-32 w-32'
    : 'h-20 w-20';

  const textSize = size === 'lg' ? 'text-3xl' : 'text-xl';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn("relative", sizeClasses)}>
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-muted/20"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={cn(
              "transition-all duration-500",
              isPassing ? "text-green-500" : "text-destructive"
            )}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("font-bold", textSize, isPassing ? "text-green-600" : "text-destructive")}>
            {score}
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Badge
          variant={isPassing ? 'default' : 'destructive'}
          className={cn(
            "mt-1",
            isPassing ? 'bg-green-500 hover:bg-green-600' : ''
          )}
        >
          {isPassing ? 'PASS' : 'FAIL'}
        </Badge>
      </div>
    </div>
  );
}
