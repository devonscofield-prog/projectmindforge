-- Add analysis_pricing column for Discount Analyst agent data
ALTER TABLE public.ai_call_analysis 
ADD COLUMN IF NOT EXISTS analysis_pricing JSONB DEFAULT NULL;