-- Add reminder_time column for per-task time override
ALTER TABLE public.account_follow_ups 
ADD COLUMN reminder_time time without time zone DEFAULT '09:00'::time;

COMMENT ON COLUMN public.account_follow_ups.reminder_time IS 
  'Per-task reminder time override. Falls back to user notification_preferences if null.';