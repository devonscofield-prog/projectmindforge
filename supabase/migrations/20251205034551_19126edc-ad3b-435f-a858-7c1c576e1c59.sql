-- Drop the overly permissive managers policy and replace with stricter one
DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;

-- Create a more restrictive policy for managers - only their direct team members
CREATE POLICY "Managers can view direct team profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::user_role) 
  AND team_id IS NOT NULL 
  AND team_id IN (
    SELECT id FROM public.teams WHERE manager_id = auth.uid()
  )
);

-- Also ensure reps can see basic info of other team members (just names, not emails)
-- by creating a view with limited columns
CREATE OR REPLACE VIEW public.team_member_names AS
SELECT 
  p.id,
  p.name,
  p.team_id,
  p.is_active
FROM public.profiles p
WHERE 
  p.id = auth.uid() -- own profile
  OR has_role(auth.uid(), 'admin'::user_role) -- admins see all
  OR (
    has_role(auth.uid(), 'manager'::user_role) 
    AND p.team_id IN (SELECT id FROM public.teams WHERE manager_id = auth.uid())
  ) -- managers see team
  OR (
    -- team members can see each other's names (not emails)
    p.team_id = (SELECT team_id FROM public.profiles WHERE id = auth.uid())
    AND p.team_id IS NOT NULL
  );