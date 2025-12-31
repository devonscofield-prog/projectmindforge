-- Create sales_assistant_sessions table for global rep AI chat
CREATE TABLE public.sales_assistant_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  title text,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_assistant_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can manage own sessions" ON public.sales_assistant_sessions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all sessions" ON public.sales_assistant_sessions
  FOR SELECT USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view team sessions" ON public.sales_assistant_sessions
  FOR SELECT USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), user_id)
  );

-- Index for faster lookups
CREATE INDEX idx_sales_assistant_sessions_user_active 
  ON public.sales_assistant_sessions(user_id, is_active);

-- Trigger for updated_at
CREATE TRIGGER update_sales_assistant_sessions_updated_at
  BEFORE UPDATE ON public.sales_assistant_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();