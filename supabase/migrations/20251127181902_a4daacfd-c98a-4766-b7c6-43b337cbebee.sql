-- Create call_transcripts table
CREATE TABLE public.call_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  call_date timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'manual_paste',
  raw_text text NOT NULL,
  notes text,
  
  -- AI meta fields
  analysis_status text NOT NULL DEFAULT 'pending',
  analysis_error text,
  analysis_version int NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for call_transcripts
CREATE INDEX idx_call_transcripts_rep_id ON public.call_transcripts(rep_id);
CREATE INDEX idx_call_transcripts_call_date ON public.call_transcripts(call_date);

-- Enable RLS
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for call_transcripts
CREATE POLICY "Reps can view own transcripts"
ON public.call_transcripts
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own transcripts"
ON public.call_transcripts
FOR INSERT
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Managers can view team transcripts"
ON public.call_transcripts
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Managers can insert team transcripts"
ON public.call_transcripts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can manage all transcripts"
ON public.call_transcripts
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Trigger for updated_at
CREATE TRIGGER update_call_transcripts_updated_at
BEFORE UPDATE ON public.call_transcripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create ai_call_analysis table
CREATE TABLE public.ai_call_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id uuid NOT NULL UNIQUE REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  rep_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name text,
  prompt_version int NOT NULL DEFAULT 1,
  confidence text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  -- Summary & metadata (Category 1)
  call_summary text NOT NULL,
  call_type text,
  customer_persona text,
  key_topics jsonb,
  next_steps_mentioned jsonb,
  pain_points jsonb,
  key_quotes jsonb,
  estimated_duration_seconds int,
  speaker_stats jsonb,
  
  -- Discovery (Category 2)
  discovery_score int,
  discovery_num_questions int,
  discovery_depth_notes text,
  discovery_missed_opportunities jsonb,
  discovery_good_examples jsonb,
  discovery_improvement_suggestions text,
  
  -- Objection Handling (Category 3)
  objection_score int,
  objections_raised jsonb,
  objection_quality_notes text,
  objection_missed_opportunities jsonb,
  objection_good_examples jsonb,
  objection_needs_work_examples jsonb,
  objection_improvement_suggestions text,
  used_aaa_model boolean,
  
  -- Rapport & Communication (Category 4)
  rapport_score int,
  tone_notes text,
  rapport_strengths jsonb,
  rapport_opportunities jsonb,
  talk_listen_ratio jsonb,
  communication_good_examples jsonb,
  communication_needs_work_examples jsonb,
  
  -- Product Knowledge (Category 5)
  product_knowledge_score int,
  product_positioning_notes text,
  product_knowledge_gaps jsonb,
  product_knowledge_strengths jsonb,
  product_knowledge_opportunities jsonb,
  product_knowledge_improvement_suggestions text,
  
  -- Deal Gaps & Missed Opportunities (Category 6)
  critical_missing_info jsonb,
  unresolved_objections jsonb,
  open_customer_questions jsonb,
  missed_deal_opportunities jsonb,
  explicit_followups_from_call jsonb,
  
  -- Scoring & Tags (Categories 7 & 8)
  deal_advancement_score int,
  call_effectiveness_score int,
  skill_tags jsonb,
  deal_tags jsonb,
  meta_tags jsonb
);

-- Indexes for ai_call_analysis
CREATE INDEX idx_ai_call_analysis_rep_id ON public.ai_call_analysis(rep_id);
CREATE INDEX idx_ai_call_analysis_call_effectiveness ON public.ai_call_analysis(call_effectiveness_score);

-- Enable RLS
ALTER TABLE public.ai_call_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_call_analysis (SELECT only from client)
CREATE POLICY "Reps can view own analysis"
ON public.ai_call_analysis
FOR SELECT
USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team analysis"
ON public.ai_call_analysis
FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Admins can view all analysis"
ON public.ai_call_analysis
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role));