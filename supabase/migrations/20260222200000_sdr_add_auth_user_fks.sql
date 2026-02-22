-- Add FK constraints from SDR tables to auth.users for proper CASCADE behavior.
-- Existing FKs point to profiles(id); these new FKs point to auth.users(id)
-- so that user deletion cascades correctly.

-- Step 1: Clean orphaned rows where the referenced user no longer exists
DELETE FROM public.sdr_team_invites
WHERE created_by NOT IN (SELECT id FROM auth.users);

DELETE FROM public.sdr_call_grades
WHERE sdr_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.sdr_calls
WHERE sdr_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.sdr_daily_transcripts
WHERE sdr_id NOT IN (SELECT id FROM auth.users);

DELETE FROM public.sdr_daily_transcripts
WHERE uploaded_by NOT IN (SELECT id FROM auth.users);

DELETE FROM public.sdr_teams
WHERE manager_id NOT IN (SELECT id FROM auth.users);

-- Step 2: Add FK constraints (idempotent via IF NOT EXISTS checks)

-- sdr_daily_transcripts.sdr_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_daily_transcripts_sdr_id_auth_fkey'
      AND table_name = 'sdr_daily_transcripts'
  ) THEN
    ALTER TABLE public.sdr_daily_transcripts
      ADD CONSTRAINT sdr_daily_transcripts_sdr_id_auth_fkey
      FOREIGN KEY (sdr_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- sdr_daily_transcripts.uploaded_by → auth.users(id) ON DELETE SET NULL
-- First make uploaded_by nullable so SET NULL works
ALTER TABLE public.sdr_daily_transcripts
  ALTER COLUMN uploaded_by DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_daily_transcripts_uploaded_by_auth_fkey'
      AND table_name = 'sdr_daily_transcripts'
  ) THEN
    ALTER TABLE public.sdr_daily_transcripts
      ADD CONSTRAINT sdr_daily_transcripts_uploaded_by_auth_fkey
      FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- sdr_calls.sdr_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_calls_sdr_id_auth_fkey'
      AND table_name = 'sdr_calls'
  ) THEN
    ALTER TABLE public.sdr_calls
      ADD CONSTRAINT sdr_calls_sdr_id_auth_fkey
      FOREIGN KEY (sdr_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- sdr_call_grades.sdr_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_call_grades_sdr_id_auth_fkey'
      AND table_name = 'sdr_call_grades'
  ) THEN
    ALTER TABLE public.sdr_call_grades
      ADD CONSTRAINT sdr_call_grades_sdr_id_auth_fkey
      FOREIGN KEY (sdr_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- sdr_teams.manager_id → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_teams_manager_id_auth_fkey'
      AND table_name = 'sdr_teams'
  ) THEN
    ALTER TABLE public.sdr_teams
      ADD CONSTRAINT sdr_teams_manager_id_auth_fkey
      FOREIGN KEY (manager_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- sdr_team_invites.created_by → auth.users(id) ON DELETE CASCADE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'sdr_team_invites_created_by_auth_fkey'
      AND table_name = 'sdr_team_invites'
  ) THEN
    ALTER TABLE public.sdr_team_invites
      ADD CONSTRAINT sdr_team_invites_created_by_auth_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;
