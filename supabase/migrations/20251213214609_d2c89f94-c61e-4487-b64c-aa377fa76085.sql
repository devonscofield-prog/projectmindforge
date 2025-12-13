-- Create junction table for email log stakeholders
CREATE TABLE public.email_log_stakeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_log_id UUID NOT NULL REFERENCES public.email_logs(id) ON DELETE CASCADE,
  stakeholder_id UUID NOT NULL REFERENCES public.stakeholders(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email_log_id, stakeholder_id)
);

-- Enable RLS
ALTER TABLE public.email_log_stakeholders ENABLE ROW LEVEL SECURITY;

-- RLS policies for email_log_stakeholders
-- Reps can view email log stakeholders for their own prospects
CREATE POLICY "Reps can view email log stakeholders for their prospects"
ON public.email_log_stakeholders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.email_logs el
    JOIN public.prospects p ON el.prospect_id = p.id
    WHERE el.id = email_log_id 
    AND p.rep_id = auth.uid()
    AND p.deleted_at IS NULL
  )
);

-- Reps can insert email log stakeholders for their own email logs
CREATE POLICY "Reps can insert email log stakeholders"
ON public.email_log_stakeholders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.email_logs el
    WHERE el.id = email_log_id
    AND el.rep_id = auth.uid()
  )
);

-- Reps can delete email log stakeholders for their own email logs
CREATE POLICY "Reps can delete email log stakeholders"
ON public.email_log_stakeholders
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.email_logs el
    WHERE el.id = email_log_id
    AND el.rep_id = auth.uid()
  )
);

-- Managers can view email log stakeholders for their team
CREATE POLICY "Managers can view team email log stakeholders"
ON public.email_log_stakeholders
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.email_logs el
    JOIN public.profiles p ON el.rep_id = p.id
    JOIN public.teams t ON p.team_id = t.id
    WHERE el.id = email_log_id
    AND t.manager_id = auth.uid()
  )
);

-- Admins can do everything
CREATE POLICY "Admins can manage all email log stakeholders"
ON public.email_log_stakeholders
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Add index for performance
CREATE INDEX idx_email_log_stakeholders_email_log_id ON public.email_log_stakeholders(email_log_id);
CREATE INDEX idx_email_log_stakeholders_stakeholder_id ON public.email_log_stakeholders(stakeholder_id);