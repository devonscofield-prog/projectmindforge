-- Add sales_assets JSONB column to ai_call_analysis for persisting generated recap emails and CRM notes
ALTER TABLE public.ai_call_analysis 
ADD COLUMN IF NOT EXISTS sales_assets JSONB;

-- Add timestamp for when assets were generated
ALTER TABLE public.ai_call_analysis 
ADD COLUMN IF NOT EXISTS sales_assets_generated_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN public.ai_call_analysis.sales_assets IS 'Persisted sales assets including recap email (subject_line, email_body) and internal_notes_markdown';