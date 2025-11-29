import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Target,
  Users,
  MessageSquare,
  FileText,
  Heart,
  Swords,
  Loader2,
  X,
} from 'lucide-react';
import type { AccountFollowUp, FollowUpCategory, FollowUpPriority } from '@/api/accountFollowUps';

interface FollowUpItemProps {
  followUp: AccountFollowUp;
  onComplete: (id: string) => Promise<void>;
  onDismiss?: (id: string) => Promise<void>;
  isCompleting?: boolean;
  isDismissing?: boolean;
}

const priorityConfig: Record<FollowUpPriority, { label: string; className: string }> = {
  high: { label: 'HIGH', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: 'MED', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: 'LOW', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const categoryConfig: Record<FollowUpCategory, { label: string; icon: React.ElementType; className: string }> = {
  discovery: { label: 'Discovery', icon: Target, className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  stakeholder: { label: 'Stakeholder', icon: Users, className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  objection: { label: 'Objection', icon: MessageSquare, className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  proposal: { label: 'Proposal', icon: FileText, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  relationship: { label: 'Relationship', icon: Heart, className: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  competitive: { label: 'Competitive', icon: Swords, className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

export function FollowUpItem({ followUp, onComplete, onDismiss, isCompleting, isDismissing }: FollowUpItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [isLoadingDismiss, setIsLoadingDismiss] = useState(false);

  const priority = priorityConfig[followUp.priority] || priorityConfig.medium;
  const category = followUp.category ? categoryConfig[followUp.category] : null;
  const CategoryIcon = category?.icon || Target;

  const handleComplete = async () => {
    setIsLoadingComplete(true);
    try {
      await onComplete(followUp.id);
    } finally {
      setIsLoadingComplete(false);
    }
  };

  const handleDismiss = async () => {
    if (!onDismiss) return;
    setIsLoadingDismiss(true);
    try {
      await onDismiss(followUp.id);
    } finally {
      setIsLoadingDismiss(false);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Badge variant="secondary" className={priority.className}>
              {priority.label}
            </Badge>
            {category && (
              <Badge variant="secondary" className={category.className}>
                <CategoryIcon className="h-3 w-3 mr-1" />
                {category.label}
              </Badge>
            )}
          </div>

          {/* Title */}
          <h4 className="font-medium text-foreground">{followUp.title}</h4>

          {/* Description */}
          {followUp.description && (
            <p className="text-sm text-muted-foreground mt-1">{followUp.description}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {onDismiss && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              disabled={isLoadingDismiss || isDismissing || isLoadingComplete || isCompleting}
              className="text-muted-foreground hover:text-destructive"
              title="Dismiss this follow-up"
            >
              {isLoadingDismiss ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleComplete}
            disabled={isLoadingComplete || isCompleting || isLoadingDismiss || isDismissing}
          >
            {isLoadingComplete ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete
              </>
            )}
          </Button>
        </div>
      </div>

      {/* AI Reasoning (Collapsible) */}
      {followUp.ai_reasoning && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              {isOpen ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Why this matters
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2">
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3 border-l-2 border-primary/30">
              {followUp.ai_reasoning}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
