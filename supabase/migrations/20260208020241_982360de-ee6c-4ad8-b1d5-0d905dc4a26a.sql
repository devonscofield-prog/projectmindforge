
-- Create daily_report_configs table
CREATE TABLE public.daily_report_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  delivery_time TEXT NOT NULL DEFAULT '08:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  rep_ids UUID[] DEFAULT NULL,
  include_weekends BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: one config per user
ALTER TABLE public.daily_report_configs ADD CONSTRAINT daily_report_configs_user_id_unique UNIQUE (user_id);

-- Enable RLS
ALTER TABLE public.daily_report_configs ENABLE ROW LEVEL SECURITY;

-- Users can read their own config
CREATE POLICY "Users can view their own daily report config"
ON public.daily_report_configs FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own config
CREATE POLICY "Users can create their own daily report config"
ON public.daily_report_configs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own config
CREATE POLICY "Users can update their own daily report config"
ON public.daily_report_configs FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own config
CREATE POLICY "Users can delete their own daily report config"
ON public.daily_report_configs FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_daily_report_configs_updated_at
BEFORE UPDATE ON public.daily_report_configs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
