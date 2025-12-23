/**
 * Product Knowledge API
 * 
 * Frontend functions for managing the StormWind product knowledge base.
 */

import { supabase } from '@/integrations/supabase/client';

export interface ProductKnowledgeStats {
  total_pages: number;
  completed_pages: number;
  pending_pages: number;
  error_pages: number;
  total_chunks: number;
  chunks_with_embeddings: number;
  last_scraped_at: string | null;
  unique_topics: string[] | null;
  unique_products: string[] | null;
}

export interface ProductKnowledgePage {
  id: string;
  source_url: string;
  page_type: string | null;
  title: string | null;
  scrape_status: string;
  scrape_error: string | null;
  scraped_at: string;
  created_at: string;
}

export interface ScrapeResult {
  success: boolean;
  results?: {
    scraped: number;
    skipped: number;
    errors: number;
    urls_scraped: string[];
  };
  message?: string;
  error?: string;
}

/**
 * Get product knowledge statistics
 */
export async function getProductKnowledgeStats(): Promise<ProductKnowledgeStats | null> {
  const { data, error } = await supabase.rpc('get_product_knowledge_stats');

  if (error) {
    console.error('[productKnowledge] Stats error:', error);
    return null;
  }

  return data as unknown as ProductKnowledgeStats;
}

/**
 * List all scraped pages
 */
export async function listProductKnowledgePages(
  limit = 50,
  offset = 0
): Promise<{ pages: ProductKnowledgePage[]; total: number }> {
  const { data, error, count } = await supabase
    .from('product_knowledge')
    .select('id, source_url, page_type, title, scrape_status, scrape_error, scraped_at, created_at', { count: 'exact' })
    .order('scraped_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error('[productKnowledge] List error:', error);
    return { pages: [], total: 0 };
  }

  return { 
    pages: (data || []) as ProductKnowledgePage[], 
    total: count || 0 
  };
}

/**
 * Trigger a scrape of the StormWind website
 */
export async function triggerProductKnowledgeScrape(
  options: {
    fullRescrape?: boolean;
    specificUrls?: string[];
  } = {}
): Promise<ScrapeResult> {
  const { data, error } = await supabase.functions.invoke('scrape-product-knowledge', {
    body: {
      full_rescrape: options.fullRescrape,
      specific_urls: options.specificUrls,
    },
  });

  if (error) {
    console.error('[productKnowledge] Scrape error:', error);
    return { success: false, error: error.message };
  }

  return data as ScrapeResult;
}

/**
 * Trigger processing (chunking + embedding) of scraped content
 */
export async function triggerProductKnowledgeProcessing(
  options: {
    processAll?: boolean;
    sourceIds?: string[];
  } = {}
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('process-product-knowledge', {
    body: {
      process_all: options.processAll,
      source_ids: options.sourceIds,
    },
  });

  if (error) {
    console.error('[productKnowledge] Process error:', error);
    return { success: false, error: error.message };
  }

  return data;
}

/**
 * Delete a specific page and its chunks
 */
export async function deleteProductKnowledgePage(pageId: string): Promise<boolean> {
  const { error } = await supabase
    .from('product_knowledge')
    .delete()
    .eq('id', pageId);

  if (error) {
    console.error('[productKnowledge] Delete error:', error);
    return false;
  }

  return true;
}

/**
 * Search product knowledge chunks
 */
export async function searchProductKnowledge(
  query: string,
  options: {
    topics?: string[];
    products?: string[];
    limit?: number;
  } = {}
): Promise<Array<{
  chunk_text: string;
  source_url: string;
  title: string | null;
  relevance_score: number;
}>> {
  // For now, use simple text search until embeddings are ready
  const { data, error } = await supabase
    .from('product_knowledge_chunks')
    .select(`
      chunk_text,
      topics,
      products_mentioned,
      product_knowledge!inner (
        source_url,
        title
      )
    `)
    .textSearch('chunk_text', query, { type: 'websearch' })
    .limit(options.limit || 10);

  if (error) {
    console.error('[productKnowledge] Search error:', error);
    return [];
  }

  return (data || []).map((row: any) => ({
    chunk_text: row.chunk_text,
    source_url: row.product_knowledge?.source_url || '',
    title: row.product_knowledge?.title || null,
    relevance_score: 1.0,
  }));
}
