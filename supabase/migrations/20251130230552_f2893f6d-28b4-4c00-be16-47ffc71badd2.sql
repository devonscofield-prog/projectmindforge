-- Create table to track implemented recommendations
CREATE TABLE public.implemented_recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recommendation_title TEXT NOT NULL,
  recommendation_category TEXT NOT NULL,
  recommendation_priority TEXT NOT NULL,
  recommendation_action TEXT NOT NULL,
  affected_operations TEXT[] DEFAULT '{}',
  baseline_metrics JSONB NOT NULL,
  implemented_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  measured_at TIMESTAMP WITH TIME ZONE,
  post_metrics JSONB,
  improvement_percent NUMERIC,
  status TEXT NOT NULL DEFAULT 'implemented',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.implemented_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage all implemented recommendations"
ON public.implemented_recommendations
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own implemented recommendations"
ON public.implemented_recommendations
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own implemented recommendations"
ON public.implemented_recommendations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own implemented recommendations"
ON public.implemented_recommendations
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_implemented_recommendations_user_id ON public.implemented_recommendations(user_id);
CREATE INDEX idx_implemented_recommendations_status ON public.implemented_recommendations(status);

-- Add trigger for updated_at
CREATE TRIGGER update_implemented_recommendations_updated_at
BEFORE UPDATE ON public.implemented_recommendations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();