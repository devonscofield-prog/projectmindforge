import { ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Quote } from 'lucide-react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  sourceQuote?: string | null;
  extraBadges?: ReactNode;
}

export function StatCard({ icon, label, value, sourceQuote, extraBadges }: StatCardProps) {
  const content = (
    <div className="flex items-center gap-3 rounded-lg border bg-card p-3 h-full">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs text-muted-foreground">{label}</p>
          {sourceQuote && (
            <Quote className="h-3 w-3 text-muted-foreground/60" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold">{value}</p>
          {extraBadges}
        </div>
      </div>
    </div>
  );

  if (sourceQuote) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-xs italic">"{sourceQuote}"</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
