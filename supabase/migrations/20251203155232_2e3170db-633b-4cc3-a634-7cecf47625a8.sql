-- Add 'user_deleted' to user_activity_type enum
ALTER TYPE public.user_activity_type ADD VALUE IF NOT EXISTS 'user_deleted';