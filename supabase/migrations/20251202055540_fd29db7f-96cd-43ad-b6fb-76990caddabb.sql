-- Update handle_new_user trigger to support pending admin email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pending_admin_email TEXT;
  assigned_role user_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  
  -- Check if this email is the pending admin
  SELECT value INTO pending_admin_email
  FROM public.app_settings
  WHERE key = 'pending_admin_email';
  
  -- Assign role based on pending admin email
  IF pending_admin_email IS NOT NULL AND NEW.email = pending_admin_email THEN
    assigned_role := 'admin';
    
    -- Clear the pending admin email after use
    DELETE FROM public.app_settings WHERE key = 'pending_admin_email';
    
    RAISE NOTICE 'Assigned admin role to %', NEW.email;
  ELSE
    assigned_role := 'rep';
  END IF;
  
  -- Insert user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role);
  
  RETURN NEW;
END;
$$;