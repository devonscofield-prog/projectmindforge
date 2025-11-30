-- Create transcript_chunks table for RAG
CREATE TABLE public.transcript_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_id UUID NOT NULL REFERENCES public.call_transcripts(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_transcript_chunks_transcript_id ON public.transcript_chunks(transcript_id);
CREATE INDEX idx_transcript_chunks_search_vector ON public.transcript_chunks USING GIN(search_vector);

-- Enable RLS
ALTER TABLE public.transcript_chunks ENABLE ROW LEVEL SECURITY;

-- Admin can manage all chunks
CREATE POLICY "Admins can manage all chunks"
  ON public.transcript_chunks FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Reps can view chunks for their own transcripts
CREATE POLICY "Reps can view own transcript chunks"
  ON public.transcript_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.call_transcripts ct 
      WHERE ct.id = transcript_chunks.transcript_id 
      AND ct.rep_id = auth.uid()
    )
  );

-- Managers can view team transcript chunks
CREATE POLICY "Managers can view team transcript chunks"
  ON public.transcript_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.call_transcripts ct 
      WHERE ct.id = transcript_chunks.transcript_id 
      AND has_role(auth.uid(), 'manager'::user_role)
      AND is_manager_of_user(auth.uid(), ct.rep_id)
    )
  );