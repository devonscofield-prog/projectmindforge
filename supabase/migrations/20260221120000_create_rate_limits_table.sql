-- Create rate_limits table for database-backed rate limiting across edge function instances
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for efficient cleanup of expired entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_window_start ON public.rate_limits (window_start);

-- Periodic cleanup: delete entries older than 5 minutes (covers all window sizes)
-- This can be called by a pg_cron job or manually
CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.rate_limits
  WHERE window_start < now() - INTERVAL '5 minutes';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Grant access to service role (edge functions use service role key)
GRANT ALL ON public.rate_limits TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limits() TO service_role;

-- RLS: Only service role should access this table
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- No RLS policies for authenticated users - only service_role bypasses RLS
