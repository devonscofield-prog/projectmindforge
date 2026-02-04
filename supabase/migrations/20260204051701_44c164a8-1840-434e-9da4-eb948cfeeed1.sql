-- Add follow_up_suggestions column to ai_call_analysis for storing AI-generated follow-up suggestions
ALTER TABLE ai_call_analysis 
ADD COLUMN follow_up_suggestions JSONB DEFAULT NULL;

-- Add suggestions_reviewed_at column to call_transcripts for tracking when user has reviewed suggestions
ALTER TABLE call_transcripts 
ADD COLUMN suggestions_reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN ai_call_analysis.follow_up_suggestions IS 'AI-generated follow-up suggestions with timing recommendations';
COMMENT ON COLUMN call_transcripts.suggestions_reviewed_at IS 'Timestamp when user reviewed/dismissed AI follow-up suggestions';