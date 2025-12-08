-- Add additional_speakers column for multi-speaker calls
ALTER TABLE public.call_transcripts 
ADD COLUMN IF NOT EXISTS additional_speakers text[] DEFAULT '{}';