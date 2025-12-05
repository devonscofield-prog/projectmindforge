-- Composite index for aggregate coaching queries (rep_id + created_at range)
CREATE INDEX IF NOT EXISTS idx_ai_call_analysis_rep_created 
ON public.ai_call_analysis (rep_id, created_at DESC)
WHERE deleted_at IS NULL;

-- Index for coaching_trend_analyses cache lookups
CREATE INDEX IF NOT EXISTS idx_coaching_trend_analyses_lookup
ON public.coaching_trend_analyses (rep_id, date_range_from, date_range_to);

-- Index for dashboard_cache key lookups
CREATE INDEX IF NOT EXISTS idx_dashboard_cache_key_expires
ON public.dashboard_cache (cache_key, expires_at);