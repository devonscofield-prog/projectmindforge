-- Drop existing tables and types to recreate with new schema
DROP TABLE IF EXISTS public.ai_call_analysis CASCADE;
DROP TABLE IF EXISTS public.call_transcripts CASCADE;

-- Create enums if they don't exist
DO $$ BEGIN
  CREATE TYPE public.call_source_type AS ENUM ('zoom', 'teams', 'dialer', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.call_analysis_status AS ENUM ('pending', 'processing', 'completed', 'error');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create call_transcripts table
CREATE TABLE public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES public.profiles(id),
  call_date date NOT NULL DEFAULT CURRENT_DATE,
  source public.call_source_type NOT NULL DEFAULT 'other',
  raw_text text NOT NULL,
  notes text,
  analysis_status public.call_analysis_status NOT NULL DEFAULT 'pending',
  analysis_error text,
  analysis_version text NOT NULL DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for call_transcripts
CREATE INDEX idx_call_transcripts_rep_date ON public.call_transcripts(rep_id, call_date DESC);
CREATE INDEX idx_call_transcripts_status ON public.call_transcripts(analysis_status);

-- Create ai_call_analysis table
CREATE TABLE public.ai_call_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  prompt_version text NOT NULL DEFAULT 'v1',
  confidence numeric,
  call_summary text NOT NULL,
  discovery_score numeric,
  objection_handling_score numeric,
  rapport_communication_score numeric,
  product_knowledge_score numeric,
  deal_advancement_score numeric,
  call_effectiveness_score numeric,
  trend_indicators jsonb,
  deal_gaps jsonb,
  strengths jsonb,
  opportunities jsonb,
  skill_tags text[],
  deal_tags text[],
  meta_tags text[],
  raw_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for ai_call_analysis
CREATE UNIQUE INDEX idx_ai_call_analysis_call_id ON public.ai_call_analysis(call_id);
CREATE INDEX idx_ai_call_analysis_rep_created ON public.ai_call_analysis(rep_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_transcripts

-- Reps can SELECT own transcripts
CREATE POLICY "Reps can view own transcripts"
ON public.call_transcripts FOR SELECT
USING (auth.uid() = rep_id);

-- Reps can INSERT own transcripts
CREATE POLICY "Reps can insert own transcripts"
ON public.call_transcripts FOR INSERT
WITH CHECK (auth.uid() = rep_id);

-- Reps can UPDATE own transcripts
CREATE POLICY "Reps can update own transcripts"
ON public.call_transcripts FOR UPDATE
USING (auth.uid() = rep_id);

-- Managers can SELECT team transcripts
CREATE POLICY "Managers can view team transcripts"
ON public.call_transcripts FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

-- Managers can INSERT team transcripts
CREATE POLICY "Managers can insert team transcripts"
ON public.call_transcripts FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

-- Managers can UPDATE team transcripts
CREATE POLICY "Managers can update team transcripts"
ON public.call_transcripts FOR UPDATE
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

-- Admins can manage all transcripts
CREATE POLICY "Admins can manage all transcripts"
ON public.call_transcripts FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- RLS Policies for ai_call_analysis

-- Reps can SELECT own analysis
CREATE POLICY "Reps can view own analysis"
ON public.ai_call_analysis FOR SELECT
USING (auth.uid() = rep_id);

-- Managers can SELECT team analysis
CREATE POLICY "Managers can view team analysis"
ON public.ai_call_analysis FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

-- Admins can SELECT all analysis
CREATE POLICY "Admins can view all analysis"
ON public.ai_call_analysis FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at on call_transcripts
CREATE TRIGGER update_call_transcripts_updated_at
BEFORE UPDATE ON public.call_transcripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();