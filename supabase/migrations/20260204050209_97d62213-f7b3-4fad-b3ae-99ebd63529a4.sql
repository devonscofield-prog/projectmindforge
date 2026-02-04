-- Add new columns for enhanced notification preferences
ALTER TABLE notification_preferences
ADD COLUMN IF NOT EXISTS secondary_reminder_time TIME DEFAULT NULL,
ADD COLUMN IF NOT EXISTS exclude_weekends BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS min_priority TEXT DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN notification_preferences.secondary_reminder_time 
  IS 'Optional second daily reminder time';
COMMENT ON COLUMN notification_preferences.exclude_weekends 
  IS 'Skip reminders on Saturday and Sunday';
COMMENT ON COLUMN notification_preferences.min_priority 
  IS 'Minimum priority level to include (null = all, low/medium/high)';