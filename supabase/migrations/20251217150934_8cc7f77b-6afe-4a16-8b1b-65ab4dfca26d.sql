-- Create competitors table for storing competitor research and battlecards
CREATE TABLE public.competitors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  logo_url TEXT,
  raw_content JSONB DEFAULT '{}'::jsonb,
  intel JSONB DEFAULT '{}'::jsonb,
  branding JSONB DEFAULT '{}'::jsonb,
  last_researched_at TIMESTAMP WITH TIME ZONE,
  research_status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.competitors ENABLE ROW LEVEL SECURITY;

-- Admins can manage all competitors
CREATE POLICY "Admins can manage all competitors"
ON public.competitors
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Managers can view competitors
CREATE POLICY "Managers can view competitors"
ON public.competitors
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role));

-- Reps can view competitors
CREATE POLICY "Reps can view competitors"
ON public.competitors
FOR SELECT
USING (has_role(auth.uid(), 'rep'::user_role));

-- Create updated_at trigger
CREATE TRIGGER update_competitors_updated_at
  BEFORE UPDATE ON public.competitors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();