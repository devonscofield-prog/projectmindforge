-- Add 'partial' to the processing_status CHECK constraint.
-- The pipeline writes 'partial' when some calls grade successfully but
-- others fail; without this the UPDATE silently fails and the transcript
-- stays stuck in 'processing' forever.

ALTER TABLE public.sdr_daily_transcripts
  DROP CONSTRAINT IF EXISTS sdr_daily_transcripts_processing_status_check;

ALTER TABLE public.sdr_daily_transcripts
  ADD CONSTRAINT sdr_daily_transcripts_processing_status_check
  CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'partial'));
