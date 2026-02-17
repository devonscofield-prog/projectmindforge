CREATE POLICY "Admins can view all notification logs"
ON public.notification_log
FOR SELECT
USING (has_role(auth.uid(), 'admin'::text));