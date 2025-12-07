-- Update the get_admin_transcripts function to include manager_id
DROP FUNCTION IF EXISTS get_admin_transcripts(date, date, uuid[], text[], text, text[], integer, integer);

CREATE OR REPLACE FUNCTION get_admin_transcripts(
  p_from_date date,
  p_to_date date,
  p_rep_ids uuid[] DEFAULT NULL,
  p_analysis_status text[] DEFAULT ARRAY['completed', 'skipped'],
  p_account_search text DEFAULT NULL,
  p_call_types text[] DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  call_date date,
  account_name text,
  call_type text,
  raw_text text,
  rep_id uuid,
  analysis_status text,
  rep_name text,
  team_name text,
  manager_id uuid,
  total_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    ct.id,
    ct.call_date,
    ct.account_name,
    ct.call_type,
    ct.raw_text,
    ct.rep_id,
    ct.analysis_status::TEXT,
    COALESCE(p.name, 'Unknown') as rep_name,
    COALESCE(t.name, 'Unknown') as team_name,
    ct.manager_id,
    COUNT(*) OVER() as total_count
  FROM call_transcripts ct
  LEFT JOIN profiles p ON p.id = ct.rep_id
  LEFT JOIN teams t ON t.id = p.team_id
  WHERE ct.call_date BETWEEN p_from_date AND p_to_date
    AND ct.deleted_at IS NULL
    AND ct.analysis_status = ANY(p_analysis_status::call_analysis_status[])
    AND (p_rep_ids IS NULL OR ct.rep_id = ANY(p_rep_ids))
    AND (p_account_search IS NULL OR p_account_search = '' OR ct.account_name ILIKE '%' || p_account_search || '%')
    AND (p_call_types IS NULL OR array_length(p_call_types, 1) IS NULL OR ct.call_type = ANY(p_call_types))
  ORDER BY ct.call_date DESC
  LIMIT p_limit
  OFFSET p_offset
$$;