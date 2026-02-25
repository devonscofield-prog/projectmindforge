import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { sdrKeys } from './keys';
import type { SDRTranscriptListItem } from './types';
import type {
  AudioUploadInput,
  AudioUploadProgressCallback,
  VoiceAnalysisResult,
  VoiceUsageQuota,
  VoiceUsageAdminOverview,
  UpdateVoiceQuotaInput,
} from '@/types/audioAnalysis';
import {
  uploadAudioFile,
  getAudioAnalysis,
  getAudioSignedUrl,
  getVoiceUsageQuota,
  getVoiceUsageAdmin,
  updateVoiceQuota,
} from '@/api/audioAnalysis';

// ---------------------------------------------------------------------------
// Upload mutation
// ---------------------------------------------------------------------------

interface UploadAudioInput extends AudioUploadInput {
  onProgress?: AudioUploadProgressCallback;
}

/** Simple hash for deduplication (same pattern as useUploadSDRTranscript). */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const DEDUP_WINDOW_MS = 30_000;

/**
 * Mutation hook for uploading audio files.
 * Follows the exact pattern of useUploadSDRTranscript: optimistic updates,
 * deduplication, cache invalidation, and toast feedback.
 */
export function useUploadAudio() {
  const queryClient = useQueryClient();
  const lastSubmit = useRef<{ hash: number; time: number } | null>(null);

  return useMutation({
    mutationFn: async ({ onProgress, ...input }: UploadAudioInput) => {
      // Dedup by file name + size + call date
      const dedupKey = `${input.file.name}:${input.file.size}:${input.callDate}`;
      const hash = simpleHash(dedupKey);
      const now = Date.now();
      if (
        lastSubmit.current &&
        lastSubmit.current.hash === hash &&
        now - lastSubmit.current.time < DEDUP_WINDOW_MS
      ) {
        throw new Error(
          'Duplicate submission detected. Please wait before resubmitting the same audio file.',
        );
      }
      lastSubmit.current = { hash, time: now };

      return uploadAudioFile(input, onProgress);
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: sdrKeys.transcripts.all() });
      const listKey = sdrKeys.transcripts.list(
        variables.sdrId ? { sdrId: variables.sdrId } : {},
      );
      const previous = queryClient.getQueryData<SDRTranscriptListItem[]>(listKey);

      const optimistic: SDRTranscriptListItem = {
        id: `optimistic-audio-${Date.now()}`,
        sdr_id: variables.sdrId ?? '',
        transcript_date: variables.callDate ?? new Date().toISOString().split('T')[0],
        processing_status: 'processing',
        processing_error: null,
        total_calls_detected: 0,
        meaningful_calls_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<SDRTranscriptListItem[]>(listKey, (old) => [
        optimistic,
        ...(old ?? []),
      ]);

      return { previous, listKey };
    },
    onError: (error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.listKey, context.previous);
      }
      toast.error('Failed to upload audio: ' + (error as Error).message);
    },
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.calls.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.audio.all() });
      await queryClient.invalidateQueries({ queryKey: sdrKeys.voiceQuota.all() });

      if (variables.sdrId) {
        await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.bySdr(variables.sdrId) });
      } else {
        await queryClient.invalidateQueries({ queryKey: sdrKeys.stats.all() });
      }

      await queryClient.invalidateQueries({ queryKey: sdrKeys.teamGradeSummary.all() });
      toast.success('Audio uploaded — transcription and analysis started');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: sdrKeys.transcripts.all() });
    },
  });
}

// ---------------------------------------------------------------------------
// Audio analysis query
// ---------------------------------------------------------------------------

/**
 * Query hook for fetching voice analysis data for a given transcript/call.
 * Polls every 5 seconds while analysis is still processing.
 */
export function useAudioAnalysis(transcriptId: string | undefined) {
  return useQuery({
    queryKey: transcriptId
      ? sdrKeys.audio.analysis(transcriptId)
      : [...sdrKeys.audio.all(), 'analysis', 'none'],
    queryFn: async (): Promise<VoiceAnalysisResult | null> => {
      if (!transcriptId) return null;
      return getAudioAnalysis(transcriptId);
    },
    enabled: !!transcriptId,
    refetchInterval: (query) => {
      const data = query.state.data as VoiceAnalysisResult | null | undefined;
      if (!data) return false;
      // Keep polling while still processing
      const processingStages = ['uploading', 'uploaded', 'transcribing', 'transcribed', 'analyzing_text', 'analyzing_voice'];
      return processingStages.includes(data.processing_stage) ? 5_000 : false;
    },
    staleTime: 15_000,
    gcTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Audio signed URL query
// ---------------------------------------------------------------------------

/**
 * Query hook for getting a signed URL for audio playback.
 * Uses a 50-minute stale time since signed URLs are valid for 60 minutes.
 */
export function useAudioSignedUrl(audioPath: string | undefined | null) {
  return useQuery({
    queryKey: audioPath
      ? sdrKeys.audio.signedUrl(audioPath)
      : [...sdrKeys.audio.all(), 'signed-url', 'none'],
    queryFn: async (): Promise<string | null> => {
      if (!audioPath) return null;
      return getAudioSignedUrl(audioPath);
    },
    enabled: !!audioPath,
    staleTime: 50 * 60 * 1000, // 50 minutes (URL valid for 60)
    gcTime: 55 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Voice usage quota query
// ---------------------------------------------------------------------------

/**
 * Query hook for the current user's voice analysis usage and limits.
 */
export function useVoiceUsageQuota(userId: string | undefined) {
  return useQuery({
    queryKey: userId
      ? sdrKeys.voiceQuota.byUser(userId)
      : [...sdrKeys.voiceQuota.all(), 'user', 'none'],
    queryFn: async (): Promise<VoiceUsageQuota | null> => {
      if (!userId) return null;
      return getVoiceUsageQuota(userId);
    },
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Admin: voice usage overview query
// ---------------------------------------------------------------------------

/**
 * Admin query hook for all users' voice analysis quotas.
 */
export function useVoiceUsageAdmin() {
  return useQuery({
    queryKey: sdrKeys.voiceQuota.adminOverview(),
    queryFn: async (): Promise<VoiceUsageAdminOverview> => {
      return getVoiceUsageAdmin();
    },
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Admin: update voice quota mutation
// ---------------------------------------------------------------------------

/**
 * Admin mutation hook for updating voice analysis limits.
 */
export function useUpdateVoiceQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateVoiceQuotaInput) => {
      return updateVoiceQuota(input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: sdrKeys.voiceQuota.all() });
      toast.success('Voice quota updated');
    },
    onError: (error) => {
      toast.error('Failed to update voice quota: ' + (error as Error).message);
    },
  });
}
