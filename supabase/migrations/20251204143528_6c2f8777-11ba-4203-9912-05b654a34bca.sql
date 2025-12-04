-- Phase 1: Migrate embedding column from vector(384) to vector(1536)
-- Phase 3: Clear stale embeddings in same transaction

-- Drop existing HNSW index (uses old dimension)
DROP INDEX IF EXISTS transcript_chunks_embedding_idx;

-- Clear all existing embeddings (they're 384-dim, incompatible with new schema)
UPDATE transcript_chunks SET embedding = NULL;

-- Alter column to new dimension (1536 for OpenAI text-embedding-3-small)
ALTER TABLE transcript_chunks 
ALTER COLUMN embedding TYPE vector(1536);

-- Recreate HNSW index with new dimension
CREATE INDEX transcript_chunks_embedding_idx 
ON transcript_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);