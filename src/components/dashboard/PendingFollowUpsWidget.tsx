import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getAccountDetailUrl } from '@/lib/routes';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FollowUpListSkeleton } from '@/components/ui/skeletons';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SwipeableCard } from '@/components/ui/swipeable-card';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompleteFollowUp, useDismissFollowUp } from '@/hooks/useFollowUpMutations';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Target,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Building2,
  X,
} from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import {
  listManualPendingFollowUpsForRep,
  type AccountFollowUpWithProspect,
  type FollowUpPriority,
  type FollowUpCategory,
} from '@/api/accountFollowUps';

interface PendingFollowUpsWidgetProps {
  repId: string;
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

function formatDueDate(dueDate: string): { text: string; isOverdue: boolean; isDueToday: boolean } {
  const date = parseISO(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (isPast(date) && !isToday(date)) {
    return { text: 'Overdue', isOverdue: true, isDueToday: false };
  }
  if (isToday(date)) {
    return { text: 'Due today', isOverdue: false, isDueToday: true };
  }
  if (isTomorrow(date)) {
    return { text: 'Due tomorrow', isOverdue: false, isDueToday: false };
  }
  return { text: `Due ${format(date, 'MMM d')}`, isOverdue: false, isDueToday: false };
}

export function PendingFollowUpsWidget({ repId }: PendingFollowUpsWidgetProps) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const isMobile = useIsMobile();
  const [confirmDismissItem, setConfirmDismissItem] = useState<AccountFollowUpWithProspect | null>(null);

  // Fetch manual follow-ups only (tasks the rep scheduled themselves)
  const { data: followUps = [], isLoading } = useQuery({
    queryKey: ['manual-follow-ups', repId],
    queryFn: () => listManualPendingFollowUpsForRep(repId),
    staleTime: 60 * 1000,
  });

  // Optimistic mutation hooks
  const completeFollowUpMutation = useCompleteFollowUp();
  const dismissFollowUpMutation = useDismissFollowUp();

  const handleComplete = async (followUpId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    completeFollowUpMutation.mutate(followUpId);
  };

  const handleSwipeComplete = async (followUpId: string) => {
    completeFollowUpMutation.mutate(followUpId);
  };

  const handleSwipeDismiss = async (followUpId: string) => {
    dismissFollowUpMutation.mutate(followUpId);
  };

  const handleDismissClick = (followUp: AccountFollowUpWithProspect, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDismissItem(followUp);
  };

  const handleConfirmDismiss = async () => {
    if (!confirmDismissItem) return;
    dismissFollowUpMutation.mutate(confirmDismissItem.id);
    setConfirmDismissItem(null);
  };

  const handleNavigate = (prospectId: string) => {
    navigate(getAccountDetailUrl(role, prospectId));
  };

  // Group by priority for display
  const highPriority = followUps.filter(f => f.priority === 'high');
  const otherPriority = followUps.filter(f => f.priority !== 'high');

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            My Scheduled Tasks
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FollowUpListSkeleton count={3} />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              My Scheduled Tasks
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => navigate('/rep/tasks')}>
              View All
            </Button>
          </div>
          <CardDescription>
            {followUps.length} task{followUps.length !== 1 ? 's' : ''} you've scheduled
          </CardDescription>
        </CardHeader>
        <CardContent>
          {followUps.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No scheduled tasks. Create one from any call analysis.</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {/* High priority section */}
                {highPriority.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 uppercase tracking-wider">
                      High Priority ({highPriority.length})
                    </p>
                    <div className="space-y-2">
                        {highPriority.map((followUp) => (
                        <FollowUpRow
                          key={followUp.id}
                          followUp={followUp}
                          onComplete={handleComplete}
                          onDismissClick={handleDismissClick}
                          onNavigate={handleNavigate}
                          isCompleting={completeFollowUpMutation.isPending && completeFollowUpMutation.variables === followUp.id}
                          isDismissing={dismissFollowUpMutation.isPending && dismissFollowUpMutation.variables === followUp.id}
                          isMobile={isMobile}
                          onSwipeComplete={() => handleSwipeComplete(followUp.id)}
                          onSwipeDismiss={() => handleSwipeDismiss(followUp.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other priority section */}
                {otherPriority.length > 0 && (
                  <div>
                    {highPriority.length > 0 && (
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Other ({otherPriority.length})
                      </p>
                    )}
                    <div className="space-y-2">
                      {otherPriority.map((followUp) => (
                        <FollowUpRow
                          key={followUp.id}
                          followUp={followUp}
                          onComplete={handleComplete}
                          onDismissClick={handleDismissClick}
                          onNavigate={handleNavigate}
                          isCompleting={completeFollowUpMutation.isPending && completeFollowUpMutation.variables === followUp.id}
                          isDismissing={dismissFollowUpMutation.isPending && dismissFollowUpMutation.variables === followUp.id}
                          isMobile={isMobile}
                          onSwipeComplete={() => handleSwipeComplete(followUp.id)}
                          onSwipeDismiss={() => handleSwipeDismiss(followUp.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Dismiss Confirmation Dialog */}
      <AlertDialog open={!!confirmDismissItem} onOpenChange={(open) => !open && setConfirmDismissItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Follow-Up?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to dismiss "{confirmDismissItem?.title}"? You can restore it later from the account's Dismissed section.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDismiss}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={dismissFollowUpMutation.isPending}
            >
              {dismissFollowUpMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface FollowUpRowProps {
  followUp: AccountFollowUpWithProspect;
  onComplete: (id: string, e?: React.MouseEvent) => void;
  onDismissClick: (followUp: AccountFollowUpWithProspect, e: React.MouseEvent) => void;
  onNavigate: (prospectId: string) => void;
  isCompleting: boolean;
  isDismissing: boolean;
  isMobile: boolean;
  onSwipeComplete: () => void;
  onSwipeDismiss: () => void;
}

function FollowUpRow({ 
  followUp, 
  onComplete, 
  onDismissClick, 
  onNavigate, 
  isCompleting, 
  isDismissing,
  isMobile,
  onSwipeComplete,
  onSwipeDismiss,
}: FollowUpRowProps) {
  const priorityKey = (followUp.priority as FollowUpPriority) || 'medium';
  const priority = priorityConfig[priorityKey] || priorityConfig.medium;
  const accountDisplay = followUp.account_name || followUp.prospect_name;
  
  // Format due date if present
  const dueDateInfo = followUp.due_date ? formatDueDate(followUp.due_date) : null;

  const content = (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
      onClick={() => onNavigate(followUp.prospect_id)}
    >
      {/* Complete button - hidden on mobile when swipe is available */}
      {!isMobile && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 shrink-0 border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 hover:text-green-700 dark:hover:text-green-300"
          onClick={(e) => onComplete(followUp.id, e)}
          disabled={isCompleting || isDismissing}
        >
          {isCompleting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0`}>
            {priority.label}
          </Badge>
          {followUp.category && categoryLabels[followUp.category as FollowUpCategory] && (
            <span className="text-[10px] text-muted-foreground">
              {categoryLabels[followUp.category as FollowUpCategory]}
            </span>
          )}
          {dueDateInfo && (
            <Badge 
              variant="outline" 
              className={`text-[10px] px-1.5 py-0 ${
                dueDateInfo.isOverdue 
                  ? 'bg-destructive/10 text-destructive border-destructive/20' 
                  : dueDateInfo.isDueToday 
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200' 
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {dueDateInfo.text}
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium truncate">{followUp.title}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{accountDisplay}</span>
        </div>
      </div>

      {/* Dismiss button - hidden on mobile when swipe is available */}
      {!isMobile && (
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
          onClick={(e) => onDismissClick(followUp, e)}
          disabled={isDismissing || isCompleting}
          title="Dismiss"
        >
          {isDismissing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </div>
  );

  // Wrap with SwipeableCard on mobile
  if (isMobile) {
    return (
      <SwipeableCard
        onSwipeRight={onSwipeComplete}
        onSwipeLeft={onSwipeDismiss}
        rightAction={{ label: 'Complete', icon: CheckCircle2, bgColor: 'bg-success', color: 'text-success-foreground' }}
        leftAction={{ label: 'Dismiss', icon: X, bgColor: 'bg-muted', color: 'text-muted-foreground' }}
        disabled={isCompleting || isDismissing}
      >
        {content}
      </SwipeableCard>
    );
  }

  return content;
}
