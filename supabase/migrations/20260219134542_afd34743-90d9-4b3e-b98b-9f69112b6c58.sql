
-- Create sdr_assistant_sessions table for chat persistence
CREATE TABLE public.sdr_assistant_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  title TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sdr_assistant_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own sessions
CREATE POLICY "Users can view own sdr sessions"
  ON public.sdr_assistant_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sdr sessions"
  ON public.sdr_assistant_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sdr sessions"
  ON public.sdr_assistant_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sdr sessions"
  ON public.sdr_assistant_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_sdr_assistant_sessions_user_active 
  ON public.sdr_assistant_sessions (user_id, is_active, updated_at DESC);
