-- Create background_jobs table for tracking long-running operations
CREATE TABLE public.background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL, -- 'ner_backfill', 'embedding_backfill', 'full_reindex'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  progress JSONB DEFAULT '{}', -- {processed: 0, total: 1400, errors: 0}
  error TEXT,
  created_by UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.background_jobs ENABLE ROW LEVEL SECURITY;

-- Admins can manage all jobs
CREATE POLICY "Admins can manage all jobs" ON public.background_jobs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Users can view their own jobs
CREATE POLICY "Users can view own jobs" ON public.background_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = created_by);

-- Index for querying active jobs
CREATE INDEX idx_background_jobs_status ON public.background_jobs(status) WHERE status IN ('pending', 'processing');
CREATE INDEX idx_background_jobs_created_by ON public.background_jobs(created_by, created_at DESC);