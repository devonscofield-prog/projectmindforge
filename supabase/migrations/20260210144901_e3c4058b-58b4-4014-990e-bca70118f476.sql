
CREATE TABLE public.rep_task_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.rep_task_templates
  ADD COLUMN sequence_id uuid REFERENCES public.rep_task_sequences(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.rep_task_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own sequences"
  ON public.rep_task_sequences FOR ALL
  USING (rep_id = auth.uid())
  WITH CHECK (rep_id = auth.uid());

-- Updated timestamp trigger
CREATE TRIGGER update_rep_task_sequences_updated_at
  BEFORE UPDATE ON public.rep_task_sequences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
