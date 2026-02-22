-- Add missing foreign keys to enforce referential integrity with auth.users
-- First clean up any orphaned rows, then add the constraints.

-- Clean up orphaned rows
DELETE FROM public.account_follow_ups
WHERE rep_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.in_app_notifications
WHERE user_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.notification_log
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Add foreign key constraints (use DO blocks for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'account_follow_ups_rep_id_fkey'
      AND table_name = 'account_follow_ups'
  ) THEN
    ALTER TABLE public.account_follow_ups
      ADD CONSTRAINT account_follow_ups_rep_id_fkey
      FOREIGN KEY (rep_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'in_app_notifications_user_id_fkey'
      AND table_name = 'in_app_notifications'
  ) THEN
    ALTER TABLE public.in_app_notifications
      ADD CONSTRAINT in_app_notifications_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'notification_log_user_id_fkey'
      AND table_name = 'notification_log'
  ) THEN
    ALTER TABLE public.notification_log
      ADD CONSTRAINT notification_log_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
