CREATE TABLE public.rate_limits (
  key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Service-role only access, no public RLS policies needed
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;