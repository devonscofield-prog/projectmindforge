import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sdrKeys } from './keys';
import type { SDRCoachingPrompt } from './types';

interface UploadSDRTranscriptInput {
  rawText: string;
  transcriptDate?: string;
  sdrId?: string;
}

/** Simple string hash for deduplication (not cryptographic). */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const DEDUP_WINDOW_MS = 30_000;

export function useUploadSDRTranscript() {
  const queryClient = useQueryClient();
  const lastSubmit = useRef<{ hash: number; time: number } | null>(null);

  return useMutation({
    mutationFn: async ({ rawText, transcriptDate, sdrId }: UploadSDRTranscriptInput) => {
      const hash = simpleHash(rawText);
      const now = Date.now();
      if (
        lastSubmit.current &&
        lastSubmit.current.hash === hash &&
        now - lastSubmit.current.time < DEDUP_WINDOW_MS
      ) {
        throw new Error('Duplicate submission detected. Please wait before resubmitting the same transcript.');
      }
      lastSubmit.current = { hash, time: now };

      const { data, error } = await supabase.functions.invoke('sdr-process-transcript', {
        body: { raw_text: rawText, transcript_date: transcriptDate, sdr_id: sdrId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });

      if (variables.sdrId) {
        await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.bySdr(variables.sdrId) });
      } else {
        await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      }

      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Transcript uploaded and processing started');
    },
    onError: (error) => {
      toast.error('Failed to upload transcript: ' + (error as Error).message);
    },
  });
}

export function useRetrySDRTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transcriptId: string) => {
      const { data, error } = await supabase.functions.invoke('sdr-process-transcript', {
        body: { daily_transcript_id: transcriptId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, transcriptId) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.detail(transcriptId) });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Transcript reprocessing started');
    },
    onError: (error) => {
      toast.error('Failed to retry transcript: ' + (error as Error).message);
    },
  });
}

export function useReGradeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('sdr-grade-call', {
        body: { call_id: callId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: async (_data, callId) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.detail(callId) });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Call re-graded successfully');
    },
    onError: (error) => {
      toast.error('Failed to re-grade call: ' + (error as Error).message);
    },
  });
}

export function useUpdateCoachingPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SDRCoachingPrompt> & { id: string }) => {
      const { error } = await supabase
        .from('sdr_coaching_prompts')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.coachingPrompts.all() });
      toast.success('Coaching prompt updated');
    },
  });
}

export function useCreateCoachingPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      prompt: Omit<SDRCoachingPrompt, 'id' | 'created_at' | 'updated_at'>,
    ) => {
      const { error } = await supabase.from('sdr_coaching_prompts').insert(prompt);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.coachingPrompts.all() });
      toast.success('Coaching prompt created');
    },
  });
}
