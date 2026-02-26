ALTER TABLE public.sdr_call_grades ADD COLUMN IF NOT EXISTS coaching_feedback_helpful boolean;
ALTER TABLE public.sdr_call_grades ADD COLUMN IF NOT EXISTS coaching_feedback_note text;
ALTER TABLE public.sdr_call_grades ADD COLUMN IF NOT EXISTS coaching_feedback_at timestamptz;