import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createLogger } from '@/lib/logger';
import { getCallsForProspect } from '@/api/prospects';
import type { CallRecord } from './types';

const log = createLogger('prospectRealtime');

interface UseProspectRealtimeOptions {
  prospectId: string | undefined;
  onCallsUpdate: (calls: CallRecord[]) => void;
  onAnalysisComplete: () => void;
}

export function useProspectRealtime({
  prospectId,
  onCallsUpdate,
  onAnalysisComplete,
}: UseProspectRealtimeOptions) {
  const { toast } = useToast();
  const onAnalysisCompleteRef = useRef(onAnalysisComplete);

  // Keep ref updated
  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete;
  }, [onAnalysisComplete]);

  useEffect(() => {
    if (!prospectId) return;

    const channel = supabase
      .channel(`call-analysis-${prospectId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'call_transcripts',
          filter: `prospect_id=eq.${prospectId}`,
        },
        (payload) => {
          const newRecord = payload.new as { analysis_status: string; id: string };
          const oldRecord = payload.old as { analysis_status: string; id: string };
          
          if (
            newRecord.analysis_status === 'completed' &&
            oldRecord.analysis_status !== 'completed'
          ) {
            log.info('Call analysis completed, refreshing AI data...');
            toast({ title: 'New call analysis available, refreshing insights...' });
            
            // Refresh calls
            getCallsForProspect(prospectId).then(onCallsUpdate);
            
            // Trigger full refresh after a delay
            setTimeout(() => {
              onAnalysisCompleteRef.current();
            }, 1000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [prospectId, toast, onCallsUpdate]);
}
