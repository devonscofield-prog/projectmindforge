-- Create function to recover stuck roleplay sessions
CREATE OR REPLACE FUNCTION public.recover_stuck_roleplay_sessions(
  p_threshold_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
  session_id uuid, 
  trainee_name text, 
  persona_name text, 
  stuck_since timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE roleplay_sessions rs
  SET 
    status = 'abandoned',
    ended_at = now(),
    session_config = rs.session_config || '{"auto_recovered": true}'::jsonb
  FROM profiles p, roleplay_personas rp
  WHERE rs.trainee_id = p.id
    AND rs.persona_id = rp.id
    AND rs.status = 'in_progress'
    AND rs.started_at < now() - (p_threshold_minutes || ' minutes')::interval
  RETURNING 
    rs.id as session_id,
    p.name as trainee_name,
    rp.name as persona_name,
    rs.started_at as stuck_since;
END;
$$;