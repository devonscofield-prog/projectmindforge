-- Fix RLS INSERT policies on in_app_notifications and notification_log
-- The overly permissive "Service can insert" policies allowed any authenticated
-- user to insert notifications for any user. Edge functions use service_role key
-- which bypasses RLS, so restricting client-side inserts to own user_id only.

-- in_app_notifications: replace open INSERT with user-scoped INSERT
DROP POLICY IF EXISTS "Service can insert notifications" ON public.in_app_notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- notification_log: replace open INSERT with user-scoped INSERT
DROP POLICY IF EXISTS "Service can insert notification log" ON public.notification_log;
CREATE POLICY "Users can insert own notification log"
  ON public.notification_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);
