-- Phase 1: Add missing indexes on frequently-queried columns

-- High-priority indexes for RLS and filtering
CREATE INDEX IF NOT EXISTS idx_prospect_activities_rep_id 
ON prospect_activities(rep_id);

CREATE INDEX IF NOT EXISTS idx_stakeholder_relationships_prospect_id 
ON stakeholder_relationships(prospect_id);

CREATE INDEX IF NOT EXISTS idx_stakeholder_relationships_rep_id 
ON stakeholder_relationships(rep_id);

-- Performance metrics filtering for error queries
CREATE INDEX IF NOT EXISTS idx_performance_metrics_status 
ON performance_metrics(status) WHERE status = 'error';

-- Optimize transcript_chunks for RAG queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_extraction_status 
ON transcript_chunks(extraction_status) 
WHERE extraction_status = 'pending';

-- Partial index for embedding backfill queries
CREATE INDEX IF NOT EXISTS idx_transcript_chunks_null_embeddings 
ON transcript_chunks(transcript_id) 
WHERE embedding IS NULL;

-- Index for user_roles lookups (heavily hit by RLS policies)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);

-- Index for teams manager lookups
CREATE INDEX IF NOT EXISTS idx_teams_manager_id 
ON teams(manager_id);

-- Index for profiles team lookups
CREATE INDEX IF NOT EXISTS idx_profiles_team_id 
ON profiles(team_id) WHERE team_id IS NOT NULL;