-- Add 'bulk_upload' to call_source_type enum
ALTER TYPE public.call_source_type ADD VALUE IF NOT EXISTS 'bulk_upload';