-- Add 'skipped' value to call_analysis_status enum for index-only bulk uploads
ALTER TYPE call_analysis_status ADD VALUE 'skipped';