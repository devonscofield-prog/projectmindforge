-- Add rep-facing output columns to ai_call_analysis (idempotent)
DO $$
BEGIN
  -- Add call_notes column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_call_analysis' 
    AND column_name = 'call_notes'
  ) THEN
    ALTER TABLE public.ai_call_analysis ADD COLUMN call_notes text;
  END IF;

  -- Add recap_email_draft column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'ai_call_analysis' 
    AND column_name = 'recap_email_draft'
  ) THEN
    ALTER TABLE public.ai_call_analysis ADD COLUMN recap_email_draft text;
  END IF;
END $$;