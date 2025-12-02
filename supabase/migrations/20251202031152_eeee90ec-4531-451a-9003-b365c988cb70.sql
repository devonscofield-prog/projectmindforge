-- Add 'text_message' to prospect_activity_type enum
ALTER TYPE prospect_activity_type ADD VALUE IF NOT EXISTS 'text_message';