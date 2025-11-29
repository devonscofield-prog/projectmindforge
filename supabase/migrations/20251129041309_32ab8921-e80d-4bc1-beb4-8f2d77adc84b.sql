-- Create account_follow_ups table for AI-generated follow-up steps
CREATE TABLE public.account_follow_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT CHECK (priority IN ('high', 'medium', 'low')) DEFAULT 'medium',
  category TEXT CHECK (category IN ('discovery', 'stakeholder', 'objection', 'proposal', 'relationship', 'competitive')),
  status TEXT CHECK (status IN ('pending', 'completed', 'dismissed')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  generated_from_call_ids UUID[],
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add tracking fields to prospects table
ALTER TABLE public.prospects 
ADD COLUMN follow_ups_last_generated_at TIMESTAMPTZ,
ADD COLUMN follow_ups_generation_status TEXT DEFAULT 'idle' CHECK (follow_ups_generation_status IN ('idle', 'processing', 'completed', 'error'));

-- Enable RLS
ALTER TABLE public.account_follow_ups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for account_follow_ups
CREATE POLICY "Reps can view own follow-ups"
ON public.account_follow_ups
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own follow-ups"
ON public.account_follow_ups
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own follow-ups"
ON public.account_follow_ups
FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own follow-ups"
ON public.account_follow_ups
FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team follow-ups"
ON public.account_follow_ups
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all follow-ups"
ON public.account_follow_ups
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_account_follow_ups_updated_at
BEFORE UPDATE ON public.account_follow_ups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_account_follow_ups_prospect_id ON public.account_follow_ups(prospect_id);
CREATE INDEX idx_account_follow_ups_rep_status ON public.account_follow_ups(rep_id, status);