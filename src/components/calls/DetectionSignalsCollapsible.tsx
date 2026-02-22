import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DetectionSignalsCollapsible({ signals }: { signals: string[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const displayedSignals = signals.slice(0, 5);
  const hasMore = signals.length > 5;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-2">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group">
        <ChevronDown className={cn(
          "h-3 w-3 transition-transform",
          isOpen && "rotate-180"
        )} />
        <span>Why this classification? ({signals.length} signals)</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-1 pl-4">
        {displayedSignals.map((signal, idx) => (
          <p key={idx} className="text-xs text-muted-foreground">
            <span className="text-muted-foreground/60 mr-1">•</span>
            <span className="italic">"{signal}"</span>
          </p>
        ))}
        {hasMore && (
          <p className="text-xs text-muted-foreground/60 italic">
            and {signals.length - 5} more signals...
          </p>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
