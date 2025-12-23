-- Create product_knowledge table for storing scraped StormWind content
CREATE TABLE public.product_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_url TEXT NOT NULL UNIQUE,
  page_type TEXT, -- 'product', 'feature', 'pricing', 'documentation', 'faq', 'about'
  title TEXT,
  raw_markdown TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  scrape_status TEXT DEFAULT 'completed', -- 'pending', 'processing', 'completed', 'error'
  scrape_error TEXT,
  scraped_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create product_knowledge_chunks table for vectorized search
CREATE TABLE public.product_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.product_knowledge(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', chunk_text)) STORED,
  topics TEXT[] DEFAULT '{}', -- 'pricing', 'feature', 'integration', 'security', 'certification', etc.
  products_mentioned TEXT[] DEFAULT '{}', -- specific product names like 'AZ-104', 'CCNA', etc.
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast vector similarity search
CREATE INDEX product_chunks_embedding_idx 
ON public.product_knowledge_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- GIN index for full-text search
CREATE INDEX product_chunks_search_idx 
ON public.product_knowledge_chunks 
USING gin(search_vector);

-- GIN indexes for array filtering
CREATE INDEX product_chunks_topics_idx 
ON public.product_knowledge_chunks 
USING gin(topics);

CREATE INDEX product_chunks_products_idx 
ON public.product_knowledge_chunks 
USING gin(products_mentioned);

-- Index for source lookup
CREATE INDEX product_knowledge_url_idx ON public.product_knowledge(source_url);
CREATE INDEX product_knowledge_status_idx ON public.product_knowledge(scrape_status);

-- Enable RLS
ALTER TABLE public.product_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies - product knowledge is readable by all authenticated users
CREATE POLICY "Authenticated users can view product knowledge"
ON public.product_knowledge
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product knowledge"
ON public.product_knowledge
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view product knowledge chunks"
ON public.product_knowledge_chunks
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage product knowledge chunks"
ON public.product_knowledge_chunks
FOR ALL
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create hybrid search function for product knowledge
CREATE OR REPLACE FUNCTION find_product_knowledge(
  query_embedding vector(1536) DEFAULT NULL,
  query_text TEXT DEFAULT NULL,
  filter_topics TEXT[] DEFAULT NULL,
  filter_products TEXT[] DEFAULT NULL,
  match_count INT DEFAULT 10,
  weight_vector FLOAT DEFAULT 0.6,
  weight_fts FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id UUID,
  source_id UUID,
  chunk_text TEXT,
  source_url TEXT,
  page_type TEXT,
  title TEXT,
  topics TEXT[],
  products_mentioned TEXT[],
  relevance_score FLOAT,
  vector_score FLOAT,
  fts_score FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH scored_chunks AS (
    SELECT
      pkc.id,
      pkc.source_id,
      pkc.chunk_text,
      pk.source_url,
      pk.page_type,
      pk.title,
      pkc.topics,
      pkc.products_mentioned,
      CASE 
        WHEN query_embedding IS NOT NULL AND pkc.embedding IS NOT NULL 
        THEN 1 - (pkc.embedding <=> query_embedding)
        ELSE 0 
      END as v_score,
      CASE 
        WHEN query_text IS NOT NULL AND query_text != '' 
        THEN ts_rank(pkc.search_vector, websearch_to_tsquery('english', query_text))
        ELSE 0 
      END as f_score
    FROM public.product_knowledge_chunks pkc
    JOIN public.product_knowledge pk ON pk.id = pkc.source_id
    WHERE 
      pk.scrape_status = 'completed'
      AND (
        filter_topics IS NULL 
        OR array_length(filter_topics, 1) IS NULL 
        OR pkc.topics && filter_topics
      )
      AND (
        filter_products IS NULL 
        OR array_length(filter_products, 1) IS NULL 
        OR pkc.products_mentioned && filter_products
      )
  )
  SELECT 
    sc.id,
    sc.source_id,
    sc.chunk_text,
    sc.source_url,
    sc.page_type,
    sc.title,
    sc.topics,
    sc.products_mentioned,
    (weight_vector * sc.v_score + weight_fts * sc.f_score) as relevance_score,
    sc.v_score as vector_score,
    sc.f_score as fts_score
  FROM scored_chunks sc
  WHERE (sc.v_score > 0 OR sc.f_score > 0)
  ORDER BY relevance_score DESC
  LIMIT match_count;
END;
$$;

-- Create function to get product knowledge stats
CREATE OR REPLACE FUNCTION get_product_knowledge_stats()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'total_pages', (SELECT COUNT(*) FROM product_knowledge),
    'completed_pages', (SELECT COUNT(*) FROM product_knowledge WHERE scrape_status = 'completed'),
    'pending_pages', (SELECT COUNT(*) FROM product_knowledge WHERE scrape_status = 'pending'),
    'error_pages', (SELECT COUNT(*) FROM product_knowledge WHERE scrape_status = 'error'),
    'total_chunks', (SELECT COUNT(*) FROM product_knowledge_chunks),
    'chunks_with_embeddings', (SELECT COUNT(*) FROM product_knowledge_chunks WHERE embedding IS NOT NULL),
    'last_scraped_at', (SELECT MAX(scraped_at) FROM product_knowledge),
    'unique_topics', (SELECT ARRAY_AGG(DISTINCT topic) FROM product_knowledge_chunks, unnest(topics) as topic),
    'unique_products', (SELECT ARRAY_AGG(DISTINCT product) FROM product_knowledge_chunks, unnest(products_mentioned) as product)
  )
$$;