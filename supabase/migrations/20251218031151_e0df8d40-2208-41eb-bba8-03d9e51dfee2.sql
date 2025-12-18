-- Function to update prospect last_contact_date when a call is added/updated
CREATE OR REPLACE FUNCTION public.update_prospect_last_contact_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the prospect's last_contact_date to the call_date if it's more recent
  IF NEW.prospect_id IS NOT NULL THEN
    UPDATE public.prospects
    SET last_contact_date = NEW.call_date,
        updated_at = now()
    WHERE id = NEW.prospect_id
      AND (last_contact_date IS NULL OR last_contact_date < NEW.call_date);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger on call_transcripts insert/update
CREATE TRIGGER update_last_contact_on_call
  AFTER INSERT OR UPDATE OF prospect_id, call_date ON public.call_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_prospect_last_contact_date();

-- Backfill existing prospects with their most recent call date
UPDATE public.prospects p
SET last_contact_date = sub.max_call_date,
    updated_at = now()
FROM (
  SELECT prospect_id, MAX(call_date) as max_call_date
  FROM public.call_transcripts
  WHERE prospect_id IS NOT NULL AND deleted_at IS NULL
  GROUP BY prospect_id
) sub
WHERE p.id = sub.prospect_id
  AND (p.last_contact_date IS NULL OR p.last_contact_date < sub.max_call_date);