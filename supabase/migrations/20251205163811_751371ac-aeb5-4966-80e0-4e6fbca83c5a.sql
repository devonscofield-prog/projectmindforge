-- Add function to recover stuck "processing" transcripts
-- Resets transcripts that have been in "processing" state for more than 5 minutes

CREATE OR REPLACE FUNCTION public.recover_stuck_processing_transcripts()
RETURNS TABLE (
  transcript_id uuid,
  account_name text,
  stuck_since timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Return and reset transcripts stuck in processing for more than 5 minutes
  RETURN QUERY
  UPDATE call_transcripts
  SET 
    analysis_status = 'pending',
    analysis_error = 'Auto-recovered from stuck processing state after 5 minutes',
    updated_at = now()
  WHERE 
    analysis_status = 'processing'
    AND updated_at < now() - interval '5 minutes'
  RETURNING 
    id as transcript_id, 
    call_transcripts.account_name,
    updated_at as stuck_since;
END;
$$;

-- Grant execute permission to authenticated users (admins can call this)
GRANT EXECUTE ON FUNCTION public.recover_stuck_processing_transcripts() TO authenticated;

COMMENT ON FUNCTION public.recover_stuck_processing_transcripts IS 
  'Recovers transcripts stuck in processing state for more than 5 minutes by resetting them to pending status';