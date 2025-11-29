-- Create prospect status enum
CREATE TYPE public.prospect_status AS ENUM ('active', 'won', 'lost', 'dormant');

-- Create activity type enum for prospect activities
CREATE TYPE public.prospect_activity_type AS ENUM ('call', 'email', 'meeting', 'note', 'linkedin', 'demo');

-- Create prospects table
CREATE TABLE public.prospects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rep_id UUID NOT NULL,
  prospect_name TEXT NOT NULL,
  account_name TEXT,
  salesforce_link TEXT,
  potential_revenue NUMERIC,
  status prospect_status NOT NULL DEFAULT 'active',
  ai_extracted_info JSONB,
  suggested_follow_ups JSONB,
  last_contact_date DATE,
  heat_score INTEGER CHECK (heat_score >= 1 AND heat_score <= 10),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create prospect activities table
CREATE TABLE public.prospect_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL,
  activity_type prospect_activity_type NOT NULL,
  description TEXT,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add prospect_id to call_transcripts
ALTER TABLE public.call_transcripts
ADD COLUMN prospect_id UUID REFERENCES public.prospects(id) ON DELETE SET NULL;

-- Add prospect_intel to ai_call_analysis
ALTER TABLE public.ai_call_analysis
ADD COLUMN prospect_intel JSONB;

-- Enable RLS
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospect_activities ENABLE ROW LEVEL SECURITY;

-- RLS Policies for prospects
CREATE POLICY "Reps can view own prospects"
ON public.prospects
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own prospects"
ON public.prospects
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own prospects"
ON public.prospects
FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own prospects"
ON public.prospects
FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team prospects"
ON public.prospects
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all prospects"
ON public.prospects
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for prospect_activities
CREATE POLICY "Reps can view own prospect activities"
ON public.prospect_activities
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own prospect activities"
ON public.prospect_activities
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own prospect activities"
ON public.prospect_activities
FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own prospect activities"
ON public.prospect_activities
FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team prospect activities"
ON public.prospect_activities
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all prospect activities"
ON public.prospect_activities
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create indexes for performance
CREATE INDEX idx_prospects_rep_id ON public.prospects(rep_id);
CREATE INDEX idx_prospects_status ON public.prospects(status);
CREATE INDEX idx_prospect_activities_prospect_id ON public.prospect_activities(prospect_id);
CREATE INDEX idx_call_transcripts_prospect_id ON public.call_transcripts(prospect_id);

-- Add updated_at trigger for prospects
CREATE TRIGGER update_prospects_updated_at
BEFORE UPDATE ON public.prospects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();