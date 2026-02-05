/**
 * Process Product Knowledge - Chunking and Embedding Generator
 * 
 * Processes scraped product knowledge into searchable chunks with embeddings.
 * Extracts topics and product mentions using AI for enhanced filtering.
 */

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Chunking configuration
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;
const EMBEDDING_BATCH_SIZE = 10;
const EMBEDDING_MODEL = 'text-embedding-3-small';

// Known StormWind products and topics for extraction
const KNOWN_PRODUCTS = [
  'AZ-104', 'AZ-900', 'AZ-500', 'AZ-204', 'AZ-400',
  'MS-900', 'MS-100', 'MS-500', 'MS-700',
  'SC-900', 'SC-200', 'SC-300', 'SC-400',
  'DP-900', 'DP-100', 'DP-300', 'DP-203',
  'PL-900', 'PL-100', 'PL-200', 'PL-300', 'PL-400',
  'AI-900', 'AI-102',
  'CCNA', 'CCNP', 'CCIE',
  'CompTIA A+', 'CompTIA Network+', 'CompTIA Security+', 'CompTIA Cloud+',
  'AWS', 'Azure', 'Google Cloud', 'GCP',
  'Security Awareness', 'Compliance Training', 'HIPAA', 'PCI-DSS',
];

const TOPIC_KEYWORDS: Record<string, string[]> = {
  'pricing': ['price', 'cost', 'subscription', 'license', 'per user', 'per seat', 'annual', 'monthly', 'enterprise'],
  'feature': ['feature', 'capability', 'functionality', 'integration', 'api', 'reporting', 'dashboard', 'analytics'],
  'certification': ['certification', 'exam', 'certificate', 'credential', 'badge', 'accredited'],
  'security': ['security', 'compliance', 'encryption', 'sso', 'authentication', 'gdpr', 'soc2'],
  'integration': ['integrate', 'integration', 'api', 'lms', 'scorm', 'lti', 'hris', 'connector'],
  'support': ['support', 'help', 'customer success', 'onboarding', 'implementation', 'training'],
  'enterprise': ['enterprise', 'organization', 'team', 'corporate', 'business', 'company'],
  'learning': ['learning', 'training', 'course', 'module', 'curriculum', 'path', 'track'],
};

interface ProcessRequest {
  process_all?: boolean;
  source_ids?: string[];
}

function chunkText(text: string): string[] {
  const chunks: string[] = [];
  
  // Split by common section markers first
  const sections = text.split(/\n#{1,3}\s+|\n\*\*[^*]+\*\*\n|\n---+\n/);
  
  let currentChunk = '';
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    
    // If section fits in current chunk, add it
    if (currentChunk.length + trimmed.length < CHUNK_SIZE) {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmed;
    } else {
      // Save current chunk if non-empty
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      
      // If section is larger than chunk size, split it
      if (trimmed.length > CHUNK_SIZE) {
        const paragraphs = trimmed.split(/\n\n+/);
        currentChunk = '';
        
        for (const para of paragraphs) {
          if (currentChunk.length + para.length < CHUNK_SIZE) {
            currentChunk += (currentChunk ? '\n\n' : '') + para;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            // If paragraph is still too long, force split
            if (para.length > CHUNK_SIZE) {
              const sentences = para.match(/[^.!?]+[.!?]+/g) || [para];
              currentChunk = '';
              for (const sent of sentences) {
                if (currentChunk.length + sent.length < CHUNK_SIZE) {
                  currentChunk += sent;
                } else {
                  if (currentChunk) chunks.push(currentChunk);
                  currentChunk = sent;
                }
              }
            } else {
              currentChunk = para;
            }
          }
        }
      } else {
        currentChunk = trimmed;
      }
    }
  }
  
  // Don't forget the last chunk
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

function extractTopics(text: string): string[] {
  const textLower = text.toLowerCase();
  const topics = new Set<string>();
  
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    if (keywords.some(kw => textLower.includes(kw))) {
      topics.add(topic);
    }
  }
  
  return Array.from(topics);
}

function extractProducts(text: string): string[] {
  const products = new Set<string>();
  
  for (const product of KNOWN_PRODUCTS) {
    if (text.includes(product)) {
      products.add(product);
    }
  }
  
  return Array.from(products);
}

async function generateEmbeddings(texts: string[], apiKey: string): Promise<(number[] | null)[]> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: texts.map(t => t.slice(0, 8000)),
      }),
    });

    if (!response.ok) {
      console.error('[process-product-knowledge] Embedding API error:', response.status);
      return texts.map(() => null);
    }

    const data = await response.json();
    return data.data.map((d: any) => d.embedding);
  } catch (err) {
    console.error('[process-product-knowledge] Embedding error:', err);
    return texts.map(() => null);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: ProcessRequest = await req.json().catch(() => ({}));
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[process-product-knowledge] Starting processing...');

    // Get pages to process
    let query = supabase
      .from('product_knowledge')
      .select('id, source_url, title, raw_markdown, page_type')
      .eq('scrape_status', 'completed');

    if (body.source_ids?.length) {
      query = query.in('id', body.source_ids);
    }

    const { data: pages, error: fetchError } = await query;

    if (fetchError) {
      throw new Error(`Failed to fetch pages: ${fetchError.message}`);
    }

    if (!pages?.length) {
      return new Response(
        JSON.stringify({ success: true, message: 'No pages to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-product-knowledge] Processing ${pages.length} pages`);

    const results = {
      pages_processed: 0,
      chunks_created: 0,
      embeddings_generated: 0,
      errors: 0,
    };

    for (const page of pages) {
      try {
        // Check if already chunked
        if (!body.process_all && !body.source_ids?.length) {
          const { count } = await supabase
            .from('product_knowledge_chunks')
            .select('id', { count: 'exact', head: true })
            .eq('source_id', page.id);
          
          if (count && count > 0) {
            console.log(`[process-product-knowledge] Skipping already-chunked page: ${page.source_url}`);
            continue;
          }
        }

        // Delete existing chunks for this page (in case of reprocessing)
        await supabase
          .from('product_knowledge_chunks')
          .delete()
          .eq('source_id', page.id);

        // Chunk the content
        const chunks = chunkText(page.raw_markdown);
        console.log(`[process-product-knowledge] Created ${chunks.length} chunks for: ${page.source_url}`);

        // Process chunks in batches
        for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
          const batchIndices = batch.map((_, idx) => i + idx);
          
          // Generate embeddings
          const embeddings = await generateEmbeddings(batch, openaiApiKey);
          
          // Prepare chunk records
          const chunkRecords = batch.map((chunkText, idx) => ({
            source_id: page.id,
            chunk_index: batchIndices[idx],
            chunk_text: chunkText,
            embedding: embeddings[idx] ? `[${embeddings[idx]!.join(',')}]` : null,
            topics: extractTopics(chunkText),
            products_mentioned: extractProducts(chunkText),
          }));

          // Insert chunks
          const { error: insertError } = await supabase
            .from('product_knowledge_chunks')
            .insert(chunkRecords);

          if (insertError) {
            console.error(`[process-product-knowledge] Insert error:`, insertError);
            results.errors++;
          } else {
            results.chunks_created += batch.length;
            results.embeddings_generated += embeddings.filter(e => e !== null).length;
          }

          // Rate limit delay
          if (i + EMBEDDING_BATCH_SIZE < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        results.pages_processed++;

      } catch (err) {
        console.error(`[process-product-knowledge] Error processing page ${page.id}:`, err);
        results.errors++;
      }
    }

    console.log(`[process-product-knowledge] Complete. Pages: ${results.pages_processed}, Chunks: ${results.chunks_created}, Embeddings: ${results.embeddings_generated}`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-product-knowledge] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
