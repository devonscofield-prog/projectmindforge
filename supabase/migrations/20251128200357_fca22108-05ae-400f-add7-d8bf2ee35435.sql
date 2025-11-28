-- Add coach_output column to ai_call_analysis table for AI Call Coach module
ALTER TABLE public.ai_call_analysis
ADD COLUMN coach_output jsonb DEFAULT NULL;

COMMENT ON COLUMN public.ai_call_analysis.coach_output IS 'Structured AI Call Coach output including framework scores (BANT, Gap Selling, Active Listening), improvements, critical missing info, follow-up questions, and heat signature';