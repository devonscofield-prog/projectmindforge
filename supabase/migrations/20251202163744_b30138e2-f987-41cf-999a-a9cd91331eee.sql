-- Create table for tracking trusted devices
CREATE TABLE public.user_trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_id TEXT NOT NULL,
  device_name TEXT,
  user_agent TEXT,
  ip_address TEXT,
  trusted_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_id)
);

-- Create table for tracking MFA enrollment status
CREATE TABLE public.mfa_enrollment_status (
  user_id UUID PRIMARY KEY,
  is_enrolled BOOLEAN DEFAULT FALSE,
  enrolled_at TIMESTAMPTZ,
  reset_at TIMESTAMPTZ,
  reset_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE public.user_trusted_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_enrollment_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_trusted_devices
CREATE POLICY "Users can view own trusted devices"
ON public.user_trusted_devices
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trusted devices"
ON public.user_trusted_devices
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own trusted devices"
ON public.user_trusted_devices
FOR DELETE
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own trusted devices"
ON public.user_trusted_devices
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all trusted devices"
ON public.user_trusted_devices
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- RLS policies for mfa_enrollment_status
CREATE POLICY "Users can view own MFA status"
ON public.mfa_enrollment_status
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MFA status"
ON public.mfa_enrollment_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MFA status"
ON public.mfa_enrollment_status
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all MFA status"
ON public.mfa_enrollment_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Function to check if device is trusted
CREATE OR REPLACE FUNCTION public.check_device_trusted(p_user_id UUID, p_device_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_trusted_devices
    WHERE user_id = p_user_id
      AND device_id = p_device_id
      AND expires_at > NOW()
  )
$$;

-- Function to clean up expired trusted devices
CREATE OR REPLACE FUNCTION public.cleanup_expired_devices()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.user_trusted_devices WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Trigger to update updated_at on mfa_enrollment_status
CREATE TRIGGER update_mfa_enrollment_status_updated_at
BEFORE UPDATE ON public.mfa_enrollment_status
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();