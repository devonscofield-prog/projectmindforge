import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Query key factory for transcript-related queries
 * Following the established pattern from docs/REACT_QUERY_PATTERNS.md
 */
export const transcriptKeys = {
  all: ['transcripts'] as const,
  lists: () => [...transcriptKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...transcriptKeys.lists(), filters] as const,
  details: () => [...transcriptKeys.all, 'detail'] as const,
  detail: (id: string) => [...transcriptKeys.details(), id] as const,
  chunks: () => [...transcriptKeys.all, 'chunks'] as const,
  chunkStatus: (ids: string[]) => [...transcriptKeys.chunks(), 'status', ids.sort().join(',')] as const,
  ragHealth: () => [...transcriptKeys.all, 'rag-health'] as const,
  globalChunkStatus: () => [...transcriptKeys.chunks(), 'global-status'] as const,
};

export interface ChunkStatusResult {
  indexed: number;
  total: number;
}

export interface RagHealthStats {
  total_chunks: number;
  with_embeddings: number;
  ner_completed: number;
  ner_pending: number;
  ner_failed: number;
  avg_chunk_length: number;
  min_chunk_length: number;
  max_chunk_length: number;
  unique_transcripts: number;
  total_eligible_transcripts: number;
}

export interface GlobalChunkStatus {
  indexed: number;
  total: number;
  totalChunks: number;
  withEmbeddings: number;
  missingEmbeddings: number;
  nerCompleted: number;
  nerPending: number;
}

/**
 * Get chunk status for a list of transcript IDs using server-side aggregation
 * Uses the optimized get_chunk_status_for_transcripts function
 */
export function useChunkStatus(
  transcriptIds: string[],
  enabled = true
): UseQueryResult<ChunkStatusResult, Error> {
  return useQuery({
    queryKey: transcriptKeys.chunkStatus(transcriptIds),
    queryFn: async () => {
      if (!transcriptIds.length) return { indexed: 0, total: 0 };
      
      // Use the optimized RPC function for server-side counting
      const { data, error } = await (supabase.rpc as Function)(
        'get_chunk_status_for_transcripts',
        { transcript_ids: transcriptIds }
      );
      
      if (error) throw error;
      
      const result = data as { indexed_count: number; total_count: number };
      return {
        indexed: result.indexed_count || 0,
        total: result.total_count || transcriptIds.length,
      };
    },
    enabled: enabled && transcriptIds.length > 0,
    staleTime: 30 * 1000, // 30 seconds - chunk status can change during indexing
  });
}

/**
 * Get global RAG health statistics using server-side aggregation
 * Optimized to reduce data transfer from ~5MB to ~100 bytes
 */
export function useRagHealthStats(
  enabled = true
): UseQueryResult<GlobalChunkStatus, Error> {
  return useQuery({
    queryKey: transcriptKeys.ragHealth(),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as Function)('get_rag_health_stats');
      
      if (error) throw error;
      
      const stats = data as RagHealthStats;
      
      return {
        indexed: stats.unique_transcripts || 0,
        total: stats.total_eligible_transcripts || 0,
        totalChunks: stats.total_chunks || 0,
        withEmbeddings: stats.with_embeddings || 0,
        missingEmbeddings: (stats.total_chunks || 0) - (stats.with_embeddings || 0),
        nerCompleted: stats.ner_completed || 0,
        nerPending: stats.ner_pending || 0,
      };
    },
    enabled,
    staleTime: 2 * 60 * 1000, // 2 minutes - stats don't change frequently
  });
}

/**
 * Run maintenance analyze on key database tables
 * Admin only - updates query planner statistics
 */
export function useMaintenanceAnalyze(): UseQueryResult<{
  analyzed_at: string;
  tables_analyzed: number;
  tables: string[];
}, Error> {
  return useQuery({
    queryKey: ['maintenance', 'analyze'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as Function)('maintenance_analyze_tables');
      
      if (error) throw error;
      
      return data as {
        analyzed_at: string;
        tables_analyzed: number;
        tables: string[];
      };
    },
    enabled: false, // Only run manually via refetch
    staleTime: Infinity, // Never stale - manual operation
  });
}
