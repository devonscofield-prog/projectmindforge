-- Rename prospect_name to primary_stakeholder_name in call_transcripts table
ALTER TABLE public.call_transcripts 
RENAME COLUMN prospect_name TO primary_stakeholder_name;