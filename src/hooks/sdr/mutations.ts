import { useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { sdrKeys } from './keys';
import type { SDRCoachingPrompt, SDRTranscriptListItem, SDRCallListItem } from './types';
import {
  createSDRTeam,
  updateSDRTeam,
  deleteSDRTeam,
  addSDRTeamMember,
  removeSDRTeamMember,
  generateTeamInviteLink,
  deactivateTeamInviteLink,
} from '@/api/sdrTeams';

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
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: sdrKeys.transcripts.all() });
      const listKey = sdrKeys.transcripts.list(variables.sdrId ? { sdrId: variables.sdrId } : {});
      const previous = queryClient.getQueryData<SDRTranscriptListItem[]>(listKey);

      const optimistic: SDRTranscriptListItem = {
        id: `optimistic-${Date.now()}`,
        sdr_id: variables.sdrId ?? '',
        transcript_date: variables.transcriptDate ?? new Date().toISOString().split('T')[0],
        processing_status: 'processing',
        processing_error: null,
        total_calls_detected: 0,
        meaningful_calls_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<SDRTranscriptListItem[]>(listKey, (old) =>
        [optimistic, ...(old ?? [])],
      );

      return { previous, listKey };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error('Failed to upload transcript: ' + (error as Error).message);
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
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
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
    onMutate: async (transcriptId) => {
      await queryClient.cancelQueries({ queryKey: sdrKeys.transcripts.detail(transcriptId) });
      const detailKey = sdrKeys.transcripts.detail(transcriptId);
      const previous = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (old: SDRTranscriptListItem | undefined) =>
        old ? { ...old, processing_status: 'processing' as const, processing_error: null } : old,
      );

      return { previous, detailKey };
    },
    onError: (error, _transcriptId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
      toast.error('Failed to retry transcript: ' + (error as Error).message);
    },
    onSuccess: async (_data, transcriptId) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.detail(transcriptId) });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Transcript reprocessing started');
    },
    onSettled: (_data, _error, transcriptId) => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.detail(transcriptId) });
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
    onMutate: async (callId) => {
      await queryClient.cancelQueries({ queryKey: sdrKeys.calls.detail(callId) });
      const detailKey = sdrKeys.calls.detail(callId);
      const previous = queryClient.getQueryData(detailKey);

      queryClient.setQueryData(detailKey, (old: SDRCallListItem | undefined) =>
        old ? { ...old, analysis_status: 'processing' as const, processing_error: null } : old,
      );

      return { previous, detailKey };
    },
    onError: (error, _callId, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.detailKey, context.previous);
      }
      toast.error('Failed to re-grade call: ' + (error as Error).message);
    },
    onSuccess: async (_data, callId) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.detail(callId) });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Call re-graded successfully');
    },
    onSettled: (_data, _error, callId) => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.calls.detail(callId) });
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

// ---------------------------------------------------------------------------
// Team management mutations
// ---------------------------------------------------------------------------

function invalidateTeamQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: sdrKeys.teams.all() });
  queryClient.invalidateQueries({ queryKey: sdrKeys.teams.members() });
}

export function useCreateSDRTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, managerId }: { name: string; managerId: string }) =>
      createSDRTeam(name, managerId),
    onSuccess: () => {
      invalidateTeamQueries(queryClient);
      toast.success('Team created');
    },
    onError: (error) => {
      toast.error('Failed to create team: ' + (error as Error).message);
    },
  });
}

export function useUpdateSDRTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, name, managerId }: { id: string; name: string; managerId: string }) =>
      updateSDRTeam(id, name, managerId),
    onSuccess: () => {
      invalidateTeamQueries(queryClient);
      toast.success('Team updated');
    },
    onError: (error) => {
      toast.error('Failed to update team: ' + (error as Error).message);
    },
  });
}

export function useDeleteSDRTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (teamId: string) => deleteSDRTeam(teamId),
    onSuccess: () => {
      invalidateTeamQueries(queryClient);
      toast.success('Team deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete team: ' + (error as Error).message);
    },
  });
}

export function useAddSDRTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      addSDRTeamMember(teamId, userId),
    onSuccess: () => {
      invalidateTeamQueries(queryClient);
      toast.success('Member added');
    },
    onError: (error) => {
      toast.error('Failed to add member: ' + (error as Error).message);
    },
  });
}

export function useRemoveSDRTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => removeSDRTeamMember(memberId),
    onSuccess: () => {
      invalidateTeamQueries(queryClient);
      toast.success('Member removed');
    },
    onError: (error) => {
      toast.error('Failed to remove member: ' + (error as Error).message);
    },
  });
}

// ---------------------------------------------------------------------------
// Team invite link mutations
// ---------------------------------------------------------------------------

export function useGenerateTeamInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      generateTeamInviteLink(teamId, userId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.teamInviteLinks(variables.teamId) });
      toast.success('Team signup link generated');
    },
    onError: (error) => {
      toast.error('Failed to generate link: ' + (error as Error).message);
    },
  });
}

export function useDeactivateTeamInviteLink() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ linkId }: { linkId: string; teamId: string }) =>
      deactivateTeamInviteLink(linkId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.teamInviteLinks(variables.teamId) });
      toast.success('Invite link deactivated');
    },
    onError: (error) => {
      toast.error('Failed to deactivate link: ' + (error as Error).message);
    },
  });
}

// ---------------------------------------------------------------------------
// Transcript delete mutation
// ---------------------------------------------------------------------------

export function useDeleteSDRTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transcriptId: string) => {
      const { error } = await supabase
        .from('sdr_daily_transcripts')
        .delete()
        .eq('id', transcriptId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Transcript deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete transcript: ' + (error as Error).message);
    },
  });
}
