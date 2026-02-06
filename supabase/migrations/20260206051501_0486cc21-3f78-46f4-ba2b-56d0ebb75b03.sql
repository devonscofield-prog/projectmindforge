
-- In-app notifications table
CREATE TABLE public.in_app_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL DEFAULT 'system',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  related_entity_id UUID
);

-- Notification log table
CREATE TABLE public.notification_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL DEFAULT 'email',
  notification_type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  task_count INTEGER NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.in_app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- RLS: Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.in_app_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.in_app_notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (from edge functions)
CREATE POLICY "Service can insert notifications"
  ON public.in_app_notifications FOR INSERT
  WITH CHECK (true);

-- RLS: Users can only see their own log
CREATE POLICY "Users can view own notification log"
  ON public.notification_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service can insert notification log"
  ON public.notification_log FOR INSERT
  WITH CHECK (true);

-- Indexes
CREATE INDEX idx_in_app_notifications_user_unread 
  ON public.in_app_notifications (user_id, is_read) 
  WHERE is_read = false;

CREATE INDEX idx_in_app_notifications_user_created 
  ON public.in_app_notifications (user_id, created_at DESC);

CREATE INDEX idx_notification_log_user_sent 
  ON public.notification_log (user_id, sent_at DESC);

-- Enable realtime for in-app notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.in_app_notifications;
