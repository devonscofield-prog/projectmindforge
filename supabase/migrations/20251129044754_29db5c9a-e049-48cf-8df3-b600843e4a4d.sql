-- Add stakeholder_id column to email_logs table
ALTER TABLE public.email_logs 
ADD COLUMN stakeholder_id uuid REFERENCES public.stakeholders(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_email_logs_stakeholder_id ON public.email_logs(stakeholder_id);