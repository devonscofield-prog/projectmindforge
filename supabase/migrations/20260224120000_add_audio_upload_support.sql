-- Add audio upload support for SDR call analysis platform
-- ========================================================
-- Adds: audio columns to call_transcripts & sdr_daily_transcripts,
--        voice analysis columns to ai_call_analysis & sdr_call_grades,
--        voice_analysis_usage and voice_analysis_limits tables,
--        storage RLS policies for call-audio bucket.

-- =============================================================
-- 0a. Extend call_analysis_status enum with audio-related values
-- =============================================================

ALTER TYPE call_analysis_status ADD VALUE IF NOT EXISTS 'transcribing';
ALTER TYPE call_analysis_status ADD VALUE IF NOT EXISTS 'transcribed';

-- TODO: Update recover_stuck_processing_transcripts() to also recover
-- records stuck in 'transcribing' status for > 15 minutes

-- =============================================================
-- 0b. Drop NOT NULL on raw_text for tables that will accept audio
--     (audio uploads start without a transcript; raw_text is populated
--      after transcription completes)
-- =============================================================

ALTER TABLE public.call_transcripts ALTER COLUMN raw_text DROP NOT NULL;
ALTER TABLE public.sdr_daily_transcripts ALTER COLUMN raw_text DROP NOT NULL;
ALTER TABLE public.sdr_calls ALTER COLUMN raw_text DROP NOT NULL;

-- =============================================================
-- 0c. Extend CHECK constraints to allow 'transcribing' / 'transcribed'
-- =============================================================

-- sdr_daily_transcripts.processing_status
ALTER TABLE public.sdr_daily_transcripts
  DROP CONSTRAINT IF EXISTS sdr_daily_transcripts_processing_status_check;
ALTER TABLE public.sdr_daily_transcripts
  ADD CONSTRAINT sdr_daily_transcripts_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'partial', 'transcribing', 'transcribed'));

-- sdr_calls.analysis_status
ALTER TABLE public.sdr_calls
  DROP CONSTRAINT IF EXISTS sdr_calls_analysis_status_check;
ALTER TABLE public.sdr_calls
  ADD CONSTRAINT sdr_calls_analysis_status_check
  CHECK (analysis_status IN ('pending', 'processing', 'completed', 'skipped', 'failed', 'transcribing', 'transcribed'));

-- =============================================================
-- 0d. Create storage bucket 'call-audio'
-- =============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'call-audio',
  'call-audio',
  false,
  104857600,  -- 100MB
  ARRAY['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-wav', 'audio/webm', 'audio/ogg', 'audio/x-m4a']
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================
-- 1. New columns on call_transcripts
-- =============================================================

ALTER TABLE public.call_transcripts
  ADD COLUMN audio_file_path text,
  ADD COLUMN audio_duration_seconds integer,
  ADD COLUMN upload_method text NOT NULL DEFAULT 'text';

ALTER TABLE public.call_transcripts
  ADD CONSTRAINT check_upload_method CHECK (upload_method IN ('text', 'audio'));

-- Index for filtering by upload_method
CREATE INDEX idx_call_transcripts_upload_method ON public.call_transcripts(upload_method);

-- =============================================================
-- 2. New columns on sdr_daily_transcripts
-- =============================================================

ALTER TABLE public.sdr_daily_transcripts
  ADD COLUMN audio_file_path text,
  ADD COLUMN upload_method text NOT NULL DEFAULT 'text';

ALTER TABLE public.sdr_daily_transcripts
  ADD CONSTRAINT check_sdr_transcript_upload_method CHECK (upload_method IN ('text', 'audio'));

-- =============================================================
-- 3. New JSONB column on ai_call_analysis
-- =============================================================

ALTER TABLE public.ai_call_analysis
  ADD COLUMN audio_voice_analysis jsonb;

-- =============================================================
-- 4. New JSONB column on sdr_call_grades
-- =============================================================

ALTER TABLE public.sdr_call_grades
  ADD COLUMN audio_voice_analysis jsonb;

-- =============================================================
-- 5. voice_analysis_usage table
-- =============================================================

CREATE TABLE public.voice_analysis_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month date NOT NULL,  -- first of month, e.g. '2026-02-01'
  analyses_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, month)
);

ALTER TABLE public.voice_analysis_usage ENABLE ROW LEVEL SECURITY;

-- Trigger for updated_at
CREATE TRIGGER update_voice_analysis_usage_updated_at
  BEFORE UPDATE ON public.voice_analysis_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================
-- 6. voice_analysis_limits table
-- =============================================================

CREATE TABLE public.voice_analysis_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('global', 'team', 'individual')),
  target_id uuid,  -- null for global, team_id or user_id otherwise
  monthly_limit integer NOT NULL DEFAULT 10,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(scope, target_id)
);

ALTER TABLE public.voice_analysis_limits ENABLE ROW LEVEL SECURITY;

-- PostgreSQL treats NULLs as distinct in UNIQUE constraints, so the
-- UNIQUE(scope, target_id) above does NOT prevent duplicate global rows
-- (scope='global', target_id=NULL). Add a partial unique index to enforce
-- at most one global row.
CREATE UNIQUE INDEX idx_voice_limits_global_unique
  ON public.voice_analysis_limits (scope)
  WHERE scope = 'global' AND target_id IS NULL;

-- Seed global default limit
INSERT INTO public.voice_analysis_limits (scope, target_id, monthly_limit)
VALUES ('global', NULL, 10);

-- =============================================================
-- 7. Indexes
-- =============================================================

CREATE INDEX idx_voice_usage_user_month ON public.voice_analysis_usage(user_id, month);
CREATE INDEX idx_voice_limits_scope ON public.voice_analysis_limits(scope, target_id);

-- =============================================================
-- 8. RLS policies for voice_analysis_usage
-- =============================================================

-- Users can view their own usage
CREATE POLICY "Users can view own voice analysis usage"
  ON public.voice_analysis_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Managers can view their team's usage
CREATE POLICY "Managers can view team voice analysis usage"
  ON public.voice_analysis_usage FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role)
    AND is_manager_of_user(auth.uid(), user_id)
  );

-- SDR Managers can view their team's usage
CREATE POLICY "SDR Managers can view team voice analysis usage"
  ON public.voice_analysis_usage FOR SELECT
  USING (is_sdr_manager_of(auth.uid(), user_id));

-- Admins can view all usage
CREATE POLICY "Admins can view all voice analysis usage"
  ON public.voice_analysis_usage FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Admins can manage all usage
CREATE POLICY "Admins can manage all voice analysis usage"
  ON public.voice_analysis_usage FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Service role handles INSERT/UPDATE via edge functions (bypasses RLS)
-- Grant explicit permissions for service_role
GRANT ALL ON public.voice_analysis_usage TO service_role;

-- =============================================================
-- 9. RLS policies for voice_analysis_limits
-- =============================================================

-- Admins can manage all limits
CREATE POLICY "Admins can manage all voice analysis limits"
  ON public.voice_analysis_limits FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Managers can view and manage limits scoped to their teams
CREATE POLICY "Managers can view voice analysis limits"
  ON public.voice_analysis_limits FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role)
    AND (
      scope = 'global'
      OR (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_manager_of_user(auth.uid(), target_id))
    )
  );

CREATE POLICY "Managers can insert voice analysis limits"
  ON public.voice_analysis_limits FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'manager'::user_role)
    AND (
      (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_manager_of_user(auth.uid(), target_id))
    )
  );

CREATE POLICY "Managers can update voice analysis limits"
  ON public.voice_analysis_limits FOR UPDATE
  USING (
    has_role(auth.uid(), 'manager'::user_role)
    AND (
      (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_manager_of_user(auth.uid(), target_id))
    )
  );

-- SDR Managers can view and manage limits for their SDR teams
CREATE POLICY "SDR Managers can view voice analysis limits"
  ON public.voice_analysis_limits FOR SELECT
  USING (
    has_role(auth.uid(), 'sdr_manager'::user_role)
    AND (
      scope = 'global'
      OR (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.sdr_teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_sdr_manager_of(auth.uid(), target_id))
    )
  );

CREATE POLICY "SDR Managers can insert voice analysis limits"
  ON public.voice_analysis_limits FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'sdr_manager'::user_role)
    AND (
      (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.sdr_teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_sdr_manager_of(auth.uid(), target_id))
    )
  );

CREATE POLICY "SDR Managers can update voice analysis limits"
  ON public.voice_analysis_limits FOR UPDATE
  USING (
    has_role(auth.uid(), 'sdr_manager'::user_role)
    AND (
      (scope = 'team' AND EXISTS (
        SELECT 1 FROM public.sdr_teams t WHERE t.id = target_id AND t.manager_id = auth.uid()
      ))
      OR (scope = 'individual' AND is_sdr_manager_of(auth.uid(), target_id))
    )
  );

-- Reps can view their own applicable limits (global, their team, or individual)
CREATE POLICY "Reps can view own applicable voice analysis limits"
  ON public.voice_analysis_limits FOR SELECT
  USING (
    scope = 'global'
    OR (scope = 'individual' AND target_id = auth.uid())
    OR (scope = 'team' AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.team_id = target_id
    ))
    OR (scope = 'team' AND EXISTS (
      SELECT 1 FROM public.sdr_team_members m WHERE m.user_id = auth.uid() AND m.team_id = target_id
    ))
  );

-- Service role handles operations via edge functions (bypasses RLS)
GRANT ALL ON public.voice_analysis_limits TO service_role;

-- =============================================================
-- 10. Storage RLS policies for call-audio bucket
-- =============================================================

-- Reps can upload audio to their own folder ({user_id}/...)
CREATE POLICY "Users can upload own call audio"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'call-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Reps can view their own audio files
CREATE POLICY "Users can view own call audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Managers can view their team's audio files
CREATE POLICY "Managers can view team call audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-audio'
    AND has_role(auth.uid(), 'manager'::user_role)
    AND is_manager_of_user(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- SDR Managers can view their team's audio files
CREATE POLICY "SDR Managers can view team call audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-audio'
    AND is_sdr_manager_of(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Admins can view all audio files
CREATE POLICY "Admins can view all call audio"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'call-audio'
    AND has_role(auth.uid(), 'admin'::user_role)
  );

-- Users can delete their own audio files (GDPR compliance)
CREATE POLICY "Users can delete own call audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'call-audio'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Admins can delete any call audio
CREATE POLICY "Admins can delete all call audio"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'call-audio'
    AND has_role(auth.uid(), 'admin'::user_role)
  );
