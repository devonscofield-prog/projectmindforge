-- Add compound indexes for analysis_sessions and admin_chat_insights performance

-- Compound index for analysis_sessions (user_id + updated_at DESC)
-- Enables index-only scans for: WHERE user_id = X ORDER BY updated_at DESC
CREATE INDEX IF NOT EXISTS idx_analysis_sessions_user_updated 
ON analysis_sessions (user_id, updated_at DESC);

-- Compound index for admin_chat_insights (admin_id + created_at DESC)
-- Enables index-only scans for: WHERE admin_id = X ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_admin_insights_admin_created 
ON admin_chat_insights (admin_id, created_at DESC);

-- Index for global ordering by created_at on admin_chat_insights
CREATE INDEX IF NOT EXISTS idx_admin_insights_created_at 
ON admin_chat_insights (created_at DESC);