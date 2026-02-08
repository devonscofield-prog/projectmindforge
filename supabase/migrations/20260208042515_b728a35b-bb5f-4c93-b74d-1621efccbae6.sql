
-- Create admin_assistant_sessions table
CREATE TABLE public.admin_assistant_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  page_context TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_admin_assistant_sessions_user_active ON public.admin_assistant_sessions(user_id, is_active);
CREATE INDEX idx_admin_assistant_sessions_updated ON public.admin_assistant_sessions(updated_at DESC);

-- Enable RLS
ALTER TABLE public.admin_assistant_sessions ENABLE ROW LEVEL SECURITY;

-- RLS: Admins can only access their own sessions
CREATE POLICY "Admins can view own sessions"
  ON public.admin_assistant_sessions FOR SELECT
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert own sessions"
  ON public.admin_assistant_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update own sessions"
  ON public.admin_assistant_sessions FOR UPDATE
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete own sessions"
  ON public.admin_assistant_sessions FOR DELETE
  USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'admin'));

-- Auto-update updated_at
CREATE TRIGGER update_admin_assistant_sessions_updated_at
  BEFORE UPDATE ON public.admin_assistant_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
