/**
 * Product Knowledge Context Retriever
 * 
 * Shared helper for retrieving relevant product knowledge to inject into AI prompts.
 * Uses hybrid search (vector + FTS) for best relevance.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface ProductKnowledgeChunk {
  chunk_text: string;
  source_url: string;
  page_type: string | null;
  title: string | null;
  topics: string[];
  products_mentioned: string[];
  relevance_score: number;
}

export interface ProductContextOptions {
  query?: string;
  topics?: string[];
  products?: string[];
  maxChunks?: number;
  includeSourceInfo?: boolean;
}

/**
 * Generate embedding for a query using OpenAI
 */
async function generateQueryEmbedding(query: string, openaiApiKey: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.slice(0, 8000),
      }),
    });

    if (!response.ok) {
      console.error('[productContext] Embedding error:', response.status);
      return null;
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    if (!embedding) return null;
    
    return `[${embedding.join(',')}]`;
  } catch (err) {
    console.error('[productContext] Embedding error:', err);
    return null;
  }
}

/**
 * Retrieve relevant product knowledge chunks
 */
export async function getProductContext(
  supabase: SupabaseClient,
  options: ProductContextOptions = {}
): Promise<ProductKnowledgeChunk[]> {
  const { 
    query, 
    topics, 
    products, 
    maxChunks = 8,
  } = options;

  try {
    // Check if product knowledge table has data
    const { count } = await supabase
      .from('product_knowledge_chunks')
      .select('id', { count: 'exact', head: true });

    if (!count || count === 0) {
      console.log('[productContext] No product knowledge available');
      return [];
    }

    // If we have a query, try to generate embedding for vector search
    let queryEmbedding: string | null = null;
    if (query) {
      const openaiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiKey) {
        queryEmbedding = await generateQueryEmbedding(query, openaiKey);
      }
    }

    // Use the hybrid search function
    const { data, error } = await supabase.rpc('find_product_knowledge', {
      query_embedding: queryEmbedding,
      query_text: query || null,
      filter_topics: topics?.length ? topics : null,
      filter_products: products?.length ? products : null,
      match_count: maxChunks,
    });

    if (error) {
      console.error('[productContext] Search error:', error);
      
      // Fallback to simple query if RPC fails
      const { data: fallbackData } = await supabase
        .from('product_knowledge_chunks')
        .select(`
          chunk_text,
          topics,
          products_mentioned,
          product_knowledge!inner (
            source_url,
            page_type,
            title
          )
        `)
        .limit(maxChunks);

      if (fallbackData) {
        return fallbackData.map((row: any) => ({
          chunk_text: row.chunk_text,
          source_url: row.product_knowledge?.source_url || '',
          page_type: row.product_knowledge?.page_type || null,
          title: row.product_knowledge?.title || null,
          topics: row.topics || [],
          products_mentioned: row.products_mentioned || [],
          relevance_score: 0.5,
        }));
      }
      
      return [];
    }

    return (data || []).map((row: any) => ({
      chunk_text: row.chunk_text,
      source_url: row.source_url,
      page_type: row.page_type,
      title: row.title,
      topics: row.topics || [],
      products_mentioned: row.products_mentioned || [],
      relevance_score: row.relevance_score || 0,
    }));

  } catch (err) {
    console.error('[productContext] Error:', err);
    return [];
  }
}

/**
 * Format product knowledge chunks into a context string for prompts
 */
export function formatProductContext(
  chunks: ProductKnowledgeChunk[],
  options: { 
    includeSourceInfo?: boolean;
    maxLength?: number;
  } = {}
): string {
  if (!chunks.length) return '';

  const { includeSourceInfo = false, maxLength = 6000 } = options;
  
  let context = '--- STORMWIND PRODUCT KNOWLEDGE ---\n\n';
  let currentLength = context.length;

  for (const chunk of chunks) {
    let section = '';
    
    if (includeSourceInfo && chunk.title) {
      section += `[Source: ${chunk.title}]\n`;
    }
    
    section += chunk.chunk_text + '\n\n';

    if (currentLength + section.length > maxLength) {
      break;
    }

    context += section;
    currentLength += section.length;
  }

  context += '--- END PRODUCT KNOWLEDGE ---\n';

  return context;
}

/**
 * Get product context formatted for a specific use case
 */
export async function getFormattedProductContext(
  supabase: SupabaseClient,
  options: ProductContextOptions & { maxLength?: number } = {}
): Promise<string> {
  const chunks = await getProductContext(supabase, options);
  return formatProductContext(chunks, {
    includeSourceInfo: options.includeSourceInfo,
    maxLength: options.maxLength,
  });
}

/**
 * Get general product overview for system prompts
 */
export async function getProductOverview(
  supabase: SupabaseClient
): Promise<string> {
  // Get a diverse set of product knowledge
  const chunks = await getProductContext(supabase, {
    maxChunks: 12,
    topics: ['feature', 'product', 'pricing'],
  });

  if (!chunks.length) return '';

  return formatProductContext(chunks, {
    includeSourceInfo: true,
    maxLength: 4000,
  });
}
