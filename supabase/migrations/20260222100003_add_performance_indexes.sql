-- Performance indexes for common query patterns

-- For manual task queries filtering by rep, status, and source
CREATE INDEX IF NOT EXISTS idx_follow_ups_rep_status_source
  ON public.account_follow_ups(rep_id, status, source);

-- For sequence lookups by rep
CREATE INDEX IF NOT EXISTS idx_rep_task_sequences_rep_id
  ON public.rep_task_sequences(rep_id);

-- Partial index for secondary reminder queries
CREATE INDEX IF NOT EXISTS idx_follow_ups_secondary_reminder
  ON public.account_follow_ups(due_date, rep_id)
  WHERE status = 'pending'
    AND reminder_enabled = true
    AND reminder_sent_at IS NOT NULL
    AND secondary_reminder_sent_at IS NULL;
