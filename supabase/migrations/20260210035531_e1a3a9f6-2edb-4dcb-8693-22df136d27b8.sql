
-- Phase 1: SDR Module Database Foundation
-- ========================================

-- 1a. Extend user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sdr';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'sdr_manager';

-- 1b. New tables

-- SDR Teams
CREATE TABLE public.sdr_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  manager_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all SDR teams"
  ON public.sdr_teams FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDR Managers can view own teams"
  ON public.sdr_teams FOR SELECT
  USING (manager_id = auth.uid());

CREATE POLICY "SDR Managers can update own teams"
  ON public.sdr_teams FOR UPDATE
  USING (manager_id = auth.uid());

-- SDR Team Members
CREATE TABLE public.sdr_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.sdr_teams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);

ALTER TABLE public.sdr_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all SDR team members"
  ON public.sdr_team_members FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDR Managers can view own team members"
  ON public.sdr_team_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_team_members.team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "SDR Managers can manage own team members"
  ON public.sdr_team_members FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_team_members.team_id AND t.manager_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_team_members.team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "SDRs can view own team membership"
  ON public.sdr_team_members FOR SELECT
  USING (user_id = auth.uid());

-- Helper function: check if a user is an SDR manager of another user
CREATE OR REPLACE FUNCTION public.is_sdr_manager_of(manager uuid, sdr uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM sdr_team_members m
    JOIN sdr_teams t ON t.id = m.team_id
    WHERE t.manager_id = manager AND m.user_id = sdr
  )
$$;

-- SDR Daily Transcripts
CREATE TABLE public.sdr_daily_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sdr_id uuid NOT NULL REFERENCES public.profiles(id),
  transcript_date date NOT NULL DEFAULT CURRENT_DATE,
  raw_text text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error text,
  total_calls_detected int NOT NULL DEFAULT 0,
  meaningful_calls_count int NOT NULL DEFAULT 0,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_daily_transcripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all SDR transcripts"
  ON public.sdr_daily_transcripts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDRs can view own transcripts"
  ON public.sdr_daily_transcripts FOR SELECT
  USING (sdr_id = auth.uid());

CREATE POLICY "SDRs can insert own transcripts"
  ON public.sdr_daily_transcripts FOR INSERT
  WITH CHECK (sdr_id = auth.uid());

CREATE POLICY "SDR Managers can view team transcripts"
  ON public.sdr_daily_transcripts FOR SELECT
  USING (is_sdr_manager_of(auth.uid(), sdr_id));

CREATE POLICY "SDR Managers can insert team transcripts"
  ON public.sdr_daily_transcripts FOR INSERT
  WITH CHECK (is_sdr_manager_of(auth.uid(), sdr_id));

-- SDR Calls (extracted from daily transcripts)
CREATE TABLE public.sdr_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_transcript_id uuid NOT NULL REFERENCES public.sdr_daily_transcripts(id) ON DELETE CASCADE,
  sdr_id uuid NOT NULL REFERENCES public.profiles(id),
  call_index int NOT NULL,
  raw_text text NOT NULL,
  call_type text NOT NULL DEFAULT 'conversation'
    CHECK (call_type IN ('conversation', 'voicemail', 'hangup', 'internal', 'reminder')),
  is_meaningful boolean NOT NULL DEFAULT false,
  prospect_name text,
  prospect_company text,
  duration_estimate_seconds int,
  start_timestamp text,
  analysis_status text NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'processing', 'completed', 'skipped', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all SDR calls"
  ON public.sdr_calls FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDRs can view own calls"
  ON public.sdr_calls FOR SELECT
  USING (sdr_id = auth.uid());

CREATE POLICY "SDR Managers can view team calls"
  ON public.sdr_calls FOR SELECT
  USING (is_sdr_manager_of(auth.uid(), sdr_id));

-- SDR Call Grades
CREATE TABLE public.sdr_call_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.sdr_calls(id) ON DELETE CASCADE,
  sdr_id uuid NOT NULL REFERENCES public.profiles(id),
  overall_grade text NOT NULL,
  opener_score numeric,
  engagement_score numeric,
  objection_handling_score numeric,
  appointment_setting_score numeric,
  professionalism_score numeric,
  call_summary text,
  strengths jsonb DEFAULT '[]'::jsonb,
  improvements jsonb DEFAULT '[]'::jsonb,
  key_moments jsonb DEFAULT '[]'::jsonb,
  coaching_notes text,
  model_name text NOT NULL,
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_call_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all SDR grades"
  ON public.sdr_call_grades FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDRs can view own grades"
  ON public.sdr_call_grades FOR SELECT
  USING (sdr_id = auth.uid());

CREATE POLICY "SDR Managers can view team grades"
  ON public.sdr_call_grades FOR SELECT
  USING (is_sdr_manager_of(auth.uid(), sdr_id));

-- SDR Coaching Prompts (manager-customizable)
CREATE TABLE public.sdr_coaching_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid REFERENCES public.sdr_teams(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  agent_key text NOT NULL CHECK (agent_key IN ('splitter', 'filter', 'grader')),
  prompt_name text NOT NULL,
  system_prompt text NOT NULL,
  scoring_weights jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sdr_coaching_prompts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all coaching prompts"
  ON public.sdr_coaching_prompts FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "SDR Managers can manage own team prompts"
  ON public.sdr_coaching_prompts FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_coaching_prompts.team_id AND t.manager_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sdr_teams t
    WHERE t.id = sdr_coaching_prompts.team_id AND t.manager_id = auth.uid()
  ));

CREATE POLICY "SDRs can view active prompts for their team"
  ON public.sdr_coaching_prompts FOR SELECT
  USING (
    is_active = true AND EXISTS (
      SELECT 1 FROM public.sdr_team_members m
      WHERE m.user_id = auth.uid() AND m.team_id = sdr_coaching_prompts.team_id
    )
  );

-- Indexes for performance
CREATE INDEX idx_sdr_daily_transcripts_sdr_id ON public.sdr_daily_transcripts(sdr_id);
CREATE INDEX idx_sdr_daily_transcripts_date ON public.sdr_daily_transcripts(transcript_date);
CREATE INDEX idx_sdr_calls_transcript ON public.sdr_calls(daily_transcript_id);
CREATE INDEX idx_sdr_calls_sdr_id ON public.sdr_calls(sdr_id);
CREATE INDEX idx_sdr_call_grades_call ON public.sdr_call_grades(call_id);
CREATE INDEX idx_sdr_call_grades_sdr ON public.sdr_call_grades(sdr_id);
CREATE INDEX idx_sdr_team_members_user ON public.sdr_team_members(user_id);
CREATE INDEX idx_sdr_coaching_prompts_team ON public.sdr_coaching_prompts(team_id);

-- Timestamp triggers for updated_at
CREATE TRIGGER update_sdr_teams_updated_at
  BEFORE UPDATE ON public.sdr_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_daily_transcripts_updated_at
  BEFORE UPDATE ON public.sdr_daily_transcripts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_calls_updated_at
  BEFORE UPDATE ON public.sdr_calls
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sdr_coaching_prompts_updated_at
  BEFORE UPDATE ON public.sdr_coaching_prompts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
