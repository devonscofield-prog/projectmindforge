-- Update recover_stuck_processing_transcripts to handle both "processing" AND "pending" stuck calls
-- This migration already exists in the codebase but may need to be applied

DROP FUNCTION IF EXISTS public.recover_stuck_processing_transcripts();

CREATE OR REPLACE FUNCTION public.recover_stuck_processing_transcripts()
 RETURNS TABLE(transcript_id uuid, account_name text, stuck_since timestamp with time zone, previous_status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Return and reset transcripts stuck in processing OR pending for more than 5 minutes
  RETURN QUERY
  UPDATE call_transcripts
  SET 
    analysis_status = 'pending',
    analysis_error = CASE 
      WHEN analysis_status = 'processing' THEN 'Auto-recovered from stuck processing state after 5 minutes'
      ELSE 'Auto-recovered from stuck pending state after 5 minutes'
    END,
    updated_at = now()
  WHERE 
    analysis_status IN ('processing', 'pending')
    AND updated_at < now() - interval '5 minutes'
  RETURNING 
    id as transcript_id, 
    call_transcripts.account_name,
    updated_at as stuck_since,
    analysis_status::text as previous_status;
END;
$function$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.recover_stuck_processing_transcripts() TO authenticated;

COMMENT ON FUNCTION public.recover_stuck_processing_transcripts IS 
  'Recovers transcripts stuck in processing or pending state for more than 5 minutes by resetting them';