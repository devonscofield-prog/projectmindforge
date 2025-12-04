-- Create efficient aggregation function for RAG health stats
-- This replaces client-side data processing with server-side aggregation
-- Reduces data transfer from 5-10MB to ~100 bytes

CREATE OR REPLACE FUNCTION public.get_rag_health_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'total_chunks', COUNT(*),
    'with_embeddings', COUNT(*) FILTER (WHERE embedding IS NOT NULL),
    'ner_completed', COUNT(*) FILTER (WHERE extraction_status = 'completed'),
    'ner_pending', COUNT(*) FILTER (WHERE extraction_status = 'pending' OR extraction_status IS NULL),
    'ner_failed', COUNT(*) FILTER (WHERE extraction_status = 'failed'),
    'avg_chunk_length', COALESCE(ROUND(AVG(LENGTH(chunk_text))), 0),
    'min_chunk_length', COALESCE(MIN(LENGTH(chunk_text)), 0),
    'max_chunk_length', COALESCE(MAX(LENGTH(chunk_text)), 0),
    'unique_transcripts', COUNT(DISTINCT transcript_id),
    'total_eligible_transcripts', (
      SELECT COUNT(*) 
      FROM call_transcripts 
      WHERE analysis_status IN ('completed', 'skipped') 
        AND deleted_at IS NULL
    )
  )
  FROM transcript_chunks
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_rag_health_stats() TO authenticated;

-- Create index to speed up transcript_chunks aggregation queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_extraction_status 
ON transcript_chunks(extraction_status);

-- Create index for embedding null check
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_embedding_not_null 
ON transcript_chunks(transcript_id) 
WHERE embedding IS NOT NULL;