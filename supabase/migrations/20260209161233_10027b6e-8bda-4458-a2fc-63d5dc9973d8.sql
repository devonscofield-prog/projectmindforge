
-- Drop trainee-specific RLS policy
DROP POLICY IF EXISTS "Trainees can view active personas" ON public.roleplay_personas;

-- Drop RLS policy that directly references user_roles.role column
DROP POLICY IF EXISTS "Admins can manage all email log stakeholders" ON public.email_log_stakeholders;

-- Drop the view that depends on user_roles.role
DROP VIEW IF EXISTS public.user_with_role;

-- Create new enum without trainee
CREATE TYPE public.user_role_new AS ENUM ('rep', 'manager', 'admin');

-- Drop default, alter type, restore default
ALTER TABLE public.user_roles ALTER COLUMN role DROP DEFAULT;
ALTER TABLE public.user_roles 
  ALTER COLUMN role TYPE public.user_role_new 
  USING role::text::public.user_role_new;
ALTER TABLE public.user_roles ALTER COLUMN role SET DEFAULT 'rep'::public.user_role_new;

-- Drop old enum (CASCADE drops dependent functions) and rename
DROP TYPE public.user_role CASCADE;
ALTER TYPE public.user_role_new RENAME TO user_role;

-- Recreate the view
CREATE VIEW public.user_with_role AS
SELECT p.id, p.name, p.email, p.team_id, p.hire_date, p.is_active, p.created_at, p.updated_at, ur.role
FROM profiles p JOIN user_roles ur ON ur.user_id = p.id;

-- Recreate the dropped RLS policy
CREATE POLICY "Admins can manage all email log stakeholders"
ON public.email_log_stakeholders
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid() AND user_roles.role = 'admin'::user_role
));

-- Recreate get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1 $$;

-- Recreate has_role (typed)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- Recreate has_role (text)
CREATE OR REPLACE FUNCTION public.has_role(p_user_id uuid, p_role text)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = p_role::user_role) $$;

-- Recreate handle_new_user
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  pending_admin_email TEXT;
  assigned_role user_role;
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email), NEW.email);
  SELECT value INTO pending_admin_email FROM public.app_settings WHERE key = 'pending_admin_email';
  IF pending_admin_email IS NOT NULL AND NEW.email = pending_admin_email THEN
    assigned_role := 'admin';
    DELETE FROM public.app_settings WHERE key = 'pending_admin_email';
  ELSE
    assigned_role := 'rep';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
