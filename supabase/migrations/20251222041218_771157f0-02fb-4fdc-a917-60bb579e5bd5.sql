-- Create roleplay_personas table - AI-generated or manually created prospect personas
CREATE TABLE public.roleplay_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  persona_type TEXT NOT NULL,
  disc_profile TEXT,
  communication_style JSONB DEFAULT '{}'::jsonb,
  common_objections JSONB DEFAULT '[]'::jsonb,
  pain_points JSONB DEFAULT '[]'::jsonb,
  dos_and_donts JSONB DEFAULT '{}'::jsonb,
  backstory TEXT,
  difficulty_level TEXT DEFAULT 'medium',
  industry TEXT,
  voice TEXT DEFAULT 'alloy',
  is_active BOOLEAN DEFAULT true,
  is_ai_generated BOOLEAN DEFAULT false,
  source_data_refs JSONB DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create roleplay_sessions table - Individual practice sessions
CREATE TABLE public.roleplay_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  persona_id UUID REFERENCES public.roleplay_personas(id),
  session_type TEXT DEFAULT 'discovery',
  scenario_prompt TEXT,
  status TEXT DEFAULT 'pending',
  session_config JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  manager_id UUID REFERENCES auth.users(id),
  team_id UUID REFERENCES public.teams(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create roleplay_transcripts table - Voice conversation records
CREATE TABLE public.roleplay_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.roleplay_sessions(id) ON DELETE CASCADE,
  transcript_json JSONB DEFAULT '[]'::jsonb,
  raw_text TEXT,
  audio_url TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create roleplay_grades table - Evaluations of roleplay performance
CREATE TABLE public.roleplay_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.roleplay_sessions(id) ON DELETE CASCADE,
  grader_type TEXT DEFAULT 'ai',
  grader_id UUID REFERENCES auth.users(id),
  scores JSONB NOT NULL DEFAULT '{}'::jsonb,
  feedback JSONB DEFAULT '{}'::jsonb,
  overall_grade TEXT,
  coaching_prescription TEXT,
  focus_areas JSONB DEFAULT '[]'::jsonb,
  graded_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.roleplay_personas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roleplay_grades ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roleplay_personas
CREATE POLICY "Admins can manage all personas"
ON public.roleplay_personas FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can manage personas"
ON public.roleplay_personas FOR ALL
USING (has_role(auth.uid(), 'manager'::user_role))
WITH CHECK (has_role(auth.uid(), 'manager'::user_role));

CREATE POLICY "Trainees can view active personas"
ON public.roleplay_personas FOR SELECT
USING (has_role(auth.uid(), 'trainee'::user_role) AND is_active = true);

CREATE POLICY "Reps can view active personas"
ON public.roleplay_personas FOR SELECT
USING (has_role(auth.uid(), 'rep'::user_role) AND is_active = true);

-- RLS Policies for roleplay_sessions
CREATE POLICY "Admins can manage all sessions"
ON public.roleplay_sessions FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view team sessions"
ON public.roleplay_sessions FOR SELECT
USING (has_role(auth.uid(), 'manager'::user_role) AND (
  manager_id = auth.uid() OR 
  is_manager_of_user(auth.uid(), trainee_id)
));

CREATE POLICY "Trainees can manage own sessions"
ON public.roleplay_sessions FOR ALL
USING (auth.uid() = trainee_id)
WITH CHECK (auth.uid() = trainee_id);

CREATE POLICY "Reps can manage own sessions"
ON public.roleplay_sessions FOR ALL
USING (auth.uid() = trainee_id)
WITH CHECK (auth.uid() = trainee_id);

-- RLS Policies for roleplay_transcripts
CREATE POLICY "Admins can manage all transcripts"
ON public.roleplay_transcripts FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view team transcripts"
ON public.roleplay_transcripts FOR SELECT
USING (
  has_role(auth.uid(), 'manager'::user_role) AND
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_transcripts.session_id
    AND (rs.manager_id = auth.uid() OR is_manager_of_user(auth.uid(), rs.trainee_id))
  )
);

CREATE POLICY "Users can manage own session transcripts"
ON public.roleplay_transcripts FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_transcripts.session_id
    AND rs.trainee_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_transcripts.session_id
    AND rs.trainee_id = auth.uid()
  )
);

-- RLS Policies for roleplay_grades
CREATE POLICY "Admins can manage all grades"
ON public.roleplay_grades FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can manage team grades"
ON public.roleplay_grades FOR ALL
USING (
  has_role(auth.uid(), 'manager'::user_role) AND
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_grades.session_id
    AND (rs.manager_id = auth.uid() OR is_manager_of_user(auth.uid(), rs.trainee_id))
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::user_role) AND
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_grades.session_id
    AND (rs.manager_id = auth.uid() OR is_manager_of_user(auth.uid(), rs.trainee_id))
  )
);

CREATE POLICY "Users can view own session grades"
ON public.roleplay_grades FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.roleplay_sessions rs
    WHERE rs.id = roleplay_grades.session_id
    AND rs.trainee_id = auth.uid()
  )
);

-- Create updated_at triggers
CREATE TRIGGER update_roleplay_personas_updated_at
BEFORE UPDATE ON public.roleplay_personas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_roleplay_sessions_updated_at
BEFORE UPDATE ON public.roleplay_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_roleplay_sessions_trainee_id ON public.roleplay_sessions(trainee_id);
CREATE INDEX idx_roleplay_sessions_persona_id ON public.roleplay_sessions(persona_id);
CREATE INDEX idx_roleplay_sessions_status ON public.roleplay_sessions(status);
CREATE INDEX idx_roleplay_transcripts_session_id ON public.roleplay_transcripts(session_id);
CREATE INDEX idx_roleplay_grades_session_id ON public.roleplay_grades(session_id);
CREATE INDEX idx_roleplay_personas_is_active ON public.roleplay_personas(is_active);