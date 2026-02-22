-- Add write-path RLS policies for SDR tables.
-- Uses DROP POLICY IF EXISTS before CREATE POLICY to avoid conflicts.

-- =============================================================
-- sdr_calls: INSERT for SDRs, UPDATE for SDRs and managers
-- =============================================================

DROP POLICY IF EXISTS "SDRs can insert own calls" ON public.sdr_calls;
CREATE POLICY "SDRs can insert own calls"
  ON public.sdr_calls FOR INSERT
  WITH CHECK (sdr_id = auth.uid());

DROP POLICY IF EXISTS "SDRs can update own calls" ON public.sdr_calls;
CREATE POLICY "SDRs can update own calls"
  ON public.sdr_calls FOR UPDATE
  USING (sdr_id = auth.uid())
  WITH CHECK (sdr_id = auth.uid());

DROP POLICY IF EXISTS "SDR Managers can update team calls" ON public.sdr_calls;
CREATE POLICY "SDR Managers can update team calls"
  ON public.sdr_calls FOR UPDATE
  USING (is_sdr_manager_of(auth.uid(), sdr_id))
  WITH CHECK (is_sdr_manager_of(auth.uid(), sdr_id));

-- =============================================================
-- sdr_call_grades: INSERT for SDRs, UPDATE for SDRs and managers
-- =============================================================

DROP POLICY IF EXISTS "SDRs can insert own grades" ON public.sdr_call_grades;
CREATE POLICY "SDRs can insert own grades"
  ON public.sdr_call_grades FOR INSERT
  WITH CHECK (sdr_id = auth.uid());

DROP POLICY IF EXISTS "SDRs can update own grades" ON public.sdr_call_grades;
CREATE POLICY "SDRs can update own grades"
  ON public.sdr_call_grades FOR UPDATE
  USING (sdr_id = auth.uid())
  WITH CHECK (sdr_id = auth.uid());

DROP POLICY IF EXISTS "SDR Managers can update team grades" ON public.sdr_call_grades;
CREATE POLICY "SDR Managers can update team grades"
  ON public.sdr_call_grades FOR UPDATE
  USING (is_sdr_manager_of(auth.uid(), sdr_id))
  WITH CHECK (is_sdr_manager_of(auth.uid(), sdr_id));

-- =============================================================
-- sdr_teams: DELETE and INSERT for admins
-- (Admins already have FOR ALL policy; these are explicit extras)
-- =============================================================

DROP POLICY IF EXISTS "Admins can delete SDR teams" ON public.sdr_teams;
CREATE POLICY "Admins can delete SDR teams"
  ON public.sdr_teams FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can insert SDR teams" ON public.sdr_teams;
CREATE POLICY "Admins can insert SDR teams"
  ON public.sdr_teams FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- =============================================================
-- sdr_team_members: DELETE for admins and managers of the team
-- =============================================================

DROP POLICY IF EXISTS "Admins can delete SDR team members" ON public.sdr_team_members;
CREATE POLICY "Admins can delete SDR team members"
  ON public.sdr_team_members FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "SDR Managers can delete own team members" ON public.sdr_team_members;
CREATE POLICY "SDR Managers can delete own team members"
  ON public.sdr_team_members FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_team_members.team_id AND t.manager_id = auth.uid()
  ));

-- =============================================================
-- sdr_coaching_prompts: DELETE for admins and team managers
-- =============================================================

DROP POLICY IF EXISTS "Admins can delete coaching prompts" ON public.sdr_coaching_prompts;
CREATE POLICY "Admins can delete coaching prompts"
  ON public.sdr_coaching_prompts FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "SDR Managers can delete own team prompts" ON public.sdr_coaching_prompts;
CREATE POLICY "SDR Managers can delete own team prompts"
  ON public.sdr_coaching_prompts FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_coaching_prompts.team_id AND t.manager_id = auth.uid()
  ));
