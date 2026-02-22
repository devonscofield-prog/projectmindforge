ALTER TABLE sdr_daily_transcripts ADD COLUMN IF NOT EXISTS processing_stage text;
ALTER TABLE sdr_daily_transcripts ADD COLUMN IF NOT EXISTS graded_count integer DEFAULT 0;
