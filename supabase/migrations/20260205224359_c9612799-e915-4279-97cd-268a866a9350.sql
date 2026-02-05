
-- Create rep_task_templates table
CREATE TABLE public.rep_task_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',
  category TEXT,
  due_days_offset INTEGER,
  reminder_enabled BOOLEAN DEFAULT false,
  reminder_time TIME DEFAULT '09:00',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create rep_task_template_settings table
CREATE TABLE public.rep_task_template_settings (
  rep_id UUID NOT NULL PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  auto_create_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rep_task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_task_template_settings ENABLE ROW LEVEL SECURITY;

-- RLS for rep_task_templates
CREATE POLICY "Reps can manage their own templates"
  ON public.rep_task_templates FOR ALL
  USING (auth.uid() = rep_id)
  WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Admins can manage all templates"
  ON public.rep_task_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS for rep_task_template_settings
CREATE POLICY "Reps can manage their own settings"
  ON public.rep_task_template_settings FOR ALL
  USING (auth.uid() = rep_id)
  WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Admins can manage all settings"
  ON public.rep_task_template_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Updated_at triggers
CREATE TRIGGER update_rep_task_templates_updated_at
  BEFORE UPDATE ON public.rep_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rep_task_template_settings_updated_at
  BEFORE UPDATE ON public.rep_task_template_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_rep_task_templates_rep_id ON public.rep_task_templates(rep_id);
