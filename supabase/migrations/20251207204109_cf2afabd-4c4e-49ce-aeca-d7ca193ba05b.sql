-- Add new JSONB columns for multi-agent analysis pipeline (v2)
ALTER TABLE public.ai_call_analysis
ADD COLUMN IF NOT EXISTS analysis_metadata JSONB,
ADD COLUMN IF NOT EXISTS analysis_behavior JSONB,
ADD COLUMN IF NOT EXISTS analysis_strategy JSONB,
ADD COLUMN IF NOT EXISTS analysis_pipeline_version TEXT DEFAULT 'v1';

-- Add comment for documentation
COMMENT ON COLUMN public.ai_call_analysis.analysis_metadata IS 'Clerk agent output: metadata, participants, topics, user counts';
COMMENT ON COLUMN public.ai_call_analysis.analysis_behavior IS 'Referee agent output: behavioral scores and coaching tips';
COMMENT ON COLUMN public.ai_call_analysis.analysis_strategy IS 'Auditor agent output: strategic threading and MEDDPICC analysis';
COMMENT ON COLUMN public.ai_call_analysis.analysis_pipeline_version IS 'Analysis pipeline version (v1=legacy, v2=multi-agent)';