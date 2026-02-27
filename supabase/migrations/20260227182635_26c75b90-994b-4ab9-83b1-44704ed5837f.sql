CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to fuzzy-match account names against prospects
CREATE OR REPLACE FUNCTION public.fuzzy_match_prospects(
  p_account_names text[],
  p_threshold float DEFAULT 0.3
)
RETURNS TABLE(
  input_name text,
  prospect_id uuid,
  prospect_name text,
  account_name text,
  status text,
  heat_score int,
  potential_revenue numeric,
  active_revenue numeric,
  last_contact_date date,
  industry text,
  rep_id uuid,
  similarity_score float
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH input_names AS (
    SELECT unnest(p_account_names) AS name
  ),
  scored AS (
    SELECT
      i.name AS input_name,
      p.id AS prospect_id,
      p.prospect_name,
      p.account_name,
      p.status::text,
      p.heat_score,
      p.potential_revenue,
      p.active_revenue,
      p.last_contact_date,
      p.industry,
      p.rep_id,
      GREATEST(
        similarity(lower(trim(i.name)), lower(trim(COALESCE(p.account_name, '')))),
        similarity(lower(trim(i.name)), lower(trim(p.prospect_name)))
      ) AS similarity_score,
      ROW_NUMBER() OVER (
        PARTITION BY i.name
        ORDER BY GREATEST(
          similarity(lower(trim(i.name)), lower(trim(COALESCE(p.account_name, '')))),
          similarity(lower(trim(i.name)), lower(trim(p.prospect_name)))
        ) DESC
      ) AS rn
    FROM input_names i
    CROSS JOIN prospects p
    WHERE p.deleted_at IS NULL
      AND GREATEST(
        similarity(lower(trim(i.name)), lower(trim(COALESCE(p.account_name, '')))),
        similarity(lower(trim(i.name)), lower(trim(p.prospect_name)))
      ) >= p_threshold
  )
  SELECT
    scored.input_name,
    scored.prospect_id,
    scored.prospect_name,
    scored.account_name,
    scored.status,
    scored.heat_score,
    scored.potential_revenue,
    scored.active_revenue,
    scored.last_contact_date,
    scored.industry,
    scored.rep_id,
    scored.similarity_score
  FROM scored
  WHERE rn <= 3
  ORDER BY input_name, similarity_score DESC;
$$;