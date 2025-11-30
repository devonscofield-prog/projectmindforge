-- Create analysis_sessions table to auto-save chat conversations
CREATE TABLE public.analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transcript_ids UUID[] NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  analysis_mode TEXT DEFAULT 'general',
  use_rag BOOLEAN DEFAULT false,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analysis_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for all 3 roles (admin, manager, rep)
-- Each user can only access their own sessions

CREATE POLICY "Admins can manage own sessions"
ON public.analysis_sessions FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = user_id);

CREATE POLICY "Managers can manage own sessions"
ON public.analysis_sessions FOR ALL
USING (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND auth.uid() = user_id);

CREATE POLICY "Reps can manage own sessions"
ON public.analysis_sessions FOR ALL
USING (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = user_id)
WITH CHECK (has_role(auth.uid(), 'rep'::user_role) AND auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_analysis_sessions_updated_at
  BEFORE UPDATE ON public.analysis_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_analysis_sessions_user_id ON public.analysis_sessions(user_id);
CREATE INDEX idx_analysis_sessions_transcript_ids ON public.analysis_sessions USING GIN(transcript_ids);