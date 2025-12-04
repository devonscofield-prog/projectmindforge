-- 1. Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Add new columns
ALTER TABLE public.transcript_chunks 
ADD COLUMN IF NOT EXISTS embedding vector(384),
ADD COLUMN IF NOT EXISTS entities jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS meddpicc_elements text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS extraction_status text DEFAULT 'pending';

-- 3. Create optimized indexes
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_embedding 
ON public.transcript_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_entities 
ON public.transcript_chunks USING gin (entities);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_topics 
ON public.transcript_chunks USING gin (topics);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_meddpicc 
ON public.transcript_chunks USING gin (meddpicc_elements);

CREATE INDEX IF NOT EXISTS idx_transcript_chunks_extraction_status 
ON public.transcript_chunks (extraction_status);

-- 4. Create unified hybrid search function (find_best_chunks)
CREATE OR REPLACE FUNCTION find_best_chunks(
  query_embedding vector(384) DEFAULT NULL,
  query_text text DEFAULT NULL,
  search_entities jsonb DEFAULT '{}',
  search_topics text[] DEFAULT '{}',
  search_meddpicc text[] DEFAULT '{}',
  filter_transcript_ids uuid[] DEFAULT NULL,
  match_count int DEFAULT 100,
  weight_vector float DEFAULT 0.5,
  weight_fts float DEFAULT 0.3,
  weight_entity float DEFAULT 0.2
)
RETURNS TABLE (
  id uuid,
  transcript_id uuid,
  chunk_index int,
  chunk_text text,
  metadata jsonb,
  entities jsonb,
  topics text[],
  meddpicc_elements text[],
  relevance_score float,
  vector_score float,
  fts_score float,
  entity_score float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scored_chunks AS (
    SELECT
      tc.id,
      tc.transcript_id,
      tc.chunk_index,
      tc.chunk_text,
      tc.metadata,
      tc.entities,
      tc.topics,
      tc.meddpicc_elements,
      CASE 
        WHEN query_embedding IS NOT NULL AND tc.embedding IS NOT NULL 
        THEN 1 - (tc.embedding <=> query_embedding)
        ELSE 0 
      END as v_score,
      CASE 
        WHEN query_text IS NOT NULL AND query_text != '' 
        THEN ts_rank(tc.search_vector, websearch_to_tsquery('english', query_text))
        ELSE 0 
      END as f_score,
      (
        COALESCE(array_length(tc.topics & search_topics, 1), 0)::float / 
          GREATEST(COALESCE(array_length(search_topics, 1), 0), 1)::float * 0.4
        +
        COALESCE(array_length(tc.meddpicc_elements & search_meddpicc, 1), 0)::float / 
          GREATEST(COALESCE(array_length(search_meddpicc, 1), 0), 1)::float * 0.4
        +
        CASE WHEN search_entities != '{}'::jsonb AND tc.entities @> search_entities THEN 0.2 ELSE 0 END
      ) as e_score
    FROM public.transcript_chunks tc
    WHERE 
      (filter_transcript_ids IS NULL OR tc.transcript_id = ANY(filter_transcript_ids))
      AND (
        search_topics IS NULL 
        OR array_length(search_topics, 1) IS NULL 
        OR tc.topics && search_topics
      )
      AND (
        search_meddpicc IS NULL 
        OR array_length(search_meddpicc, 1) IS NULL 
        OR tc.meddpicc_elements && search_meddpicc
      )
  )
  SELECT 
    sc.id,
    sc.transcript_id,
    sc.chunk_index,
    sc.chunk_text,
    sc.metadata,
    sc.entities,
    sc.topics,
    sc.meddpicc_elements,
    (weight_vector * sc.v_score + weight_fts * sc.f_score + weight_entity * sc.e_score) as relevance_score,
    sc.v_score as vector_score,
    sc.f_score as fts_score,
    sc.e_score as entity_score
  FROM scored_chunks sc
  WHERE (sc.v_score > 0 OR sc.f_score > 0 OR sc.e_score > 0)
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$;