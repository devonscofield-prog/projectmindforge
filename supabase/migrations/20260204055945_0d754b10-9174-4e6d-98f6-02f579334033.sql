-- Add ai_call_analysis to realtime publication for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_call_analysis;

-- Set REPLICA IDENTITY to FULL for complete payload in realtime events
ALTER TABLE public.ai_call_analysis REPLICA IDENTITY FULL;