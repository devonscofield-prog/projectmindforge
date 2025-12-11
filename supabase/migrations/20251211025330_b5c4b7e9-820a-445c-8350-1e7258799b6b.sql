-- Enable full row data in realtime updates (needed to see old.analysis_status)
ALTER TABLE public.call_transcripts REPLICA IDENTITY FULL;

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_transcripts;