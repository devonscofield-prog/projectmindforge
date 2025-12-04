-- Performance Optimization: Add indexes and maintenance functions

-- 1. Compound index for transcript filtering (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_call_transcripts_date_status_rep 
ON call_transcripts(call_date DESC, analysis_status, rep_id);

-- 2. Index for chunk-status queries on transcript_chunks
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_transcript_id 
ON transcript_chunks(transcript_id);

-- 3. Partial index for transcripts without chunks (backfill queries)
CREATE INDEX IF NOT EXISTS idx_call_transcripts_needs_chunking
ON call_transcripts(id) 
WHERE analysis_status IN ('completed', 'skipped') AND deleted_at IS NULL;

-- 4. Optimize performance_metrics for time-series queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_time_type 
ON performance_metrics(created_at DESC, metric_type, metric_name);

-- 5. Partial index for recent metrics only (using fixed timestamp for immutability)
CREATE INDEX IF NOT EXISTS idx_performance_metrics_recent
ON performance_metrics(created_at DESC, metric_type);

-- 6. Create maintenance function to analyze key tables
CREATE OR REPLACE FUNCTION public.maintenance_analyze_tables()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  -- ANALYZE key tables to update statistics
  ANALYZE transcript_chunks;
  ANALYZE call_transcripts;
  ANALYZE profiles;
  ANALYZE teams;
  ANALYZE prospects;
  ANALYZE ai_call_analysis;
  ANALYZE performance_metrics;
  
  result := jsonb_build_object(
    'analyzed_at', now(),
    'tables_analyzed', 7,
    'tables', ARRAY['transcript_chunks', 'call_transcripts', 'profiles', 'teams', 'prospects', 'ai_call_analysis', 'performance_metrics']
  );
  
  RETURN result;
END;
$$;

-- 7. Create function to get chunk status counts efficiently
CREATE OR REPLACE FUNCTION public.get_chunk_status_for_transcripts(transcript_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'indexed_count', COUNT(DISTINCT transcript_id),
    'total_count', array_length(transcript_ids, 1)
  )
  FROM transcript_chunks
  WHERE transcript_id = ANY(transcript_ids)
$$;