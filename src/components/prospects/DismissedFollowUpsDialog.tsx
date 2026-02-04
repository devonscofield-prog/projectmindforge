import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { XCircle, RotateCcw, Loader2 } from 'lucide-react';
import type { AccountFollowUp, FollowUpPriority, FollowUpCategory } from '@/api/accountFollowUps';

interface DismissedFollowUpsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dismissedFollowUps: AccountFollowUp[];
  onRestore: (id: string) => Promise<void>;
}

const priorityConfig: Record<FollowUpPriority, { label: string; className: string }> = {
  high: { label: 'HIGH', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { label: 'MED', className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { label: 'LOW', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
};

const categoryLabels: Record<FollowUpCategory, string> = {
  phone_call: 'Phone Call',
  drip_email: 'DRIP Email',
  text_message: 'Text Message',
  follow_up_email: 'Follow Up Email',
};

export function DismissedFollowUpsDialog({
  open,
  onOpenChange,
  dismissedFollowUps,
  onRestore,
}: DismissedFollowUpsDialogProps) {
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      await onRestore(id);
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-muted-foreground" />
            Dismissed Follow-Ups
          </DialogTitle>
          <DialogDescription>
            {dismissedFollowUps.length} follow-up{dismissedFollowUps.length !== 1 ? 's' : ''} dismissed
          </DialogDescription>
        </DialogHeader>

        {dismissedFollowUps.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <XCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>No dismissed follow-ups</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {dismissedFollowUps.map((followUp) => {
                const priorityKey = (followUp.priority as FollowUpPriority) || 'medium';
                const priority = priorityConfig[priorityKey] || priorityConfig.medium;
                
                return (
                  <div
                    key={followUp.id}
                    className="border rounded-lg p-3 bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Badges */}
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className={`${priority.className} opacity-70`}>
                            {priority.label}
                          </Badge>
                          {followUp.category && categoryLabels[followUp.category as FollowUpCategory] && (
                            <Badge variant="outline" className="opacity-70">
                              {categoryLabels[followUp.category as FollowUpCategory]}
                            </Badge>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="font-medium text-foreground/60 line-through">
                          {followUp.title}
                        </h4>

                        {/* Description if exists */}
                        {followUp.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {followUp.description}
                          </p>
                        )}
                      </div>

                      {/* Restore Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestore(followUp.id)}
                        disabled={restoringId === followUp.id}
                        className="shrink-0"
                      >
                        {restoringId === followUp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Restore
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
