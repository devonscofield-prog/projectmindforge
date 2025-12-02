-- Add new admin action types to user_activity_type enum
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'user_invited';
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'user_profile_updated';
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'user_role_changed';
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'password_reset_requested';
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'user_deactivated';
ALTER TYPE user_activity_type ADD VALUE IF NOT EXISTS 'user_reactivated';

-- Create index for faster querying of admin actions
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_activity_type ON user_activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_activity_logs_created_at ON user_activity_logs(created_at DESC);