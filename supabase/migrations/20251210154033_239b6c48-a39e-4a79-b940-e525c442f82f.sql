-- Create password_reset_otps table for OTP-based password reset
CREATE TABLE public.password_reset_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

-- Index for fast lookup
CREATE INDEX idx_password_reset_otps_user_id ON public.password_reset_otps(user_id);
CREATE INDEX idx_password_reset_otps_lookup ON public.password_reset_otps(user_id, otp_code) WHERE used_at IS NULL;

-- RLS policies
ALTER TABLE public.password_reset_otps ENABLE ROW LEVEL SECURITY;

-- Only admins can manage OTPs via edge functions (service role bypasses RLS)
CREATE POLICY "Admins can manage OTPs" ON public.password_reset_otps
  FOR ALL USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));