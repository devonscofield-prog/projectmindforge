
CREATE OR REPLACE FUNCTION public.fuzzy_match_stakeholders(
  p_contact_names text[],
  p_threshold float DEFAULT 0.3
)
RETURNS TABLE(
  input_name text,
  stakeholder_id uuid,
  stakeholder_name text,
  prospect_id uuid,
  account_name text,
  prospect_name text,
  rep_id uuid,
  job_title text,
  heat_score int,
  status text,
  industry text,
  active_revenue numeric,
  potential_revenue numeric,
  last_contact_date date,
  similarity_score float
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH input_names AS (
    SELECT unnest(p_contact_names) AS name
  ),
  scored AS (
    SELECT
      i.name AS input_name,
      s.id AS stakeholder_id,
      s.name AS stakeholder_name,
      s.prospect_id,
      p.account_name,
      p.prospect_name,
      s.rep_id,
      s.job_title,
      p.account_heat_score AS heat_score,
      p.status::text,
      p.industry,
      p.active_revenue,
      p.potential_revenue,
      p.last_contact_date,
      similarity(lower(trim(i.name)), lower(trim(s.name))) AS similarity_score,
      ROW_NUMBER() OVER (
        PARTITION BY i.name
        ORDER BY similarity(lower(trim(i.name)), lower(trim(s.name))) DESC
      ) AS rn
    FROM input_names i
    CROSS JOIN stakeholders s
    JOIN prospects p ON p.id = s.prospect_id AND p.deleted_at IS NULL
    WHERE s.deleted_at IS NULL
      AND similarity(lower(trim(i.name)), lower(trim(s.name))) >= p_threshold
  )
  SELECT
    scored.input_name,
    scored.stakeholder_id,
    scored.stakeholder_name,
    scored.prospect_id,
    scored.account_name,
    scored.prospect_name,
    scored.rep_id,
    scored.job_title,
    scored.heat_score,
    scored.status,
    scored.industry,
    scored.active_revenue,
    scored.potential_revenue,
    scored.last_contact_date,
    scored.similarity_score
  FROM scored
  WHERE rn <= 3
  ORDER BY input_name, similarity_score DESC;
$$;
