-- Add composite index on prospects for rep_id and status filtering
CREATE INDEX IF NOT EXISTS idx_prospects_rep_id_status ON public.prospects(rep_id, status);

-- Add composite index on email_logs for prospect lookups ordered by date
CREATE INDEX IF NOT EXISTS idx_email_logs_prospect_id_email_date ON public.email_logs(prospect_id, email_date DESC);