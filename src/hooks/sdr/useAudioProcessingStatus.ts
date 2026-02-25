import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { sdrKeys } from './keys';

const log = createLogger('audioProcessingStatus');

interface UseAudioProcessingStatusOptions {
  onComplete?: () => void;
  onError?: (error: string) => void;
}

interface UseAudioProcessingStatusReturn {
  status: string | null;
  error: string | null;
  isComplete: boolean;
  isError: boolean;
}

/**
 * Subscribes to Supabase Realtime for audio processing status updates.
 *
 * For `full_cycle` pipeline: watches `call_transcripts.analysis_status`.
 * For `sdr` pipeline: watches `sdr_daily_transcripts.processing_status`.
 *
 * Automatically cleans up the channel on unmount or when transcriptId changes.
 */
export function useAudioProcessingStatus(
  transcriptId: string | undefined,
  pipeline: 'full_cycle' | 'sdr',
  options?: UseAudioProcessingStatusOptions,
): UseAudioProcessingStatusReturn {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasNotifiedCompleteRef = useRef(false);
  const hasNotifiedErrorRef = useRef(false);

  // Store callbacks in refs to avoid re-subscribing on every render
  const onCompleteRef = useRef(options?.onComplete);
  const onErrorRef = useRef(options?.onError);
  onCompleteRef.current = options?.onComplete;
  onErrorRef.current = options?.onError;

  useEffect(() => {
    if (!transcriptId) return;

    // Reset state on new subscription
    setStatus(null);
    setError(null);
    hasNotifiedCompleteRef.current = false;
    hasNotifiedErrorRef.current = false;

    const table = pipeline === 'full_cycle' ? 'call_transcripts' : 'sdr_daily_transcripts';
    const statusColumn = pipeline === 'full_cycle' ? 'analysis_status' : 'processing_status';

    log.info('Setting up real-time subscription for audio processing', {
      transcriptId,
      pipeline,
      table,
    });

    const channel = supabase
      .channel(`audio-processing-${transcriptId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table,
          filter: `id=eq.${transcriptId}`,
        },
        (payload) => {
          const newRecord = payload.new as Record<string, unknown>;
          const newStatus = newRecord[statusColumn] as string;
          const processingError =
            (newRecord.processing_error as string | null) ??
            (newRecord.analysis_error as string | null) ??
            null;

          log.info('Received audio processing status update', {
            transcriptId,
            newStatus,
            processingError,
          });

          setStatus(newStatus);

          if (newStatus === 'completed' && !hasNotifiedCompleteRef.current) {
            hasNotifiedCompleteRef.current = true;
            setError(null);

            // Invalidate relevant queries
            if (pipeline === 'sdr') {
              queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
              queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
              queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
              queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
            }

            onCompleteRef.current?.();
          }

          if (
            (newStatus === 'error' || newStatus === 'failed') &&
            !hasNotifiedErrorRef.current
          ) {
            hasNotifiedErrorRef.current = true;
            const errorMessage = processingError || 'An unknown error occurred during processing.';
            setError(errorMessage);
            onErrorRef.current?.(errorMessage);
          }
        },
      )
      .subscribe((subscriptionStatus) => {
        log.info('Audio processing subscription status', { transcriptId, subscriptionStatus });
      });

    return () => {
      log.info('Cleaning up audio processing subscription', { transcriptId });
      supabase.removeChannel(channel);
    };
  }, [transcriptId, pipeline, queryClient]);

  return {
    status,
    error,
    isComplete: status === 'completed',
    isError: status === 'error' || status === 'failed',
  };
}
