
-- Add opportunity fields to call_transcripts
ALTER TABLE public.call_transcripts
  ADD COLUMN estimated_opportunity_size numeric DEFAULT NULL,
  ADD COLUMN target_close_date date DEFAULT NULL,
  ADD COLUMN opportunity_label text DEFAULT NULL;

-- Add check constraint for valid opportunity labels
ALTER TABLE public.call_transcripts
  ADD CONSTRAINT call_transcripts_opportunity_label_check
  CHECK (opportunity_label IS NULL OR opportunity_label IN ('commit', 'best_case', 'pipeline', 'time_waster'));
