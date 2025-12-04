-- Drop duplicate HNSW index (keeping transcript_chunks_embedding_idx)
DROP INDEX IF EXISTS idx_transcript_chunks_embedding;