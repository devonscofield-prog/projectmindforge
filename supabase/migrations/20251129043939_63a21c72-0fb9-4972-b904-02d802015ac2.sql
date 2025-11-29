-- Create enum for email direction
CREATE TYPE email_direction AS ENUM ('incoming', 'outgoing');

-- Create email_logs table
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  rep_id UUID NOT NULL,
  direction email_direction NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  email_date DATE NOT NULL DEFAULT CURRENT_DATE,
  contact_name TEXT,
  contact_email TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient lookups
CREATE INDEX idx_email_logs_prospect_id ON public.email_logs(prospect_id);
CREATE INDEX idx_email_logs_rep_id ON public.email_logs(rep_id);
CREATE INDEX idx_email_logs_email_date ON public.email_logs(email_date DESC);

-- Enable Row Level Security
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Reps can view own email logs"
ON public.email_logs
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own email logs"
ON public.email_logs
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own email logs"
ON public.email_logs
FOR UPDATE
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can delete own email logs"
ON public.email_logs
FOR DELETE
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team email logs"
ON public.email_logs
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all email logs"
ON public.email_logs
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_email_logs_updated_at
BEFORE UPDATE ON public.email_logs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();