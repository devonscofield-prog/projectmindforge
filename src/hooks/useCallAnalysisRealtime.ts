import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createLogger } from '@/lib/logger';
import { callDetailKeys } from '@/hooks/useCallDetailQueries';

const log = createLogger('callAnalysisRealtime');

/**
 * Subscribes to real-time updates for a call transcript's analysis status
 * AND to ai_call_analysis updates (for Deal Heat + follow-up suggestions).
 * When analysis completes or post-analysis artifacts are written, automatically
 * invalidates queries to refresh the UI.
 * 
 * @param callId - The call transcript ID to monitor
 * @param enabled - Whether to enable the subscription (typically when status is pending/processing)
 */
export function useCallAnalysisRealtime(
  callId: string | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();
  const hasShownAnalysisToastRef = useRef(false);
  const hasShownSuggestionsToastRef = useRef(false);

  useEffect(() => {
    if (!callId || !enabled) {
      hasShownAnalysisToastRef.current = false;
      hasShownSuggestionsToastRef.current = false;
      return;
    }

    log.info('Setting up real-time subscriptions for call analysis', { callId });

    const channel = supabase
      .channel(`call-analysis-${callId}`)
      // Subscribe to call_transcripts for analysis_status changes
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_transcripts',
          filter: `id=eq.${callId}`,
        },
        (payload) => {
          const newRecord = payload.new as { analysis_status: string; id: string };
          const oldRecord = payload.old as { analysis_status: string; id: string };

          log.info('Received real-time update for call_transcripts', {
            callId,
            oldStatus: oldRecord.analysis_status,
            newStatus: newRecord.analysis_status,
          });

          // Check if analysis just completed
          if (
            newRecord.analysis_status === 'completed' &&
            oldRecord.analysis_status !== 'completed' &&
            !hasShownAnalysisToastRef.current
          ) {
            hasShownAnalysisToastRef.current = true;
            log.info('Analysis completed, invalidating queries', { callId });

            toast.success('✅ Analysis complete!', {
              description: 'Loading your coaching insights...',
            });

            // Invalidate all call detail queries to trigger a refetch
            queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
            queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(callId) });
          }

          // Also handle error status
          if (
            newRecord.analysis_status === 'error' &&
            oldRecord.analysis_status !== 'error' &&
            !hasShownAnalysisToastRef.current
          ) {
            hasShownAnalysisToastRef.current = true;
            log.warn('Analysis failed', { callId });

            toast.error('Analysis encountered an issue', {
              description: 'You can retry the analysis from this page.',
            });

            // Still invalidate to show error state
            queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
            queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(callId) });
          }
        }
      )
      // Subscribe to ai_call_analysis for Deal Heat + suggestions updates
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_call_analysis',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const newRecord = payload.new as { 
            call_id: string; 
            deal_heat_analysis: unknown; 
            follow_up_suggestions: unknown[] | null;
          };

          log.info('Received real-time update for ai_call_analysis', {
            callId,
            hasDealHeat: !!newRecord.deal_heat_analysis,
            hasSuggestions: Array.isArray(newRecord.follow_up_suggestions) && newRecord.follow_up_suggestions.length > 0,
          });

          // Invalidate queries to pick up Deal Heat and suggestions
          queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
          queryClient.invalidateQueries({ queryKey: callDetailKeys.analysis(callId) });

          // Show suggestions toast once when they appear
          if (
            Array.isArray(newRecord.follow_up_suggestions) &&
            newRecord.follow_up_suggestions.length > 0 &&
            !hasShownSuggestionsToastRef.current
          ) {
            hasShownSuggestionsToastRef.current = true;
            toast.success('✨ Follow-up suggestions ready', {
              description: 'AI Advisor has generated recommended next steps.',
            });
          }
        }
      )
      .subscribe((status) => {
        log.info('Real-time subscription status', { callId, status });
      });

    return () => {
      log.info('Cleaning up real-time subscriptions', { callId });
      supabase.removeChannel(channel);
    };
  }, [callId, enabled, queryClient]);
}
