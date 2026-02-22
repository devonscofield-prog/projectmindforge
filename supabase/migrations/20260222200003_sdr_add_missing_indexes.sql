-- Add missing performance indexes for SDR query patterns.
-- Existing indexes checked in:
--   20260218120000_sdr_read_performance_indexes.sql
--   20260222100003_add_performance_indexes.sql

-- Composite index for transcript processing queue queries
CREATE INDEX IF NOT EXISTS idx_sdr_transcripts_processing_status
  ON public.sdr_daily_transcripts (processing_status, created_at DESC);

-- Composite index for call listing filtered by type + SDR + date
CREATE INDEX IF NOT EXISTS idx_sdr_calls_type_sdr_date
  ON public.sdr_calls (call_type, sdr_id, created_at DESC);
