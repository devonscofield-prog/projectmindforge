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
import { CheckCircle2, RotateCcw, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import type { AccountFollowUp, FollowUpPriority, FollowUpCategory } from '@/api/accountFollowUps';

interface CompletedFollowUpsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  completedFollowUps: AccountFollowUp[];
  onReopen: (id: string) => Promise<void>;
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

export function CompletedFollowUpsDialog({
  open,
  onOpenChange,
  completedFollowUps,
  onReopen,
}: CompletedFollowUpsDialogProps) {
  const [reopeningId, setReopeningId] = useState<string | null>(null);

  const handleReopen = async (id: string) => {
    setReopeningId(id);
    try {
      await onReopen(id);
    } finally {
      setReopeningId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Completed Follow-Ups
          </DialogTitle>
          <DialogDescription>
            {completedFollowUps.length} follow-up{completedFollowUps.length !== 1 ? 's' : ''} completed
          </DialogDescription>
        </DialogHeader>

        {completedFollowUps.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
            <p>No completed follow-ups yet</p>
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-3">
              {completedFollowUps.map((followUp) => {
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
                        <h4 className="font-medium text-foreground/80 line-through decoration-green-500/50">
                          {followUp.title}
                        </h4>

                        {/* Completed date */}
                        {followUp.completed_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Completed {format(new Date(followUp.completed_at), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>

                      {/* Reopen Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReopen(followUp.id)}
                        disabled={reopeningId === followUp.id}
                        className="shrink-0"
                      >
                        {reopeningId === followUp.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <RotateCcw className="h-4 w-4 mr-1" />
                            Reopen
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
