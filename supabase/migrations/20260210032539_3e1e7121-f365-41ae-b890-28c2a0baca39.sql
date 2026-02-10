-- Add RLS policies to password_reset_otps table
-- This table is only accessed by edge functions using service role key
-- No client-side access should be allowed

-- RLS is already enabled, just add deny-all policies for client access
-- Service role key bypasses RLS, so edge functions still work

CREATE POLICY "Deny all client select on password_reset_otps"
  ON public.password_reset_otps
  FOR SELECT
  USING (false);

CREATE POLICY "Deny all client insert on password_reset_otps"
  ON public.password_reset_otps
  FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Deny all client update on password_reset_otps"
  ON public.password_reset_otps
  FOR UPDATE
  USING (false);

CREATE POLICY "Deny all client delete on password_reset_otps"
  ON public.password_reset_otps
  FOR DELETE
  USING (false);