-- Enable required extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Enable realtime for performance_metrics table
ALTER TABLE public.performance_metrics REPLICA IDENTITY FULL;

-- Add table to realtime publication (only if not already added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'performance_metrics'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.performance_metrics;
  END IF;
END $$;