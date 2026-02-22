import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Check, X, ChevronDown, Clock, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FollowUpSuggestion } from './types';

interface SuggestionCardProps {
  suggestion: FollowUpSuggestion;
  onAccept: (suggestion: FollowUpSuggestion) => void;
  onDismiss: (suggestionId: string) => void;
  isAccepting?: boolean;
}

const priorityConfig = {
  high: { color: 'text-destructive', bg: 'bg-destructive/10', label: 'HIGH' },
  medium: { color: 'text-warning', bg: 'bg-warning/10', label: 'MEDIUM' },
  low: { color: 'text-success', bg: 'bg-success/10', label: 'LOW' },
};

const categoryLabels: Record<string, string> = {
  discovery: 'Discovery',
  stakeholder: 'Stakeholder',
  objection: 'Objection',
  proposal: 'Proposal',
  relationship: 'Relationship',
  competitive: 'Competitive',
};

function formatDueDays(days: number | null): string {
  if (days === null) return 'No deadline';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return `In ${days} days`;
  if (days <= 14) return 'In 2 weeks';
  return `In ${Math.round(days / 7)} weeks`;
}

export const SuggestionCard = memo(function SuggestionCard({
  suggestion,
  onAccept,
  onDismiss,
  isAccepting,
}: SuggestionCardProps) {
  const [isReasoningOpen, setIsReasoningOpen] = useState(false);
  const priority = priorityConfig[suggestion.priority] || priorityConfig.medium;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3 transition-all hover:shadow-sm">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1">
          {/* Priority and Category badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge 
              variant="outline" 
              className={cn('text-xs font-semibold', priority.color, priority.bg)}
            >
              {priority.label}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {categoryLabels[suggestion.category] || suggestion.category}
            </Badge>
            {suggestion.suggested_due_days !== null && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDueDays(suggestion.suggested_due_days)}
              </span>
            )}
          </div>
          
          {/* Title */}
          <h4 className="font-medium text-foreground leading-snug">
            {suggestion.title}
          </h4>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground">
            {suggestion.description}
          </p>

          {/* Urgency signal if present */}
          {suggestion.urgency_signal && (
            <p className="text-xs text-warning flex items-center gap-1 mt-1">
              <span className="font-medium">⚡ Urgency:</span> {suggestion.urgency_signal}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            onClick={() => onDismiss(suggestion.id)}
            disabled={isAccepting}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
          <Button
            variant="default"
            size="sm"
            className="h-8"
            onClick={() => onAccept(suggestion)}
            disabled={isAccepting}
          >
            {isAccepting ? (
              <span className="animate-pulse">...</span>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Accept
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Collapsible AI Reasoning */}
      <Collapsible open={isReasoningOpen} onOpenChange={setIsReasoningOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Lightbulb className="h-3 w-3" />
            <span>Why this suggestion?</span>
            <ChevronDown className={cn(
              'h-3 w-3 transition-transform',
              isReasoningOpen && 'rotate-180'
            )} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 space-y-2">
            <p>{suggestion.ai_reasoning}</p>
            {suggestion.related_evidence && (
              <p className="border-l-2 border-primary/30 pl-2 italic">
                "{suggestion.related_evidence}"
              </p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
});
