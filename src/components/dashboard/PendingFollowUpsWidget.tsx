import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Target,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Building2,
  X,
} from 'lucide-react';
import {
  listAllPendingFollowUpsForRep,
  completeFollowUp,
  dismissFollowUp,
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
  discovery: 'Discovery',
  stakeholder: 'Stakeholder',
  objection: 'Objection',
  proposal: 'Proposal',
  relationship: 'Relationship',
  competitive: 'Competitive',
};

export function PendingFollowUpsWidget({ repId }: PendingFollowUpsWidgetProps) {
  const navigate = useNavigate();
  const [followUps, setFollowUps] = useState<AccountFollowUpWithProspect[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    loadFollowUps();
  }, [repId]);

  const loadFollowUps = async () => {
    try {
      const data = await listAllPendingFollowUpsForRep(repId);
      setFollowUps(data);
    } catch (error) {
      console.error('Failed to load follow-ups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (followUpId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletingId(followUpId);
    try {
      await completeFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
    } catch (error) {
      console.error('Failed to complete follow-up:', error);
    } finally {
      setCompletingId(null);
    }
  };

  const handleDismiss = async (followUpId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissingId(followUpId);
    try {
      await dismissFollowUp(followUpId);
      setFollowUps(prev => prev.filter(f => f.id !== followUpId));
    } catch (error) {
      console.error('Failed to dismiss follow-up:', error);
    } finally {
      setDismissingId(null);
    }
  };

  const handleNavigate = (prospectId: string) => {
    navigate(`/rep/prospects/${prospectId}`);
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
            Pending Follow-Ups
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Pending Follow-Ups
        </CardTitle>
        <CardDescription>
          {followUps.length} action{followUps.length !== 1 ? 's' : ''} across your accounts
        </CardDescription>
      </CardHeader>
      <CardContent>
        {followUps.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">All caught up! No pending follow-ups.</p>
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
                        onDismiss={handleDismiss}
                        onNavigate={handleNavigate}
                        isCompleting={completingId === followUp.id}
                        isDismissing={dismissingId === followUp.id}
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
                        onDismiss={handleDismiss}
                        onNavigate={handleNavigate}
                        isCompleting={completingId === followUp.id}
                        isDismissing={dismissingId === followUp.id}
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
  );
}

interface FollowUpRowProps {
  followUp: AccountFollowUpWithProspect;
  onComplete: (id: string, e: React.MouseEvent) => void;
  onDismiss: (id: string, e: React.MouseEvent) => void;
  onNavigate: (prospectId: string) => void;
  isCompleting: boolean;
  isDismissing: boolean;
}

function FollowUpRow({ followUp, onComplete, onDismiss, onNavigate, isCompleting, isDismissing }: FollowUpRowProps) {
  const priority = priorityConfig[followUp.priority] || priorityConfig.medium;
  const accountDisplay = followUp.account_name || followUp.prospect_name;

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 cursor-pointer transition-colors group"
      onClick={() => onNavigate(followUp.prospect_id)}
    >
      {/* Complete button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 shrink-0"
        onClick={(e) => onComplete(followUp.id, e)}
        disabled={isCompleting || isDismissing}
      >
        {isCompleting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 text-muted-foreground hover:text-green-500" />
        )}
      </Button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="secondary" className={`${priority.className} text-[10px] px-1.5 py-0`}>
            {priority.label}
          </Badge>
          {followUp.category && (
            <span className="text-[10px] text-muted-foreground">
              {categoryLabels[followUp.category]}
            </span>
          )}
        </div>
        <p className="text-sm font-medium truncate">{followUp.title}</p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3" />
          <span className="truncate">{accountDisplay}</span>
        </div>
      </div>

      {/* Dismiss button */}
      <Button
        size="sm"
        variant="ghost"
        className="h-8 w-8 p-0 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
        onClick={(e) => onDismiss(followUp.id, e)}
        disabled={isDismissing || isCompleting}
        title="Dismiss"
      >
        {isDismissing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <X className="h-4 w-4" />
        )}
      </Button>

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
