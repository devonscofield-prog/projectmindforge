import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sentiment badge colors
const sentimentStyles: Record<string, string> = {
  'Positive': 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  'Neutral': 'bg-muted text-muted-foreground border-muted-foreground/30',
  'Skeptical': 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30',
  'Negative': 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30',
};

interface ParticipantBadgeProps {
  participant: {
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  };
}

export function ParticipantBadge({ participant }: ParticipantBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs",
            sentimentStyles[participant.sentiment] || sentimentStyles['Neutral']
          )}>
            {participant.is_decision_maker && (
              <Crown className="h-3 w-3 text-amber-500" />
            )}
            <span className="font-medium truncate max-w-[180px]">{participant.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">{participant.name}</p>
            <p className="text-muted-foreground">{participant.role}</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className={cn("text-[10px]", sentimentStyles[participant.sentiment])}>
                {participant.sentiment}
              </Badge>
              {participant.is_decision_maker && (
                <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600">
                  Decision Maker
                </Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
