-- Add columns to coaching_trend_analyses for history/snapshot functionality
ALTER TABLE public.coaching_trend_analyses 
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS is_snapshot BOOLEAN NOT NULL DEFAULT false;

-- Add index for faster history queries
CREATE INDEX IF NOT EXISTS idx_coaching_trend_analyses_rep_created 
  ON public.coaching_trend_analyses (rep_id, created_at DESC);

-- Add index for snapshots
CREATE INDEX IF NOT EXISTS idx_coaching_trend_analyses_snapshots 
  ON public.coaching_trend_analyses (rep_id, is_snapshot) 
  WHERE is_snapshot = true;