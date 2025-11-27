-- Add currency precision to revenue fields in rep_performance_snapshots
ALTER TABLE public.rep_performance_snapshots 
  ALTER COLUMN revenue_closed TYPE numeric(12,2),
  ALTER COLUMN revenue_goal TYPE numeric(12,2);

-- Add notes column to profiles
ALTER TABLE public.profiles 
  ADD COLUMN notes text NULL;