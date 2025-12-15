-- Add is_unqualified boolean column to call_transcripts table
ALTER TABLE public.call_transcripts 
ADD COLUMN is_unqualified boolean DEFAULT false;