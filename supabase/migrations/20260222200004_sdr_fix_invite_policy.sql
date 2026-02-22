-- Fix overly permissive public SELECT policy on sdr_team_invites.
--
-- The existing "Anyone can read active invites by token" policy allows anon
-- users to enumerate ALL active invites. The invite validation is handled
-- by the sdr-team-signup edge function using the service-role client, so
-- no anon RLS policy is needed.

-- Drop the permissive anon policy
DROP POLICY IF EXISTS "Anyone can read active invites by token" ON public.sdr_team_invites;
