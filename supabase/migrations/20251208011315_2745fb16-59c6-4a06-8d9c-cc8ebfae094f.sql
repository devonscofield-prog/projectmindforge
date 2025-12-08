-- Add analysis_psychology column to ai_call_analysis table for storing prospect psychological profiling data
ALTER TABLE public.ai_call_analysis 
ADD COLUMN IF NOT EXISTS analysis_psychology JSONB;