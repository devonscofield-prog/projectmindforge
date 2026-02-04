-- Extend account_follow_ups table for manual tasks
ALTER TABLE account_follow_ups 
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'ai',
  ADD COLUMN IF NOT EXISTS due_date DATE,
  ADD COLUMN IF NOT EXISTS reminder_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_call_id UUID REFERENCES call_transcripts(id);

-- Add check constraint for source field
ALTER TABLE account_follow_ups 
  ADD CONSTRAINT check_follow_up_source CHECK (source IN ('ai', 'manual'));

-- Index for reminder scheduling (partial index for efficiency)
CREATE INDEX IF NOT EXISTS idx_follow_ups_due_reminders 
  ON account_follow_ups(due_date, reminder_enabled) 
  WHERE status = 'pending' AND reminder_enabled = true AND reminder_sent_at IS NULL;

-- Index for querying by source call
CREATE INDEX IF NOT EXISTS idx_follow_ups_source_call 
  ON account_follow_ups(source_call_id) 
  WHERE source_call_id IS NOT NULL;