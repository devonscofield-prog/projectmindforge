-- Remove duplicate chunks using DISTINCT ON approach
DELETE FROM transcript_chunks
WHERE id IN (
  SELECT id FROM (
    SELECT id, 
           ROW_NUMBER() OVER (PARTITION BY transcript_id, chunk_index ORDER BY created_at) as rn
    FROM transcript_chunks
  ) ranked
  WHERE rn > 1
);

-- Add unique constraint to prevent future duplicates
ALTER TABLE transcript_chunks 
ADD CONSTRAINT transcript_chunks_transcript_chunk_unique 
UNIQUE (transcript_id, chunk_index);