-- Create enum for stakeholder influence levels
CREATE TYPE stakeholder_influence_level AS ENUM (
  'light_influencer',
  'heavy_influencer',
  'secondary_dm',
  'final_dm'
);

-- Create stakeholders table
CREATE TABLE public.stakeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL,
  name TEXT NOT NULL,
  job_title TEXT,
  email TEXT,
  phone TEXT,
  influence_level stakeholder_influence_level DEFAULT 'light_influencer',
  champion_score INTEGER CHECK (champion_score >= 1 AND champion_score <= 10),
  champion_score_reasoning TEXT,
  ai_extracted_info JSONB,
  is_primary_contact BOOLEAN DEFAULT false,
  last_interaction_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create call_stakeholder_mentions junction table
CREATE TABLE public.call_stakeholder_mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id UUID NOT NULL REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  was_present BOOLEAN DEFAULT true,
  context_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(call_id, stakeholder_id)
);

-- Enable RLS on new tables
ALTER TABLE public.stakeholders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_stakeholder_mentions ENABLE ROW LEVEL SECURITY;

-- RLS policies for stakeholders
CREATE POLICY "Reps can view own stakeholders"
ON public.stakeholders FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own stakeholders"
ON public.stakeholders FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own stakeholders"
ON public.stakeholders FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own stakeholders"
ON public.stakeholders FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team stakeholders"
ON public.stakeholders FOR SELECT
USING (has_role(auth.uid(), 'manager') AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all stakeholders"
ON public.stakeholders FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS policies for call_stakeholder_mentions
CREATE POLICY "Reps can view own call mentions"
ON public.call_stakeholder_mentions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stakeholders s 
    WHERE s.id = stakeholder_id AND s.rep_id = auth.uid()
  )
);

CREATE POLICY "Reps can insert own call mentions"
ON public.call_stakeholder_mentions FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.stakeholders s 
    WHERE s.id = stakeholder_id AND s.rep_id = auth.uid()
  )
);

CREATE POLICY "Reps can delete own call mentions"
ON public.call_stakeholder_mentions FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.stakeholders s 
    WHERE s.id = stakeholder_id AND s.rep_id = auth.uid()
  )
);

CREATE POLICY "Managers can view team call mentions"
ON public.call_stakeholder_mentions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.stakeholders s 
    WHERE s.id = stakeholder_id 
    AND has_role(auth.uid(), 'manager') 
    AND is_manager_of_user(auth.uid(), s.rep_id)
  )
);

CREATE POLICY "Admins can manage all call mentions"
ON public.call_stakeholder_mentions FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Create indexes for performance
CREATE INDEX idx_stakeholders_prospect_id ON public.stakeholders(prospect_id);
CREATE INDEX idx_stakeholders_rep_id ON public.stakeholders(rep_id);
CREATE INDEX idx_call_stakeholder_mentions_call_id ON public.call_stakeholder_mentions(call_id);
CREATE INDEX idx_call_stakeholder_mentions_stakeholder_id ON public.call_stakeholder_mentions(stakeholder_id);

-- Add trigger for updated_at on stakeholders
CREATE TRIGGER update_stakeholders_updated_at
BEFORE UPDATE ON public.stakeholders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing prospect_name data to stakeholders
INSERT INTO public.stakeholders (prospect_id, rep_id, name, is_primary_contact, last_interaction_date)
SELECT 
  p.id,
  p.rep_id,
  COALESCE(p.prospect_name, 'Unknown Contact'),
  true,
  p.last_contact_date
FROM public.prospects p
WHERE p.prospect_name IS NOT NULL AND p.prospect_name != '';