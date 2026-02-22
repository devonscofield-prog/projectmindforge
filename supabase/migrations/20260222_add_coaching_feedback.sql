-- Add coaching feedback fields to sdr_call_grades
ALTER TABLE sdr_call_grades
  ADD COLUMN IF NOT EXISTS coaching_feedback_helpful boolean,
  ADD COLUMN IF NOT EXISTS coaching_feedback_note text,
  ADD COLUMN IF NOT EXISTS coaching_feedback_at timestamptz;
