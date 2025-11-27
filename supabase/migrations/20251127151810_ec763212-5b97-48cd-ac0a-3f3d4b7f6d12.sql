-- Create convenience view joining profiles and user_roles
-- Uses security_invoker to respect RLS policies on underlying tables
CREATE OR REPLACE VIEW public.user_with_role
WITH (security_invoker = true) AS
SELECT
  p.id,
  p.name,
  p.email,
  p.team_id,
  p.hire_date,
  p.is_active,
  p.created_at,
  p.updated_at,
  ur.role
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id;