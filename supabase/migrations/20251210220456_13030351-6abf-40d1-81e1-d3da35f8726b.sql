-- Enable pg_net extension for HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Function to trigger analysis via HTTP when a new transcript is inserted
CREATE OR REPLACE FUNCTION public.trigger_analysis_on_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT;
  service_key TEXT;
BEGIN
  -- Only trigger if status is pending (new submission)
  IF NEW.analysis_status = 'pending' THEN
    -- Get Supabase URL from vault or use hardcoded value
    supabase_url := 'https://wuquclmippzuejqbcksl.supabase.co';
    
    -- Get service role key from vault
    SELECT decrypted_secret INTO service_key
    FROM vault.decrypted_secrets
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
    LIMIT 1;
    
    -- If no vault secret, try environment (for local dev)
    IF service_key IS NULL THEN
      service_key := current_setting('app.settings.service_role_key', true);
    END IF;
    
    -- Only proceed if we have the service key
    IF service_key IS NOT NULL AND service_key != '' THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/analyze-call',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body := jsonb_build_object('call_id', NEW.id)::text,
        timeout_milliseconds := 5000
      );
    END IF;
  END IF;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'trigger_analysis_on_insert failed for call %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- Create trigger on call_transcripts insert
DROP TRIGGER IF EXISTS on_call_transcript_insert ON public.call_transcripts;
CREATE TRIGGER on_call_transcript_insert
AFTER INSERT ON public.call_transcripts
FOR EACH ROW
EXECUTE FUNCTION public.trigger_analysis_on_insert();

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.trigger_analysis_on_insert() TO service_role;

-- Add comment explaining the trigger
COMMENT ON FUNCTION public.trigger_analysis_on_insert() IS 
'Automatically triggers AI analysis when a new call transcript is inserted. 
This ensures analysis runs even if the frontend fire-and-forget call fails.';