-- Enable RLS on the view
ALTER VIEW public.data_access_logs_with_user SET (security_invoker = on);

-- Create RLS policies for the view
-- Users can view their own access logs
CREATE POLICY "Users can view own access logs via view"
ON public.data_access_logs
FOR SELECT
USING (auth.uid() = user_id);

-- Note: The view already inherits from data_access_logs which has RLS enabled.
-- By setting security_invoker = on, the view will use the calling user's permissions
-- instead of the view owner's permissions, ensuring RLS is enforced.