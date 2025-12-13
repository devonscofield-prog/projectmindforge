-- Drop and recreate function with correct heat_score type (integer)
DROP FUNCTION IF EXISTS public.get_admin_prospects_with_call_counts(text, uuid, uuid, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_admin_prospects_with_call_counts(
  p_status_filter text DEFAULT 'all',
  p_team_filter uuid DEFAULT NULL,
  p_rep_filter uuid DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_sort_by text DEFAULT 'last_contact_date',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  prospect_name text,
  account_name text,
  status text,
  industry text,
  heat_score integer,
  active_revenue numeric,
  last_contact_date date,
  rep_id uuid,
  ai_extracted_info jsonb,
  rep_name text,
  team_name text,
  call_count bigint,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rep_ids_in_team uuid[];
BEGIN
  -- Get rep IDs in team if team filter is specified
  IF p_team_filter IS NOT NULL THEN
    SELECT ARRAY_AGG(profiles.id) INTO rep_ids_in_team
    FROM profiles
    WHERE profiles.team_id = p_team_filter;
    
    -- If no reps in team, return empty result
    IF rep_ids_in_team IS NULL OR array_length(rep_ids_in_team, 1) IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH prospect_calls AS (
    SELECT 
      ct.prospect_id,
      COUNT(*) as call_count
    FROM call_transcripts ct
    WHERE ct.deleted_at IS NULL AND ct.prospect_id IS NOT NULL
    GROUP BY ct.prospect_id
  ),
  filtered_prospects AS (
    SELECT 
      p.id,
      p.prospect_name,
      p.account_name,
      p.status::text,
      p.industry,
      p.heat_score,
      p.active_revenue,
      p.last_contact_date,
      p.rep_id,
      p.ai_extracted_info,
      COALESCE(prof.name, 'Unknown') as rep_name,
      t.name as team_name,
      COALESCE(pc.call_count, 0) as call_count
    FROM prospects p
    LEFT JOIN profiles prof ON prof.id = p.rep_id
    LEFT JOIN teams t ON t.id = prof.team_id
    LEFT JOIN prospect_calls pc ON pc.prospect_id = p.id
    WHERE p.deleted_at IS NULL
      AND (p_status_filter = 'all' OR p.status::text = p_status_filter)
      AND (p_rep_filter IS NULL OR p.rep_id = p_rep_filter)
      AND (rep_ids_in_team IS NULL OR p.rep_id = ANY(rep_ids_in_team))
      AND (p_search IS NULL OR p_search = '' OR 
           p.account_name ILIKE '%' || p_search || '%' OR 
           p.prospect_name ILIKE '%' || p_search || '%')
  )
  SELECT 
    fp.id,
    fp.prospect_name,
    fp.account_name,
    fp.status,
    fp.industry,
    fp.heat_score,
    fp.active_revenue,
    fp.last_contact_date,
    fp.rep_id,
    fp.ai_extracted_info,
    fp.rep_name,
    fp.team_name,
    fp.call_count,
    COUNT(*) OVER() as total_count
  FROM filtered_prospects fp
  ORDER BY
    CASE WHEN p_sort_by = 'last_contact_date' THEN fp.last_contact_date END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'account_name' THEN fp.account_name END ASC,
    CASE WHEN p_sort_by = 'heat_score' THEN fp.heat_score END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'potential_revenue' OR p_sort_by = 'active_revenue' THEN fp.active_revenue END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'call_count' THEN fp.call_count END DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;