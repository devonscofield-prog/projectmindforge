
-- 1. Remove permissive INSERT policies (edge functions use service_role which bypasses RLS)
DROP POLICY IF EXISTS "Service can insert notifications" ON public.in_app_notifications;
DROP POLICY IF EXISTS "Service can insert notification log" ON public.notification_log;
DROP POLICY IF EXISTS "Users can insert own metrics" ON public.performance_metrics;

-- Replace performance_metrics insert with strict owner-only policy
CREATE POLICY "Users can insert own metrics"
  ON public.performance_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 2. Add explicit deny-all policies on service-only tables for defense in depth
-- (service_role bypasses RLS regardless)
CREATE POLICY "No client access to rate_limits"
  ON public.rate_limits
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE POLICY "No client access to dashboard_cache"
  ON public.dashboard_cache
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- 3. Recreate user_with_role view with explicit security_invoker
DROP VIEW IF EXISTS public.user_with_role;
CREATE VIEW public.user_with_role
  WITH (security_invoker = true) AS
SELECT p.id, p.name, p.email, p.team_id, p.hire_date, p.is_active,
       p.created_at, p.updated_at, ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id;

GRANT SELECT ON public.user_with_role TO authenticated;

-- 4. Revoke EXECUTE from anon/authenticated on internal maintenance & trigger functions
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_cache() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_devices() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_activity_logs() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_old_metrics() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.maintenance_analyze_tables() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invalidate_cache(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invalidate_admin_stats_cache() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.invalidate_prospect_stats_cache() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_analysis_on_insert() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_prospect_last_contact_date() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recover_stuck_processing_transcripts() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recover_stuck_roleplay_sessions(integer) FROM anon, authenticated, PUBLIC;

-- Revoke anon EXECUTE on remaining SECURITY DEFINER functions
-- (authenticated retains access; these are called from the app)
REVOKE EXECUTE ON FUNCTION public.can_access_historical_data(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_device_trusted(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_best_chunks(extensions.vector, text, jsonb, text[], text[], uuid[], integer, double precision, double precision, double precision) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.find_product_knowledge(extensions.vector, text, text[], text[], integer, double precision, double precision) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fuzzy_match_prospects(text[], double precision) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fuzzy_match_stakeholders(text[], double precision) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_prospects_with_call_counts(text, uuid, uuid, text, text, integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_admin_transcripts(date, date, uuid[], text[], text, text[], integer, integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cached_admin_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_cached_prospect_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_chunk_status_for_transcripts(uuid[]) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_performance_summary(integer) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_product_knowledge_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_rag_health_stats() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, user_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_manager_of_user(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_sdr_manager_of(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_data_access(text, uuid, text, text, jsonb) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) FROM anon, PUBLIC;
