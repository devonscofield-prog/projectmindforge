ALTER TABLE public.account_follow_ups
ADD COLUMN IF NOT EXISTS secondary_reminder_sent_at TIMESTAMPTZ;
