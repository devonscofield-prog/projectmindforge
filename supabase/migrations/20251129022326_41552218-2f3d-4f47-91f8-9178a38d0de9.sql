-- Add new metadata columns to call_transcripts table
ALTER TABLE public.call_transcripts
ADD COLUMN prospect_name TEXT,
ADD COLUMN account_name TEXT,
ADD COLUMN salesforce_demo_link TEXT,
ADD COLUMN potential_revenue NUMERIC,
ADD COLUMN call_type TEXT DEFAULT 'first_demo',
ADD COLUMN call_type_other TEXT;