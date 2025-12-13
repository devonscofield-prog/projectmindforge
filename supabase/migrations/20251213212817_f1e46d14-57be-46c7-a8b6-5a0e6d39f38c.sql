-- Create sales_coach_sessions table for persisting chat history
CREATE TABLE public.sales_coach_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prospect_id UUID NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, prospect_id)
);

-- Index for fast lookups
CREATE INDEX idx_sales_coach_sessions_user_prospect 
  ON public.sales_coach_sessions(user_id, prospect_id);

-- Enable RLS
ALTER TABLE public.sales_coach_sessions ENABLE ROW LEVEL SECURITY;

-- Reps can manage their own sessions
CREATE POLICY "Users can manage own coaching sessions"
  ON public.sales_coach_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Managers can view team sessions
CREATE POLICY "Managers can view team coaching sessions"
  ON public.sales_coach_sessions FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), user_id)
  );

-- Admins can view all
CREATE POLICY "Admins can view all coaching sessions"
  ON public.sales_coach_sessions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_sales_coach_sessions_updated_at
  BEFORE UPDATE ON public.sales_coach_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();