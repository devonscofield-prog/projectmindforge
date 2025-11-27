-- Create overloaded has_role function with text parameter (coexists with user_role version)
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role = p_role::user_role
  )
$$;

-- Note: is_manager_of_user already exists with same signature (uuid, uuid)
-- Just update function body with CREATE OR REPLACE using same parameter names
CREATE OR REPLACE FUNCTION public.is_manager_of_user(_manager_id uuid, _rep_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    JOIN public.teams t ON p.team_id = t.id
    WHERE p.id = _rep_id 
      AND t.manager_id = _manager_id
  )
$$;