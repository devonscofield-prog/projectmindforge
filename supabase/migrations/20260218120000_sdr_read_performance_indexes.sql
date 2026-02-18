-- Additive read-path indexes to stabilize SDR/SDR-manager list and dashboard queries.

CREATE INDEX IF NOT EXISTS idx_sdr_daily_transcripts_sdr_date_created_desc
  ON public.sdr_daily_transcripts (sdr_id, transcript_date DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdr_calls_sdr_created_desc
  ON public.sdr_calls (sdr_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdr_calls_transcript_call_index_asc
  ON public.sdr_calls (daily_transcript_id, call_index ASC);

CREATE INDEX IF NOT EXISTS idx_sdr_call_grades_sdr_created_desc
  ON public.sdr_call_grades (sdr_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdr_call_grades_call_created_desc
  ON public.sdr_call_grades (call_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sdr_team_invites_active_team_created_desc
  ON public.sdr_team_invites (team_id, is_active, created_at DESC)
  WHERE is_active = true;
