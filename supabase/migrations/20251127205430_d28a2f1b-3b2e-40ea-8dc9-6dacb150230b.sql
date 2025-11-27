-- Create app_settings table for key/value configuration
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Seed default AI mode
INSERT INTO public.app_settings (key, value)
VALUES ('ai_mode', 'mock')
ON CONFLICT (key) DO NOTHING;

-- RLS: All authenticated users can SELECT
CREATE POLICY "Authenticated users can view settings"
ON public.app_settings
FOR SELECT
TO authenticated
USING (true);

-- RLS: Only admins can INSERT
CREATE POLICY "Admins can insert settings"
ON public.app_settings
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- RLS: Only admins can UPDATE
CREATE POLICY "Admins can update settings"
ON public.app_settings
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- RLS: Only admins can DELETE
CREATE POLICY "Admins can delete settings"
ON public.app_settings
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for auto-updating updated_at
CREATE TRIGGER update_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();