-- Update the cached prospect stats function to use 0-100 scale for hot prospects
CREATE OR REPLACE FUNCTION public.get_cached_prospect_stats()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Changed from heat_score >= 7 to heat_score >= 70 for 0-100 scale
  SELECT COUNT(*) INTO hot_count FROM public.prospects WHERE status = 'active' AND heat_score >= 70;
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
$function$;