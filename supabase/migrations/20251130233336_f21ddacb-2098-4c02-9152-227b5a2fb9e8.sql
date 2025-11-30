-- Fix Security Definer View issue
-- Drop the view and recreate without SECURITY DEFINER (views inherit this by default, so we need to be explicit)

DROP VIEW IF EXISTS public.data_access_logs_with_user;

-- Create a regular view (not security definer) that respects RLS
CREATE VIEW public.data_access_logs_with_user 
WITH (security_invoker = true)
AS
SELECT 
  dal.*,
  p.name as user_name,
  p.email as user_email
FROM public.data_access_logs dal
LEFT JOIN public.profiles p ON dal.user_id = p.id;