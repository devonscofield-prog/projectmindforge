import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';
import { callDetailKeys } from '@/hooks/useCallDetailQueries';

const log = createLogger('callAnalysisRealtime');

/**
 * Subscribes to real-time updates for a call transcript's analysis status.
 * When analysis completes, automatically invalidates queries to refresh the UI.
 * 
 * @param callId - The call transcript ID to monitor
 * @param enabled - Whether to enable the subscription (typically when status is pending/processing)
 */
export function useCallAnalysisRealtime(
  callId: string | undefined,
  enabled: boolean
) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const hasShownToastRef = useRef(false);

  useEffect(() => {
    if (!callId || !enabled) {
      hasShownToastRef.current = false;
      return;
    }

    log.info('Setting up real-time subscription for call analysis', { callId });

    const channel = supabase
      .channel(`call-analysis-${callId}`)
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

          log.info('Received real-time update for call', {
            callId,
            oldStatus: oldRecord.analysis_status,
            newStatus: newRecord.analysis_status,
          });

          // Check if analysis just completed
          if (
            newRecord.analysis_status === 'completed' &&
            oldRecord.analysis_status !== 'completed' &&
            !hasShownToastRef.current
          ) {
            hasShownToastRef.current = true;
            log.info('Analysis completed, invalidating queries', { callId });

            toast({
              title: '✅ Analysis complete!',
              description: 'Loading your coaching insights...',
            });

            // Invalidate all call detail queries to trigger a refetch
            queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
          }

          // Also handle error status
          if (
            newRecord.analysis_status === 'error' &&
            oldRecord.analysis_status !== 'error' &&
            !hasShownToastRef.current
          ) {
            hasShownToastRef.current = true;
            log.warn('Analysis failed', { callId });

            toast({
              title: 'Analysis encountered an issue',
              description: 'You can retry the analysis from this page.',
              variant: 'destructive',
            });

            // Still invalidate to show error state
            queryClient.invalidateQueries({ queryKey: callDetailKeys.call(callId) });
          }
        }
      )
      .subscribe((status) => {
        log.info('Real-time subscription status', { callId, status });
      });

    return () => {
      log.info('Cleaning up real-time subscription', { callId });
      supabase.removeChannel(channel);
    };
  }, [callId, enabled, queryClient, toast]);
}
