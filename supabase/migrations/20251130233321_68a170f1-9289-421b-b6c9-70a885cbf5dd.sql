-- ============================================
-- Phase 2: Data Protection & Audit Trail
-- ============================================

-- 1. Create data_access_logs table for audit trail
CREATE TABLE IF NOT EXISTS public.data_access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  access_type text NOT NULL CHECK (access_type IN ('view', 'export', 'download', 'share')),
  access_reason text,
  ip_address text,
  user_agent text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_data_access_logs_user_id ON public.data_access_logs(user_id);
CREATE INDEX idx_data_access_logs_table_name ON public.data_access_logs(table_name);
CREATE INDEX idx_data_access_logs_record_id ON public.data_access_logs(record_id);
CREATE INDEX idx_data_access_logs_created_at ON public.data_access_logs(created_at DESC);

-- Enable RLS on data_access_logs
ALTER TABLE public.data_access_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for data_access_logs
CREATE POLICY "Admins can view all access logs"
  ON public.data_access_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert own access logs"
  ON public.data_access_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own access logs"
  ON public.data_access_logs FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Add soft delete columns to sensitive tables
ALTER TABLE public.call_transcripts 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.email_logs 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.ai_call_analysis 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.prospects 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

ALTER TABLE public.stakeholders 
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Create index for soft delete queries
CREATE INDEX IF NOT EXISTS idx_call_transcripts_deleted_at ON public.call_transcripts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_email_logs_deleted_at ON public.email_logs(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_ai_call_analysis_deleted_at ON public.ai_call_analysis(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_prospects_deleted_at ON public.prospects(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_stakeholders_deleted_at ON public.stakeholders(deleted_at) WHERE deleted_at IS NULL;

-- 3. Create function to log data access (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.log_data_access(
  p_table_name text,
  p_record_id uuid,
  p_access_type text,
  p_access_reason text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.data_access_logs (
    user_id,
    table_name,
    record_id,
    access_type,
    access_reason,
    metadata
  ) VALUES (
    auth.uid(),
    p_table_name,
    p_record_id,
    p_access_type,
    p_access_reason,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 4. Create function to soft delete a record (security definer)
CREATE OR REPLACE FUNCTION public.soft_delete_record(
  p_table_name text,
  p_record_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  CASE p_table_name
    WHEN 'call_transcripts' THEN
      UPDATE public.call_transcripts 
      SET deleted_at = now(), deleted_by = auth.uid()
      WHERE id = p_record_id AND deleted_at IS NULL;
    WHEN 'email_logs' THEN
      UPDATE public.email_logs 
      SET deleted_at = now(), deleted_by = auth.uid()
      WHERE id = p_record_id AND deleted_at IS NULL;
    WHEN 'ai_call_analysis' THEN
      UPDATE public.ai_call_analysis 
      SET deleted_at = now(), deleted_by = auth.uid()
      WHERE id = p_record_id AND deleted_at IS NULL;
    WHEN 'prospects' THEN
      UPDATE public.prospects 
      SET deleted_at = now(), deleted_by = auth.uid()
      WHERE id = p_record_id AND deleted_at IS NULL;
    WHEN 'stakeholders' THEN
      UPDATE public.stakeholders 
      SET deleted_at = now(), deleted_by = auth.uid()
      WHERE id = p_record_id AND deleted_at IS NULL;
    ELSE
      RETURN false;
  END CASE;
  
  -- Log the deletion
  PERFORM public.log_data_access(p_table_name, p_record_id, 'delete', 'Soft delete');
  
  RETURN true;
END;
$$;

-- 5. Create function to check if user can access historical data (beyond 90 days)
CREATE OR REPLACE FUNCTION public.can_access_historical_data(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admins and managers can access historical data
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = p_user_id
      AND role IN ('admin', 'manager')
  )
$$;

-- 6. Update RLS policies to exclude soft-deleted records and add time-based access

-- Call Transcripts: Update existing policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Reps can view own transcripts" ON public.call_transcripts;
CREATE POLICY "Reps can view own transcripts"
  ON public.call_transcripts FOR SELECT
  USING (
    auth.uid() = rep_id 
    AND deleted_at IS NULL
    AND (
      call_date > CURRENT_DATE - INTERVAL '90 days'
      OR public.can_access_historical_data(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can view team transcripts" ON public.call_transcripts;
CREATE POLICY "Managers can view team transcripts"
  ON public.call_transcripts FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), rep_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage all transcripts" ON public.call_transcripts;
CREATE POLICY "Admins can manage all transcripts"
  ON public.call_transcripts FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Email Logs: Update existing policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Reps can view own email logs" ON public.email_logs;
CREATE POLICY "Reps can view own email logs"
  ON public.email_logs FOR SELECT
  USING (
    auth.uid() = rep_id 
    AND deleted_at IS NULL
    AND (
      email_date > CURRENT_DATE - INTERVAL '90 days'
      OR public.can_access_historical_data(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can view team email logs" ON public.email_logs;
CREATE POLICY "Managers can view team email logs"
  ON public.email_logs FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), rep_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage all email logs" ON public.email_logs;
CREATE POLICY "Admins can manage all email logs"
  ON public.email_logs FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- AI Call Analysis: Update existing policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Reps can view own analysis" ON public.ai_call_analysis;
CREATE POLICY "Reps can view own analysis"
  ON public.ai_call_analysis FOR SELECT
  USING (
    auth.uid() = rep_id 
    AND deleted_at IS NULL
    AND (
      created_at > CURRENT_DATE - INTERVAL '90 days'
      OR public.can_access_historical_data(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Managers can view team analysis" ON public.ai_call_analysis;
CREATE POLICY "Managers can view team analysis"
  ON public.ai_call_analysis FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), rep_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can view all analysis" ON public.ai_call_analysis;
CREATE POLICY "Admins can view all analysis"
  ON public.ai_call_analysis FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Prospects: Update existing policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Reps can view own prospects" ON public.prospects;
CREATE POLICY "Reps can view own prospects"
  ON public.prospects FOR SELECT
  USING (auth.uid() = rep_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Managers can view team prospects" ON public.prospects;
CREATE POLICY "Managers can view team prospects"
  ON public.prospects FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::user_role) 
    AND is_manager_of_user(auth.uid(), rep_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage all prospects" ON public.prospects;
CREATE POLICY "Admins can manage all prospects"
  ON public.prospects FOR ALL
  USING (has_role(auth.uid(), 'admin'::user_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Stakeholders: Update existing policies to exclude soft-deleted records
DROP POLICY IF EXISTS "Reps can view own stakeholders" ON public.stakeholders;
CREATE POLICY "Reps can view own stakeholders"
  ON public.stakeholders FOR SELECT
  USING (auth.uid() = rep_id AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Managers can view team stakeholders" ON public.stakeholders;
CREATE POLICY "Managers can view team stakeholders"
  ON public.stakeholders FOR SELECT
  USING (
    has_role(auth.uid(), 'manager'::text) 
    AND is_manager_of_user(auth.uid(), rep_id)
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Admins can manage all stakeholders" ON public.stakeholders;
CREATE POLICY "Admins can manage all stakeholders"
  ON public.stakeholders FOR ALL
  USING (has_role(auth.uid(), 'admin'::text))
  WITH CHECK (has_role(auth.uid(), 'admin'::text));

-- 7. Add policy for admins to view soft-deleted records (for recovery)
CREATE POLICY "Admins can view deleted transcripts"
  ON public.call_transcripts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) AND deleted_at IS NOT NULL);

CREATE POLICY "Admins can view deleted email logs"
  ON public.email_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) AND deleted_at IS NOT NULL);

CREATE POLICY "Admins can view deleted prospects"
  ON public.prospects FOR SELECT
  USING (has_role(auth.uid(), 'admin'::user_role) AND deleted_at IS NOT NULL);

CREATE POLICY "Admins can view deleted stakeholders"
  ON public.stakeholders FOR SELECT
  USING (has_role(auth.uid(), 'admin'::text) AND deleted_at IS NOT NULL);

-- 8. Create view for easy querying of audit logs with user info
CREATE OR REPLACE VIEW public.data_access_logs_with_user AS
SELECT 
  dal.*,
  p.name as user_name,
  p.email as user_email
FROM public.data_access_logs dal
LEFT JOIN public.profiles p ON dal.user_id = p.id;