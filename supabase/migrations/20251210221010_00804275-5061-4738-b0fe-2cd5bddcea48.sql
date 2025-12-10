-- Disable the unreliable trigger that depends on empty vault
DROP TRIGGER IF EXISTS on_call_transcript_insert ON public.call_transcripts;

-- Keep the function but add a comment explaining why trigger is disabled
COMMENT ON FUNCTION public.trigger_analysis_on_insert() IS 'This function requires vault secrets which are not available in Lovable Cloud. Analysis is now triggered by pg_cron job calling trigger-pending-analyses edge function every minute.';