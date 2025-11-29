-- Create stakeholder_relationships table
CREATE TABLE public.stakeholder_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  source_stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  target_stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('reports_to', 'influences', 'collaborates_with', 'opposes')),
  strength INTEGER DEFAULT 5 CHECK (strength >= 1 AND strength <= 10),
  notes TEXT,
  rep_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_stakeholder_id, target_stakeholder_id, relationship_type)
);

-- Enable RLS
ALTER TABLE public.stakeholder_relationships ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reps can view own relationships"
ON public.stakeholder_relationships
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own relationships"
ON public.stakeholder_relationships
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own relationships"
ON public.stakeholder_relationships
FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own relationships"
ON public.stakeholder_relationships
FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team relationships"
ON public.stakeholder_relationships
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all relationships"
ON public.stakeholder_relationships
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create updated_at trigger
CREATE TRIGGER update_stakeholder_relationships_updated_at
BEFORE UPDATE ON public.stakeholder_relationships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();