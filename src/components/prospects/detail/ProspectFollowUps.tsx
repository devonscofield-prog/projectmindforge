import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Target, RefreshCw, Loader2, Eye, ChevronDown } from 'lucide-react';
import { FollowUpItem } from '@/components/prospects/FollowUpItem';
import { CompletedFollowUpsDialog } from '@/components/prospects/CompletedFollowUpsDialog';
import { DismissedFollowUpsDialog } from '@/components/prospects/DismissedFollowUpsDialog';
import type { Prospect } from '@/api/prospects';
import type { AccountFollowUp } from '@/api/accountFollowUps';
import type { CallRecord } from '@/hooks/useProspectData';
import type { EmailLog } from '@/api/emailLogs';

interface ProspectFollowUpsProps {
  prospect: Prospect;
  followUps: AccountFollowUp[];
  completedFollowUps: AccountFollowUp[];
  dismissedFollowUps: AccountFollowUp[];
  calls: CallRecord[];
  emailLogs: EmailLog[];
  isRefreshing: boolean;
  onComplete: (id: string) => Promise<void> | void;
  onDismiss: (id: string) => Promise<void> | void;
  onReopen: (id: string) => Promise<void> | void;
  onRestore: (id: string) => Promise<void> | void;
  onRefresh: () => void;
}

export function ProspectFollowUps({
  prospect,
  followUps,
  completedFollowUps,
  dismissedFollowUps,
  calls,
  emailLogs,
  isRefreshing,
  onComplete,
  onDismiss,
  onReopen,
  onRestore,
  onRefresh,
}: ProspectFollowUpsProps) {
  const [isCompletedDialogOpen, setIsCompletedDialogOpen] = useState(false);
  const [isDismissedDialogOpen, setIsDismissedDialogOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const lastGeneratedAt = prospect.follow_ups_last_generated_at ? new Date(prospect.follow_ups_last_generated_at) : null;
  const latestCallDate = calls.length > 0 ? new Date(calls[0].call_date) : null;
  const latestEmailDate = emailLogs.length > 0 ? new Date(emailLogs[0].email_date) : null;
  
  const hasNewDataForFollowUps = lastGeneratedAt && (
    (latestCallDate && latestCallDate > lastGeneratedAt) ||
    (latestEmailDate && latestEmailDate > lastGeneratedAt)
  );

  return (
    <>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <Target className="h-5 w-5 text-primary" />
                <CardTitle className="flex items-center gap-2">
                  Suggested Follow-Up Steps
                  {hasNewDataForFollowUps && (
                    <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 text-xs">
                      New data available
                    </Badge>
                  )}
                  {followUps.length > 0 && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {followUps.length}
                    </Badge>
                  )}
                </CardTitle>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <div className="flex items-center gap-2">
              {dismissedFollowUps.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDismissedDialogOpen(true)}
                >
                  Dismissed ({dismissedFollowUps.length})
                </Button>
              )}
              {completedFollowUps.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCompletedDialogOpen(true)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Completed ({completedFollowUps.length})
                </Button>
              )}
              <Button
                variant={hasNewDataForFollowUps ? "default" : "outline"}
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
          {followUps.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-3">No follow-up steps yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate Follow-Up Steps
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {followUps.map((followUp) => (
                <FollowUpItem
                  key={followUp.id}
                  followUp={followUp}
                  onComplete={async (id) => { await onComplete(id); }}
                  onDismiss={async (id) => { await onDismiss(id); }}
                />
              ))}
            </div>
          )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <CompletedFollowUpsDialog
        open={isCompletedDialogOpen}
        onOpenChange={setIsCompletedDialogOpen}
        completedFollowUps={completedFollowUps}
        onReopen={async (id) => { await onReopen(id); }}
      />

      <DismissedFollowUpsDialog
        open={isDismissedDialogOpen}
        onOpenChange={setIsDismissedDialogOpen}
        dismissedFollowUps={dismissedFollowUps}
        onRestore={async (id) => { await onRestore(id); }}
      />
    </>
  );
}
