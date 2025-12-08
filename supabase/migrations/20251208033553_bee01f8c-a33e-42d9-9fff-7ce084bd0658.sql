-- Add analysis_coaching column for The Coach agent output
ALTER TABLE public.ai_call_analysis 
ADD COLUMN IF NOT EXISTS analysis_coaching jsonb;