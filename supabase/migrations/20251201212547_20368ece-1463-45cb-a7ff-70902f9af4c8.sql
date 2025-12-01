-- Add opportunity_details JSONB column to prospects table
ALTER TABLE prospects 
ADD COLUMN opportunity_details jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN prospects.opportunity_details IS 'User counts and potential revenue details: it_users_count, end_users_count, ai_users_count, compliance_users_count, security_awareness_count, notes, auto_populated_from (source, source_id, extracted_at)';