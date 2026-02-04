-- Drop duplicate foreign key constraints on ai_call_analysis
-- Keep the canonical ones: ai_call_analysis_call_id_fkey and ai_call_analysis_rep_id_fkey

ALTER TABLE public.ai_call_analysis 
DROP CONSTRAINT IF EXISTS fk_ai_call_analysis_call_id;

ALTER TABLE public.ai_call_analysis 
DROP CONSTRAINT IF EXISTS fk_ai_call_analysis_rep_id;