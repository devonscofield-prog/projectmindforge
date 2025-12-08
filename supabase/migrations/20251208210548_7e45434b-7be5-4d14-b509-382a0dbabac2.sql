-- Restrict dashboard_cache RLS policy to admins and managers only
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can read cache" ON public.dashboard_cache;

-- Create admin-only read policy (managers don't need performance cache)
CREATE POLICY "Admins can read cache" 
ON public.dashboard_cache 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::user_role));