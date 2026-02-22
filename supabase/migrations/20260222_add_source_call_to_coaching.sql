-- Add source_call_id to coaching_sessions to link coaching sessions to specific calls
ALTER TABLE coaching_sessions
  ADD COLUMN source_call_id UUID REFERENCES call_transcripts(id) ON DELETE SET NULL;

-- Index for looking up coaching sessions by call
CREATE INDEX idx_coaching_sessions_source_call_id ON coaching_sessions(source_call_id);
