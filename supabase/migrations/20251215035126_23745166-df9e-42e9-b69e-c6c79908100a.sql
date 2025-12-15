-- Add is_active column to analysis_sessions for multi-session management
ALTER TABLE analysis_sessions ADD COLUMN is_active boolean DEFAULT true;

-- Create index for efficient querying of active sessions
CREATE INDEX idx_analysis_sessions_user_active ON analysis_sessions(user_id, is_active) WHERE is_active = true;