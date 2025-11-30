import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RateLimitCountdownProps {
  secondsRemaining: number;
  className?: string;
}

export function RateLimitCountdown({ secondsRemaining, className }: RateLimitCountdownProps) {
  if (secondsRemaining <= 0) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = minutes > 0 
    ? `${minutes}:${seconds.toString().padStart(2, '0')}` 
    : `${seconds}s`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-lg",
        "bg-destructive/10 text-destructive border border-destructive/20",
        "animate-in fade-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <Clock className="h-4 w-4 animate-pulse" />
      <span>
        Rate limited. Retry in <span className="font-mono font-semibold">{timeDisplay}</span>
      </span>
    </div>
  );
}
