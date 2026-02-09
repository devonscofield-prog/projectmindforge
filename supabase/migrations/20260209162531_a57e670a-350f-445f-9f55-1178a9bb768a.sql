
-- =============================================
-- Restore RLS policies lost during trainee role removal
-- =============================================

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;
CREATE POLICY "Managers can view team profiles" ON public.profiles FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM public.teams t WHERE t.manager_id = auth.uid() AND t.id = profiles.team_id
  )
);

-- ============ USER_ROLES ============
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============ CALL_TRANSCRIPTS ============
DROP POLICY IF EXISTS "Admins can manage all transcripts" ON public.call_transcripts;
CREATE POLICY "Admins can manage all transcripts" ON public.call_transcripts FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team transcripts" ON public.call_transcripts;
CREATE POLICY "Managers can view team transcripts" ON public.call_transcripts FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id) AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Admins can view deleted transcripts" ON public.call_transcripts;
CREATE POLICY "Admins can view deleted transcripts" ON public.call_transcripts FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND deleted_at IS NOT NULL
);

-- ============ AI_CALL_ANALYSIS ============
DROP POLICY IF EXISTS "Admins can view all analysis" ON public.ai_call_analysis;
CREATE POLICY "Admins can view all analysis" ON public.ai_call_analysis FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team analysis" ON public.ai_call_analysis;
CREATE POLICY "Managers can view team analysis" ON public.ai_call_analysis FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id) AND deleted_at IS NULL
);

-- ============ EMAIL_LOGS ============
DROP POLICY IF EXISTS "Admins can manage all email logs" ON public.email_logs;
CREATE POLICY "Admins can manage all email logs" ON public.email_logs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team email logs" ON public.email_logs;
CREATE POLICY "Managers can view team email logs" ON public.email_logs FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id) AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Admins can view deleted email logs" ON public.email_logs;
CREATE POLICY "Admins can view deleted email logs" ON public.email_logs FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND deleted_at IS NOT NULL
);

-- ============ PROSPECTS ============
DROP POLICY IF EXISTS "Admins can manage all prospects" ON public.prospects;
CREATE POLICY "Admins can manage all prospects" ON public.prospects FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team prospects" ON public.prospects;
CREATE POLICY "Managers can view team prospects" ON public.prospects FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id) AND deleted_at IS NULL
);

DROP POLICY IF EXISTS "Admins can view deleted prospects" ON public.prospects;
CREATE POLICY "Admins can view deleted prospects" ON public.prospects FOR SELECT USING (
  has_role(auth.uid(), 'admin') AND deleted_at IS NOT NULL
);

-- ============ TEAMS ============
DROP POLICY IF EXISTS "Admins can manage all teams" ON public.teams;
CREATE POLICY "Admins can manage all teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============ COACHING_SESSIONS ============
DROP POLICY IF EXISTS "Admins can manage all coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Admins can manage all coaching sessions" ON public.coaching_sessions FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view own coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Managers can view own coaching sessions" ON public.coaching_sessions FOR SELECT USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "Managers can insert coaching sessions" ON public.coaching_sessions;
CREATE POLICY "Managers can insert coaching sessions" ON public.coaching_sessions FOR INSERT WITH CHECK (auth.uid() = manager_id);

-- ============ ACCOUNT_FOLLOW_UPS ============
DROP POLICY IF EXISTS "Admins can manage all follow-ups" ON public.account_follow_ups;
CREATE POLICY "Admins can manage all follow-ups" ON public.account_follow_ups FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team follow-ups" ON public.account_follow_ups;
CREATE POLICY "Managers can view team follow-ups" ON public.account_follow_ups FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id)
);

-- ============ PROSPECT_ACTIVITIES ============
DROP POLICY IF EXISTS "Admins can manage all prospect activities" ON public.prospect_activities;
CREATE POLICY "Admins can manage all prospect activities" ON public.prospect_activities FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team prospect activities" ON public.prospect_activities;
CREATE POLICY "Managers can view team prospect activities" ON public.prospect_activities FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id)
);

-- ============ ACTIVITY_LOGS ============
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
CREATE POLICY "Admins can view all activity logs" ON public.activity_logs FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============ SALES_COACH_SESSIONS ============
DROP POLICY IF EXISTS "Admins can view all coach sessions" ON public.sales_coach_sessions;
CREATE POLICY "Admins can view all coach sessions" ON public.sales_coach_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ============ SALES_ASSISTANT_SESSIONS ============
DROP POLICY IF EXISTS "Admins can view all assistant sessions" ON public.sales_assistant_sessions;
CREATE POLICY "Admins can view all assistant sessions" ON public.sales_assistant_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ============ PERFORMANCE_METRICS ============
DROP POLICY IF EXISTS "Admins can view all metrics" ON public.performance_metrics;
CREATE POLICY "Admins can view all metrics" ON public.performance_metrics FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ============ DATA_ACCESS_LOGS ============
DROP POLICY IF EXISTS "Admins can view all access logs" ON public.data_access_logs;
CREATE POLICY "Admins can view all access logs" ON public.data_access_logs FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- ============ ROLEPLAY_PERSONAS ============
DROP POLICY IF EXISTS "Admins can manage personas" ON public.roleplay_personas;
CREATE POLICY "Admins can manage personas" ON public.roleplay_personas FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Reps can view active personas" ON public.roleplay_personas;
CREATE POLICY "Reps can view active personas" ON public.roleplay_personas FOR SELECT USING (is_active = true);

-- ============ REP_PERFORMANCE_SNAPSHOTS ============
DROP POLICY IF EXISTS "Admins can view all snapshots" ON public.rep_performance_snapshots;
CREATE POLICY "Admins can view all snapshots" ON public.rep_performance_snapshots FOR SELECT USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Managers can view team snapshots" ON public.rep_performance_snapshots;
CREATE POLICY "Managers can view team snapshots" ON public.rep_performance_snapshots FOR SELECT USING (
  has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id)
);
