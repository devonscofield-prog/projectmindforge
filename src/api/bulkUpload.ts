import { supabase } from '@/integrations/supabase/client';
import { CallType } from '@/constants/callTypes';

// ============= Type Definitions =============

export interface BulkTranscriptItem {
  fileName: string;
  rawText: string;
  repId: string;
  callDate: string;
  callType: CallType;
  callTypeOther?: string;
  accountName: string;
  stakeholderName: string;
  salesforceLink?: string;
}

export interface BulkUploadResult {
  fileName: string;
  transcriptId?: string;
  status: 'success' | 'insert_failed' | 'analysis_queued' | 'analysis_failed';
  error?: string;
}

export interface BulkUploadResponse {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    analysisQueued: number;
    analysisFailed: number;
    insertFailed: number;
  };
  results: BulkUploadResult[];
}

export interface TranscriptStatus {
  id: string;
  fileName: string;
  analysis_status: 'pending' | 'processing' | 'completed' | 'error';
  analysis_error?: string | null;
  has_chunks: boolean;
  chunk_count: number;
}

// ============= API Functions =============

/**
 * Upload multiple transcripts via the bulk-upload-transcripts edge function
 */
export async function uploadBulkTranscripts(
  transcripts: BulkTranscriptItem[]
): Promise<BulkUploadResponse> {
  const { data, error } = await supabase.functions.invoke('bulk-upload-transcripts', {
    body: { transcripts }
  });

  if (error) {
    console.error('[bulkUpload] Edge function error:', error);
    throw new Error(error.message || 'Failed to upload transcripts');
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as BulkUploadResponse;
}

/**
 * Fetch status of uploaded transcripts (for polling after upload)
 */
export async function getTranscriptStatuses(
  transcriptIds: string[]
): Promise<TranscriptStatus[]> {
  if (!transcriptIds.length) return [];

  // Get transcript analysis status
  const { data: transcripts, error: transcriptError } = await supabase
    .from('call_transcripts')
    .select('id, analysis_status, analysis_error, account_name')
    .in('id', transcriptIds);

  if (transcriptError) {
    console.error('[bulkUpload] Failed to fetch transcript statuses:', transcriptError);
    throw transcriptError;
  }

  // Get chunk counts for each transcript
  const { data: chunkCounts, error: chunkError } = await supabase
    .from('transcript_chunks')
    .select('transcript_id')
    .in('transcript_id', transcriptIds);

  if (chunkError) {
    console.error('[bulkUpload] Failed to fetch chunk counts:', chunkError);
    // Don't throw - chunk data is supplementary
  }

  // Count chunks per transcript
  const chunkCountMap = new Map<string, number>();
  (chunkCounts || []).forEach(chunk => {
    const current = chunkCountMap.get(chunk.transcript_id) || 0;
    chunkCountMap.set(chunk.transcript_id, current + 1);
  });

  return (transcripts || []).map(t => ({
    id: t.id,
    fileName: t.account_name || 'Unknown',
    analysis_status: t.analysis_status,
    analysis_error: t.analysis_error,
    has_chunks: (chunkCountMap.get(t.id) || 0) > 0,
    chunk_count: chunkCountMap.get(t.id) || 0,
  }));
}
