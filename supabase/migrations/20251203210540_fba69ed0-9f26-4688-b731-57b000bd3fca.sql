-- Add GIN index for efficient array containment queries on transcript_ids
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_transcript_ids 
ON analysis_sessions USING GIN (transcript_ids);