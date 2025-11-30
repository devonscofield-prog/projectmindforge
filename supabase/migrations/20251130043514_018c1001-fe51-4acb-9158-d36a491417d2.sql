-- Table for saved transcript selections
CREATE TABLE public.admin_transcript_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  transcript_ids uuid[] NOT NULL,
  filters jsonb,
  share_token text UNIQUE,
  is_shared boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Table for saved chat insights
CREATE TABLE public.admin_chat_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL,
  selection_id uuid REFERENCES public.admin_transcript_selections(id) ON DELETE SET NULL,
  title text NOT NULL,
  content text NOT NULL,
  chat_context jsonb,
  tags text[],
  share_token text UNIQUE,
  is_shared boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_transcript_selections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_chat_insights ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_transcript_selections
CREATE POLICY "Admins can manage own selections"
ON public.admin_transcript_selections
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id);

CREATE POLICY "Admins can view shared selections"
ON public.admin_transcript_selections
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) AND is_shared = true);

-- RLS policies for admin_chat_insights
CREATE POLICY "Admins can manage own insights"
ON public.admin_chat_insights
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id)
WITH CHECK (has_role(auth.uid(), 'admin'::user_role) AND auth.uid() = admin_id);

CREATE POLICY "Admins can view shared insights"
ON public.admin_chat_insights
FOR SELECT
USING (has_role(auth.uid(), 'admin'::user_role) AND is_shared = true);

-- Indexes for performance
CREATE INDEX idx_admin_selections_admin_id ON public.admin_transcript_selections(admin_id);
CREATE INDEX idx_admin_selections_share_token ON public.admin_transcript_selections(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX idx_admin_insights_admin_id ON public.admin_chat_insights(admin_id);
CREATE INDEX idx_admin_insights_selection_id ON public.admin_chat_insights(selection_id);
CREATE INDEX idx_admin_insights_share_token ON public.admin_chat_insights(share_token) WHERE share_token IS NOT NULL;

-- Triggers for updated_at
CREATE TRIGGER update_admin_transcript_selections_updated_at
BEFORE UPDATE ON public.admin_transcript_selections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_chat_insights_updated_at
BEFORE UPDATE ON public.admin_chat_insights
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();