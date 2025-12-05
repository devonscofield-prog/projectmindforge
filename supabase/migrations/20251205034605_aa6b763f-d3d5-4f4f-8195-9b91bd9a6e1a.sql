-- Drop the view that was created with SECURITY DEFINER
DROP VIEW IF EXISTS public.team_member_names;

-- Recreate with SECURITY INVOKER (which respects RLS of the querying user)
CREATE VIEW public.team_member_names 
WITH (security_invoker = true) AS
SELECT 
  p.id,
  p.name,
  p.team_id,
  p.is_active
FROM public.profiles p;