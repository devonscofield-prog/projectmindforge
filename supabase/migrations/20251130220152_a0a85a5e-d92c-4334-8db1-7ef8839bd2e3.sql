-- Create table for custom analysis presets
CREATE TABLE public.admin_custom_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  mode_ids TEXT[] NOT NULL,
  starter_prompt TEXT NOT NULL,
  icon_name TEXT DEFAULT 'layers',
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_custom_presets ENABLE ROW LEVEL SECURITY;

-- Admins can manage their own presets
CREATE POLICY "Admins can manage own presets"
ON public.admin_custom_presets
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id);

-- Admins can view shared presets
CREATE POLICY "Admins can view shared presets"
ON public.admin_custom_presets
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) AND is_shared = true);

-- Add trigger for updated_at
CREATE TRIGGER update_admin_custom_presets_updated_at
BEFORE UPDATE ON public.admin_custom_presets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();