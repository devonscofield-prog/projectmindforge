-- Add deal_heat_analysis JSONB column to ai_call_analysis table
ALTER TABLE public.ai_call_analysis
ADD COLUMN deal_heat_analysis jsonb NULL;