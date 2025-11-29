-- Create table to cache AI-generated coaching trend analyses
CREATE TABLE public.coaching_trend_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL,
  date_range_from DATE NOT NULL,
  date_range_to DATE NOT NULL,
  call_count INTEGER NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(rep_id, date_range_from, date_range_to)
);

-- Enable RLS
ALTER TABLE public.coaching_trend_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reps can view own cached analyses" 
ON public.coaching_trend_analyses
FOR SELECT USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own cached analyses" 
ON public.coaching_trend_analyses
FOR INSERT WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own cached analyses" 
ON public.coaching_trend_analyses
FOR UPDATE USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own cached analyses" 
ON public.coaching_trend_analyses
FOR DELETE USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team cached analyses" 
ON public.coaching_trend_analyses
FOR SELECT USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all cached analyses" 
ON public.coaching_trend_analyses
FOR ALL USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Add trigger for updated_at
CREATE TRIGGER update_coaching_trend_analyses_updated_at
BEFORE UPDATE ON public.coaching_trend_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();