-- Create optimized function for fetching admin transcripts with rep/team names in single query
CREATE OR REPLACE FUNCTION public.get_admin_transcripts(
  p_from_date DATE,
  p_to_date DATE,
  p_rep_ids UUID[] DEFAULT NULL,
  p_analysis_status TEXT[] DEFAULT ARRAY['completed', 'skipped'],
  p_account_search TEXT DEFAULT NULL,
  p_call_types TEXT[] DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
) RETURNS TABLE (
  id UUID,
  call_date DATE,
  account_name TEXT,
  call_type TEXT,
  raw_text TEXT,
  rep_id UUID,
  analysis_status TEXT,
  rep_name TEXT,
  team_name TEXT,
  total_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count BIGINT;
BEGIN
  -- First get the total count for pagination
  SELECT COUNT(*)::BIGINT INTO v_total_count
  FROM call_transcripts ct
  WHERE ct.call_date BETWEEN p_from_date AND p_to_date
    AND ct.deleted_at IS NULL
    AND ct.analysis_status = ANY(p_analysis_status::call_analysis_status[])
    AND (p_rep_ids IS NULL OR ct.rep_id = ANY(p_rep_ids))
    AND (p_account_search IS NULL OR p_account_search = '' OR ct.account_name ILIKE '%' || p_account_search || '%')
    AND (p_call_types IS NULL OR array_length(p_call_types, 1) IS NULL OR ct.call_type = ANY(p_call_types));

  -- Return the paginated results with rep/team names
  RETURN QUERY
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
    v_total_count as total_count
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
  OFFSET p_offset;
END;
$$;