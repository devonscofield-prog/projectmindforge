-- Performance Alert Configuration Table
CREATE TABLE public.performance_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  alert_on_warning BOOLEAN DEFAULT false,
  alert_on_critical BOOLEAN DEFAULT true,
  cooldown_hours INTEGER DEFAULT 4,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Performance Alert History Table
CREATE TABLE public.performance_alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.performance_alert_config(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC,
  threshold_value NUMERIC,
  sent_at TIMESTAMPTZ DEFAULT now(),
  email_sent_to TEXT NOT NULL
);

-- Dashboard Cache Table
CREATE TABLE public.dashboard_cache (
  cache_key TEXT PRIMARY KEY,
  cache_data JSONB NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- Indexes
CREATE INDEX idx_performance_alert_history_sent_at ON public.performance_alert_history(sent_at DESC);
CREATE INDEX idx_performance_alert_config_user_id ON public.performance_alert_config(user_id);
CREATE INDEX idx_dashboard_cache_expires ON public.dashboard_cache(expires_at);

-- Enable RLS
ALTER TABLE public.performance_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alert_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies for performance_alert_config
CREATE POLICY "Admins can manage all alert configs"
ON public.performance_alert_config FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can manage own alert config"
ON public.performance_alert_config FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policies for performance_alert_history
CREATE POLICY "Admins can view all alert history"
ON public.performance_alert_history FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own alert history"
ON public.performance_alert_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.performance_alert_config pac
  WHERE pac.id = performance_alert_history.config_id
  AND pac.user_id = auth.uid()
));

-- RLS Policies for dashboard_cache (admins only for management, all auth users can read)
CREATE POLICY "Authenticated users can read cache"
ON public.dashboard_cache FOR SELECT
USING (true);

CREATE POLICY "Admins can manage cache"
ON public.dashboard_cache FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Update trigger for performance_alert_config
CREATE TRIGGER update_performance_alert_config_updated_at
BEFORE UPDATE ON public.performance_alert_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get or compute cached admin stats
CREATE OR REPLACE FUNCTION public.get_cached_admin_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_result JSONB;
  computed_result JSONB;
  user_count INTEGER;
  team_count INTEGER;
  call_count INTEGER;
  prospect_count INTEGER;
  admin_count INTEGER;
  manager_count INTEGER;
  rep_count INTEGER;
BEGIN
  -- Check cache
  SELECT cache_data INTO cached_result
  FROM public.dashboard_cache
  WHERE cache_key = 'admin_stats' AND expires_at > now();
  
  IF cached_result IS NOT NULL THEN
    RETURN cached_result;
  END IF;
  
  -- Compute fresh data
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  SELECT COUNT(*) INTO team_count FROM public.teams;
  SELECT COUNT(*) INTO call_count FROM public.call_transcripts;
  SELECT COUNT(*) INTO prospect_count FROM public.prospects;
  
  SELECT COUNT(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  SELECT COUNT(*) INTO manager_count FROM public.user_roles WHERE role = 'manager';
  SELECT COUNT(*) INTO rep_count FROM public.user_roles WHERE role = 'rep';
  
  computed_result := jsonb_build_object(
    'totalUsers', user_count,
    'totalTeams', team_count,
    'totalCalls', call_count,
    'totalProspects', prospect_count,
    'roleDistribution', jsonb_build_object(
      'admin', admin_count,
      'manager', manager_count,
      'rep', rep_count
    )
  );
  
  -- Store in cache
  INSERT INTO public.dashboard_cache (cache_key, cache_data, expires_at)
  VALUES ('admin_stats', computed_result, now() + interval '5 minutes')
  ON CONFLICT (cache_key) DO UPDATE SET
    cache_data = EXCLUDED.cache_data,
    computed_at = now(),
    expires_at = EXCLUDED.expires_at;
  
  RETURN computed_result;
END;
$$;

-- Function to get or compute cached prospect stats
CREATE OR REPLACE FUNCTION public.get_cached_prospect_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cached_result JSONB;
  computed_result JSONB;
  total_count INTEGER;
  active_count INTEGER;
  hot_count INTEGER;
  pipeline_value NUMERIC;
BEGIN
  -- Check cache
  SELECT cache_data INTO cached_result
  FROM public.dashboard_cache
  WHERE cache_key = 'prospect_stats' AND expires_at > now();
  
  IF cached_result IS NOT NULL THEN
    RETURN cached_result;
  END IF;
  
  -- Compute fresh data
  SELECT COUNT(*) INTO total_count FROM public.prospects;
  SELECT COUNT(*) INTO active_count FROM public.prospects WHERE status = 'active';
  SELECT COUNT(*) INTO hot_count FROM public.prospects WHERE status = 'active' AND heat_score >= 7;
  SELECT COALESCE(SUM(potential_revenue), 0) INTO pipeline_value FROM public.prospects WHERE status = 'active';
  
  computed_result := jsonb_build_object(
    'total', total_count,
    'active', active_count,
    'hotProspects', hot_count,
    'pipelineValue', pipeline_value
  );
  
  -- Store in cache
  INSERT INTO public.dashboard_cache (cache_key, cache_data, expires_at)
  VALUES ('prospect_stats', computed_result, now() + interval '5 minutes')
  ON CONFLICT (cache_key) DO UPDATE SET
    cache_data = EXCLUDED.cache_data,
    computed_at = now(),
    expires_at = EXCLUDED.expires_at;
  
  RETURN computed_result;
END;
$$;

-- Function to invalidate cache
CREATE OR REPLACE FUNCTION public.invalidate_cache(p_cache_key TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.dashboard_cache WHERE cache_key = p_cache_key;
END;
$$;

-- Function to cleanup expired cache entries
CREATE OR REPLACE FUNCTION public.cleanup_expired_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.dashboard_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Triggers to invalidate cache on data changes
CREATE OR REPLACE FUNCTION public.invalidate_admin_stats_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.dashboard_cache WHERE cache_key = 'admin_stats';
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.invalidate_prospect_stats_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.dashboard_cache WHERE cache_key = 'prospect_stats';
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Cache invalidation triggers
CREATE TRIGGER invalidate_admin_stats_on_profile_change
AFTER INSERT OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.invalidate_admin_stats_cache();

CREATE TRIGGER invalidate_admin_stats_on_team_change
AFTER INSERT OR DELETE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.invalidate_admin_stats_cache();

CREATE TRIGGER invalidate_admin_stats_on_call_change
AFTER INSERT OR DELETE ON public.call_transcripts
FOR EACH ROW EXECUTE FUNCTION public.invalidate_admin_stats_cache();

CREATE TRIGGER invalidate_prospect_stats_on_prospect_change
AFTER INSERT OR UPDATE OR DELETE ON public.prospects
FOR EACH ROW EXECUTE FUNCTION public.invalidate_prospect_stats_cache();