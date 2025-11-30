-- Create performance_metrics table for tracking system performance
CREATE TABLE public.performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('query', 'edge_function', 'page_load')),
  metric_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'error', 'timeout')),
  user_id UUID,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_performance_metrics_created_at ON public.performance_metrics(created_at DESC);
CREATE INDEX idx_performance_metrics_type_name ON public.performance_metrics(metric_type, metric_name);
CREATE INDEX idx_performance_metrics_user_id ON public.performance_metrics(user_id);

-- Enable RLS
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Admins can read all metrics
CREATE POLICY "Admins can view all metrics"
ON public.performance_metrics
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Authenticated users can insert their own metrics
CREATE POLICY "Users can insert own metrics"
ON public.performance_metrics
FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can delete metrics (for cleanup)
CREATE POLICY "Admins can delete metrics"
ON public.performance_metrics
FOR DELETE
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create function to get aggregated performance stats
CREATE OR REPLACE FUNCTION public.get_performance_summary(
  p_hours INTEGER DEFAULT 1
)
RETURNS TABLE (
  metric_type TEXT,
  metric_name TEXT,
  avg_duration_ms NUMERIC,
  p50_duration_ms NUMERIC,
  p90_duration_ms NUMERIC,
  p99_duration_ms NUMERIC,
  total_count BIGINT,
  error_count BIGINT,
  error_rate NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    pm.metric_type,
    pm.metric_name,
    ROUND(AVG(pm.duration_ms)::NUMERIC, 2) as avg_duration_ms,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pm.duration_ms)::NUMERIC, 2) as p50_duration_ms,
    ROUND(PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY pm.duration_ms)::NUMERIC, 2) as p90_duration_ms,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY pm.duration_ms)::NUMERIC, 2) as p99_duration_ms,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE pm.status != 'success') as error_count,
    ROUND((COUNT(*) FILTER (WHERE pm.status != 'success')::NUMERIC / NULLIF(COUNT(*), 0) * 100), 2) as error_rate
  FROM public.performance_metrics pm
  WHERE pm.created_at > NOW() - (p_hours || ' hours')::INTERVAL
  GROUP BY pm.metric_type, pm.metric_name
  ORDER BY pm.metric_type, avg_duration_ms DESC
$$;

-- Create function to clean up old metrics (keep last 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_metrics()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.performance_metrics
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;