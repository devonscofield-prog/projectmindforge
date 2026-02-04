import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Sparkles, CheckCheck, X, Plus } from 'lucide-react';
import { SuggestionCard } from './SuggestionCard';
import { AddCustomTaskDialog } from './AddCustomTaskDialog';
import { supabase } from '@/integrations/supabase/client';
import { createManualFollowUp, type FollowUpPriority, type FollowUpCategory } from '@/api/accountFollowUps';
import { addDays, format } from 'date-fns';
import { createLogger } from '@/lib/logger';
import type { FollowUpSuggestion } from './types';

const log = createLogger('PostCallSuggestionsPanel');

interface PostCallSuggestionsPanelProps {
  callId: string;
  prospectId: string | null;
  repId: string;
  accountName: string | null;
  suggestions: FollowUpSuggestion[] | null;
  analysisId: string;
  onSuggestionsUpdated?: () => void;
}

export function PostCallSuggestionsPanel({
  callId,
  prospectId,
  repId,
  accountName,
  suggestions: initialSuggestions,
  analysisId,
  onSuggestionsUpdated,
}: PostCallSuggestionsPanelProps) {
  const queryClient = useQueryClient();
  const [suggestions, setSuggestions] = useState<FollowUpSuggestion[]>(initialSuggestions || []);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);

  // Filter to only show pending suggestions
  const pendingSuggestions = useMemo(() => 
    suggestions.filter(s => s.status === 'pending'),
    [suggestions]
  );

  // If no pending suggestions, don't render
  if (pendingSuggestions.length === 0) {
    return null;
  }

  const updateSuggestionsInDB = async (updatedSuggestions: FollowUpSuggestion[]) => {
    try {
      // Cast to unknown first then to any for Supabase JSONB compatibility
      const { error } = await supabase
        .from('ai_call_analysis')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({ follow_up_suggestions: updatedSuggestions as any })
        .eq('id', analysisId);
      
      if (error) throw error;
    } catch (error) {
      log.error('Failed to update suggestions in DB', { error });
    }
  };

  const handleAccept = async (suggestion: FollowUpSuggestion) => {
    if (!prospectId) {
      toast.error('Cannot create task', { description: 'This call is not linked to an account' });
      return;
    }

    setAcceptingId(suggestion.id);
    
    try {
      // Calculate due date from suggested_due_days
      const dueDate = suggestion.suggested_due_days !== null
        ? format(addDays(new Date(), suggestion.suggested_due_days), 'yyyy-MM-dd')
        : undefined;

      await createManualFollowUp({
        prospectId,
        repId,
        title: suggestion.title,
        description: suggestion.description,
        priority: suggestion.priority as FollowUpPriority,
        category: suggestion.category as FollowUpCategory,
        dueDate,
        reminderEnabled: suggestion.suggested_due_days !== null,
        sourceCallId: callId,
      });

      // Update local state
      const updated = suggestions.map(s => 
        s.id === suggestion.id ? { ...s, status: 'accepted' as const } : s
      );
      setSuggestions(updated);
      await updateSuggestionsInDB(updated);

      toast.success('Task created', { description: suggestion.title });
      
      // Invalidate follow-ups queries
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-follow-ups'] });
      onSuggestionsUpdated?.();
    } catch (error) {
      log.error('Failed to accept suggestion', { error, suggestion });
      toast.error('Failed to create task');
    } finally {
      setAcceptingId(null);
    }
  };

  const handleDismiss = async (suggestionId: string) => {
    const updated = suggestions.map(s => 
      s.id === suggestionId ? { ...s, status: 'dismissed' as const } : s
    );
    setSuggestions(updated);
    await updateSuggestionsInDB(updated);
    toast.info('Suggestion dismissed');
    onSuggestionsUpdated?.();
  };

  const handleAcceptAll = async () => {
    if (!prospectId) {
      toast.error('Cannot create tasks', { description: 'This call is not linked to an account' });
      return;
    }

    setIsAcceptingAll(true);
    let successCount = 0;

    try {
      for (const suggestion of pendingSuggestions) {
        try {
          const dueDate = suggestion.suggested_due_days !== null
            ? format(addDays(new Date(), suggestion.suggested_due_days), 'yyyy-MM-dd')
            : undefined;

          await createManualFollowUp({
            prospectId,
            repId,
            title: suggestion.title,
            description: suggestion.description,
            priority: suggestion.priority as FollowUpPriority,
            category: suggestion.category as FollowUpCategory,
            dueDate,
            reminderEnabled: suggestion.suggested_due_days !== null,
            sourceCallId: callId,
          });
          successCount++;
        } catch {
          log.warn('Failed to accept one suggestion', { id: suggestion.id });
        }
      }

      // Update all to accepted
      const updated = suggestions.map(s => 
        s.status === 'pending' ? { ...s, status: 'accepted' as const } : s
      );
      setSuggestions(updated);
      await updateSuggestionsInDB(updated);

      toast.success(`Created ${successCount} tasks`);
      queryClient.invalidateQueries({ queryKey: ['followUps'] });
      queryClient.invalidateQueries({ queryKey: ['prospect-follow-ups'] });
      onSuggestionsUpdated?.();
    } finally {
      setIsAcceptingAll(false);
    }
  };

  const handleDismissAll = async () => {
    setIsDismissingAll(true);
    try {
      const updated = suggestions.map(s => 
        s.status === 'pending' ? { ...s, status: 'dismissed' as const } : s
      );
      setSuggestions(updated);
      await updateSuggestionsInDB(updated);
      toast.info('All suggestions dismissed');
      onSuggestionsUpdated?.();
    } finally {
      setIsDismissingAll(false);
    }
  };

  return (
    <>
      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Suggested Follow-Up Actions</CardTitle>
                <CardDescription>
                  AI-generated based on your call with {accountName || 'this account'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Prominent Add Task Button */}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAddTaskDialog(true)}
                className="bg-primary/10 hover:bg-primary/20 text-primary border-primary/30 border"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Task
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissAll}
                disabled={isAcceptingAll || isDismissingAll}
              >
                <X className="h-4 w-4 mr-1" />
                Dismiss All
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleAcceptAll}
                disabled={isAcceptingAll || isDismissingAll}
              >
                {isAcceptingAll ? (
                  <span className="animate-pulse">Creating...</span>
                ) : (
                  <>
                    <CheckCheck className="h-4 w-4 mr-1" />
                    Accept All
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingSuggestions.map(suggestion => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
              isAccepting={acceptingId === suggestion.id}
            />
          ))}

          {/* Secondary entry point at bottom */}
          <button
            onClick={() => setShowAddTaskDialog(true)}
            className="w-full text-center text-sm text-muted-foreground hover:text-primary transition-colors py-2"
          >
            <Plus className="h-3 w-3 inline mr-1" />
            or add your own task
          </button>
        </CardContent>
      </Card>

      {/* Add Custom Task Dialog */}
      <AddCustomTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        callId={callId}
        prospectId={prospectId}
        repId={repId}
        accountName={accountName}
        onTaskCreated={() => {
          queryClient.invalidateQueries({ queryKey: ['followUps'] });
          queryClient.invalidateQueries({ queryKey: ['prospect-follow-ups'] });
        }}
      />
    </>
  );
}

// Loading skeleton for when suggestions are being generated
export function PostCallSuggestionsSkeleton() {
  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          </div>
          <div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
