import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000;
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

// Zod validation schema - supports transcript_ids, backfill modes, and reset
const chunkTranscriptsSchema = z.object({
  transcript_ids: z.array(z.string().uuid()).max(100).optional(),
  backfill_all: z.boolean().optional(),
  backfill_embeddings: z.boolean().optional(),
  backfill_entities: z.boolean().optional(),
  reset_all_chunks: z.boolean().optional(),
}).refine(
  (data) => data.backfill_all === true || data.backfill_embeddings === true || 
            data.backfill_entities === true || data.reset_all_chunks === true ||
            (data.transcript_ids && data.transcript_ids.length > 0),
  { message: "Either transcript_ids, a backfill mode, or reset_all_chunks is required" }
);

// Constants
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const NER_BATCH_SIZE = 10;
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 5000;
const MAX_RETRIES = 3;
const NER_CHUNKS_PER_API_CALL = 5; // Process 5 chunks in a single API call for efficiency
const NER_BACKFILL_BATCH_SIZE = 15; // Total chunks per edge function invocation (3 API calls)
const CHUNKING_BATCH_SIZE = 50; // For chunking transcripts
const EMBEDDING_BATCH_SIZE = 10; // Smaller batches for embedding to respect rate limits
const EMBEDDING_DELAY_MS = 500; // 500ms between embedding API calls to respect 40k TPM limit

// Types
interface TranscriptChunk {
  transcript_id: string;
  chunk_index: number;
  chunk_text: string;
  embedding?: string;
  entities?: Record<string, unknown>;
  topics?: string[];
  meddpicc_elements?: string[];
  extraction_status?: string;
  metadata: {
    account_name: string;
    call_date: string;
    call_type: string;
    rep_name: string;
    rep_id: string;
  };
}

interface NERResult {
  entities: {
    people?: Array<{ name: string; role?: string; is_decision_maker?: boolean }>;
    organizations?: string[];
    competitors?: string[];
    money_amounts?: Array<{ amount: string; context: string }>;
    dates?: Array<{ date: string; context: string }>;
    products?: string[];
  };
  topics: string[];
  meddpicc_elements: string[];
}

// NER Tool Calling Schema
const NER_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    entities: {
      type: "object",
      properties: {
        people: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string" },
              is_decision_maker: { type: "boolean" }
            },
            required: ["name"]
          }
        },
        organizations: { type: "array", items: { type: "string" } },
        competitors: { type: "array", items: { type: "string" } },
        money_amounts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              amount: { type: "string" },
              context: { type: "string" }
            },
            required: ["amount", "context"]
          }
        },
        dates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              date: { type: "string" },
              context: { type: "string" }
            },
            required: ["date", "context"]
          }
        },
        products: { type: "array", items: { type: "string" } }
      }
    },
    topics: {
      type: "array",
      items: {
        type: "string",
        enum: ["pricing", "objections", "demo", "next_steps", "discovery", "negotiation", 
               "technical", "competitor_discussion", "budget", "timeline", "decision_process", 
               "pain_points", "value_prop", "closing"]
      }
    },
    meddpicc_elements: {
      type: "array",
      items: {
        type: "string",
        enum: ["metrics", "economic_buyer", "decision_criteria", "decision_process", 
               "paper_process", "identify_pain", "champion", "competition"]
      }
    }
  },
  required: ["entities", "topics", "meddpicc_elements"]
};

// Speaker-aware recursive text chunking
function chunkText(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  // Priority splitters: Speaker turns first, then paragraphs, then sentences
  const speakerPattern = /(?=\n\n(?:REP|PROSPECT):)/gi;
  const paragraphPattern = /\n\n+/;
  const sentencePattern = /(?<=[.!?])\s+/;

  // Step 1: Split by speaker turns first
  let sections = text.split(speakerPattern).filter(s => s.trim().length > 0);

  // Step 2: Further split oversized sections by paragraphs
  sections = recursiveSplit(sections, paragraphPattern, CHUNK_SIZE * 1.5);

  // Step 3: Further split oversized sections by sentences
  sections = recursiveSplit(sections, sentencePattern, CHUNK_SIZE * 1.5);

  // Step 4: Final chunking with overlap
  return mergeWithOverlap(sections);
}

function recursiveSplit(sections: string[], pattern: RegExp, maxSize: number): string[] {
  const result: string[] = [];
  for (const section of sections) {
    if (section.length <= maxSize) {
      result.push(section);
    } else {
      const parts = section.split(pattern).filter(s => s.trim().length > 0);
      if (parts.length === 1) {
        result.push(section);
      } else {
        result.push(...parts);
      }
    }
  }
  return result;
}

function mergeWithOverlap(sections: string[]): string[] {
  const chunks: string[] = [];
  let buffer = '';

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection) continue;

    const combinedLength = buffer.length + (buffer ? 2 : 0) + trimmedSection.length;

    if (combinedLength <= CHUNK_SIZE) {
      buffer += (buffer ? '\n\n' : '') + trimmedSection;
    } else {
      if (buffer.length > 0) {
        chunks.push(buffer.trim());
      }
      if (buffer.length > CHUNK_OVERLAP) {
        const overlapText = buffer.slice(-CHUNK_OVERLAP).trim();
        buffer = overlapText + '\n\n' + trimmedSection;
      } else {
        buffer = trimmedSection;
      }
      while (buffer.length > CHUNK_SIZE) {
        chunks.push(buffer.slice(0, CHUNK_SIZE).trim());
        const overlap = buffer.slice(CHUNK_SIZE - CHUNK_OVERLAP, CHUNK_SIZE);
        buffer = overlap + buffer.slice(CHUNK_SIZE);
      }
    }
  }

  if (buffer.trim().length > 0) {
    chunks.push(buffer.trim());
  }

  return chunks;
}

// Generate embedding using OpenAI API directly (text-embedding-3-small, 1536 dimensions)
// Includes retry logic with exponential backoff for rate limit (429) errors
async function generateEmbedding(text: string, openaiApiKey: string, maxRetries: number = 3): Promise<string> {
  let lastError: Error | null = null;
  let retryDelay = EMBEDDING_DELAY_MS;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'text-embedding-3-small',
          input: text.slice(0, 8000) // API limit
        })
      });

      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`[chunk-transcripts] Embedding rate limited (attempt ${attempt + 1}/${maxRetries}):`, errorText);
        
        // Parse "Please try again in Xms" from the error message
        const waitMatch = errorText.match(/try again in (\d+(?:\.\d+)?)(ms|s)/i);
        if (waitMatch) {
          const waitTime = parseFloat(waitMatch[1]);
          retryDelay = waitMatch[2].toLowerCase() === 's' ? waitTime * 1000 : waitTime;
          // Add a small buffer to the suggested wait time
          retryDelay = Math.ceil(retryDelay) + 100;
        } else {
          // Exponential backoff if no wait time specified
          retryDelay = Math.min(retryDelay * 2, 10000);
        }
        
        console.log(`[chunk-transcripts] Waiting ${retryDelay}ms before retry...`);
        await new Promise(r => setTimeout(r, retryDelay));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[chunk-transcripts] OpenAI Embedding API error:', response.status, errorText);
        throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const embedding = data.data?.[0]?.embedding;
      
      if (!embedding || !Array.isArray(embedding)) {
        throw new Error('Invalid embedding response format');
      }

      // Format as PostgreSQL vector string: [0.123, -0.456, ...]
      return `[${embedding.join(',')}]`;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Only retry on rate limit errors, not other errors
      if (!lastError.message.includes('429')) {
        throw lastError;
      }
    }
  }

  console.error('[chunk-transcripts] Embedding generation failed after all retries:', lastError);
  throw lastError || new Error('Embedding generation failed');
}

// NER extraction using Lovable AI Gateway with tool calling (single chunk - kept for compatibility)
async function extractEntities(
  chunkTextContent: string,
  context: { accountName?: string; repName?: string; callType?: string },
  apiKey: string
): Promise<NERResult> {
  const results = await extractEntitiesBatch([{ id: 'single', text: chunkTextContent }], context, apiKey);
  return results.get('single') || { entities: {}, topics: [], meddpicc_elements: [] };
}

// Batched NER extraction - processes multiple chunks in a single API call for efficiency
async function extractEntitiesBatch(
  chunks: Array<{ id: string; text: string }>,
  context: { accountName?: string; repName?: string; callType?: string },
  apiKey: string
): Promise<Map<string, NERResult>> {
  const resultsMap = new Map<string, NERResult>();
  
  if (chunks.length === 0) {
    return resultsMap;
  }

  // Build the prompt with numbered chunks
  const chunkList = chunks.map((c, i) => 
    `[CHUNK ${i + 1}]\n${c.text.slice(0, 2000)}`
  ).join('\n\n---\n\n');

  const batchSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        description: `Array of ${chunks.length} NER results, one per chunk in order`,
        items: NER_EXTRACTION_SCHEMA
      }
    },
    required: ["results"]
  };

  const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{
        role: 'user',
        content: `Extract entities, topics, and MEDDPICC elements from each of these ${chunks.length} sales call transcript chunks.
Return exactly ${chunks.length} results in the same order as the chunks.

Context: Account=${context.accountName || 'Unknown'}, Rep=${context.repName || 'Unknown'}, CallType=${context.callType || 'Unknown'}

${chunkList}`
      }],
      tools: [{
        type: 'function',
        function: {
          name: 'extract_entities_batch',
          description: `Extract NER for ${chunks.length} transcript chunks, returning results in order`,
          parameters: batchSchema
        }
      }],
      tool_choice: { type: 'function', function: { name: 'extract_entities_batch' } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[chunk-transcripts] Batch NER API error:', response.status, errorText);
    throw new Error(`Batch NER API error: ${response.status}`);
  }

  const data = await response.json();
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  
  if (!toolCall?.function?.arguments) {
    console.warn('[chunk-transcripts] No tool call in batch NER response, using defaults for all chunks');
    chunks.forEach(c => resultsMap.set(c.id, { entities: {}, topics: [], meddpicc_elements: [] }));
    return resultsMap;
  }

  try {
    const args = JSON.parse(toolCall.function.arguments);
    const results = args.results || [];
    
    // Map results back to chunk IDs
    chunks.forEach((chunk, index) => {
      if (index < results.length) {
        resultsMap.set(chunk.id, {
          entities: results[index].entities || {},
          topics: results[index].topics || [],
          meddpicc_elements: results[index].meddpicc_elements || []
        });
      } else {
        // If we got fewer results than chunks, use defaults
        console.warn(`[chunk-transcripts] Missing NER result for chunk index ${index}`);
        resultsMap.set(chunk.id, { entities: {}, topics: [], meddpicc_elements: [] });
      }
    });
  } catch (parseError) {
    console.error('[chunk-transcripts] Failed to parse batch NER response:', parseError);
    chunks.forEach(c => resultsMap.set(c.id, { entities: {}, topics: [], meddpicc_elements: [] }));
  }

  return resultsMap;
}

// Adaptive rate limiting processor with exponential backoff
async function processWithAdaptiveRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = NER_BATCH_SIZE
): Promise<Array<{ success: boolean; result?: R; error?: string }>> {
  const results: Array<{ success: boolean; result?: R; error?: string }> = [];
  let currentDelay = BASE_DELAY_MS;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    for (const item of batch) {
      let retries = 0;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          const result = await processor(item);
          results.push({ success: true, result });
          success = true;
          currentDelay = Math.max(BASE_DELAY_MS, currentDelay * 0.9);
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          if (err.status === 429 || (err.message && err.message.includes('429'))) {
            retries++;
            currentDelay = Math.min(MAX_DELAY_MS, currentDelay * 2);
            console.log(`[chunk-transcripts] Rate limited, waiting ${currentDelay}ms (retry ${retries}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, currentDelay));
          } else {
            console.error('[chunk-transcripts] NER extraction failed:', error);
            results.push({ success: false, error: err.message || 'Unknown error' });
            break;
          }
        }
      }

      if (!success && retries >= MAX_RETRIES) {
        results.push({ success: false, error: 'Max retries exceeded' });
      }
    }

    // Delay between batches
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, currentDelay));
    }
  }

  return results;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = chunkTranscriptsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map((err) => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[chunk-transcripts] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcript_ids, backfill_all, backfill_embeddings, backfill_entities, reset_all_chunks } = validation.data;

    console.log(`[chunk-transcripts] Request: backfill_all=${backfill_all}, backfill_embeddings=${backfill_embeddings}, backfill_entities=${backfill_entities}, reset_all_chunks=${reset_all_chunks}, transcript_ids=${transcript_ids?.length || 0}`);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isInternalServiceCall = token === supabaseServiceKey;

    let userId: string | null = null;
    let userRole: string | null = null;

    if (isInternalServiceCall) {
      console.log('[chunk-transcripts] Internal service call detected');
      userId = 'service';
      userRole = 'admin';
    } else {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Authorization required' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
      
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid authentication' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      userId = user.id;

      const rateLimitResult = checkRateLimit(user.id);
      if (!rateLimitResult.allowed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { 
            status: 429, 
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimitResult.retryAfter || 60)
            } 
          }
        );
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      userRole = roleData?.role || null;

      if (!userRole) {
        return new Response(
          JSON.stringify({ error: 'Authentication required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const isAdmin = userRole === 'admin';

    // ========== RESET ALL CHUNKS MODE ==========
    if (reset_all_chunks) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can reset all chunks' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated reset_all_chunks`);

      // Get count before deletion
      const { count: beforeCount } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

      // Delete all chunks - using a condition that matches all rows
      const { error: deleteError } = await supabase
        .from('transcript_chunks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.error('[chunk-transcripts] Error deleting chunks:', deleteError);
        throw new Error('Failed to delete chunks: ' + deleteError.message);
      }

      console.log(`[chunk-transcripts] Deleted ${beforeCount || 0} chunks`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Deleted all transcript chunks`,
          deleted_count: beforeCount || 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL EMBEDDINGS MODE ==========
    if (backfill_embeddings) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_embeddings mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_embeddings`);

      // Fetch smaller batch to avoid overwhelming the API
      const { data: chunksNeedingEmbeddings, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text')
        .is('embedding', null)
        .limit(EMBEDDING_BATCH_SIZE);

      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks for embedding backfill:', fetchError);
        throw new Error('Failed to fetch chunks for embedding backfill');
      }

      const chunksToProcess = chunksNeedingEmbeddings || [];
      console.log(`[chunk-transcripts] Found ${chunksToProcess.length} chunks needing embeddings (batch limit: ${EMBEDDING_BATCH_SIZE})`);

      let successCount = 0;
      let errorCount = 0;

      // Process SEQUENTIALLY with delays to respect OpenAI's 40k TPM rate limit
      // Each text-embedding-3-small request uses ~500-2000 tokens depending on input size
      // Sequential processing with delays prevents rate limit exhaustion
      for (const chunk of chunksToProcess) {
        try {
          // Add delay BEFORE each API call to spread out requests
          await new Promise(r => setTimeout(r, EMBEDDING_DELAY_MS));
          
          const embedding = await generateEmbedding(chunk.chunk_text, openaiApiKey);
          const { error: updateError } = await supabase
            .from('transcript_chunks')
            .update({ embedding })
            .eq('id', chunk.id);

          if (updateError) {
            console.error(`[chunk-transcripts] Failed to save embedding for chunk ${chunk.id}:`, updateError);
            errorCount++;
          } else {
            successCount++;
            console.log(`[chunk-transcripts] Embedded chunk ${successCount}/${chunksToProcess.length}`);
          }
        } catch (error) {
          console.error(`[chunk-transcripts] Embedding failed for chunk ${chunk.id}:`, error);
          errorCount++;
          // Continue processing remaining chunks even if one fails
        }
      }

      // Get total counts for progress
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: chunksWithEmbeddings } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);

      const remaining = (totalChunks || 0) - (chunksWithEmbeddings || 0);

      console.log(`[chunk-transcripts] Embedding backfill complete: ${successCount} success, ${errorCount} errors, ${remaining} remaining`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Backfilled ${successCount} embeddings (${errorCount} errors)`,
          processed: chunksToProcess.length,
          success_count: successCount,
          error_count: errorCount,
          total_chunks: totalChunks || 0,
          chunks_with_embeddings: chunksWithEmbeddings || 0,
          remaining // Key for auto-continue
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL ENTITIES MODE ==========
    if (backfill_entities) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_entities mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_entities`);

      const { data: chunksNeedingNER, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, metadata, transcript_id')
        .or('extraction_status.eq.pending,extraction_status.eq.failed')
        .limit(NER_BACKFILL_BATCH_SIZE);

      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks for NER backfill:', fetchError);
        throw new Error('Failed to fetch chunks for NER backfill');
      }

      const chunksToProcess = chunksNeedingNER || [];
      console.log(`[chunk-transcripts] Found ${chunksToProcess.length} chunks needing NER extraction`);

      let successCount = 0;
      let errorCount = 0;

      // Process chunks in batches of NER_CHUNKS_PER_API_CALL (5 chunks per API call)
      for (let i = 0; i < chunksToProcess.length; i += NER_CHUNKS_PER_API_CALL) {
        const batch = chunksToProcess.slice(i, i + NER_CHUNKS_PER_API_CALL);
        const batchNumber = Math.floor(i / NER_CHUNKS_PER_API_CALL) + 1;
        const totalBatches = Math.ceil(chunksToProcess.length / NER_CHUNKS_PER_API_CALL);
        
        console.log(`[chunk-transcripts] Processing batch ${batchNumber}/${totalBatches} (${batch.length} chunks)`);

        // Get context from first chunk's metadata
        const firstMetadata = batch[0]?.metadata as { account_name?: string; rep_name?: string; call_type?: string } | undefined;
        const context = {
          accountName: firstMetadata?.account_name,
          repName: firstMetadata?.rep_name,
          callType: firstMetadata?.call_type
        };

        try {
          // Process batch with single API call
          const batchInput = batch.map(chunk => ({
            id: chunk.id,
            text: chunk.chunk_text
          }));

          const nerResults = await extractEntitiesBatch(batchInput, context, lovableApiKey);

          // Update each chunk with its NER results
          for (const chunk of batch) {
            const nerResult = nerResults.get(chunk.id);
            if (nerResult) {
              const { error: updateError } = await supabase
                .from('transcript_chunks')
                .update({
                  entities: nerResult.entities,
                  topics: nerResult.topics,
                  meddpicc_elements: nerResult.meddpicc_elements,
                  extraction_status: 'completed'
                })
                .eq('id', chunk.id);

              if (updateError) {
                console.error(`[chunk-transcripts] Failed to save NER for chunk ${chunk.id}:`, updateError);
                errorCount++;
              } else {
                successCount++;
              }
            } else {
              console.warn(`[chunk-transcripts] No NER result for chunk ${chunk.id}`);
              errorCount++;
            }
          }

          console.log(`[chunk-transcripts] Batch ${batchNumber} complete: ${batch.length} chunks processed`);

        } catch (error) {
          console.error(`[chunk-transcripts] Batch ${batchNumber} failed:`, error);
          // Mark all chunks in failed batch with error
          for (const chunk of batch) {
            await supabase
              .from('transcript_chunks')
              .update({ extraction_status: 'failed' })
              .eq('id', chunk.id);
            errorCount++;
          }
        }

        // Small delay between batches to avoid rate limiting
        if (i + NER_CHUNKS_PER_API_CALL < chunksToProcess.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // Get total counts for progress
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: chunksWithEntities } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('extraction_status', 'completed');

      // Get remaining count for auto-continue (like embeddings does)
      const remaining = (totalChunks || 0) - (chunksWithEntities || 0);

      console.log(`[chunk-transcripts] NER backfill complete: ${successCount} success, ${errorCount} errors, ${remaining} remaining`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Backfilled ${successCount} chunks with NER (${errorCount} errors)`,
          processed: chunksToProcess.length,
          success_count: successCount,
          error_count: errorCount,
          total_chunks: totalChunks || 0,
          chunks_with_entities: chunksWithEntities || 0,
          remaining // Key for auto-continue
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL ALL MODE (Legacy + RAG V2) ==========
    if (backfill_all) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_all mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_all`);

      // Include both 'completed' AND 'skipped' transcripts (skipped = indexed-only from bulk upload)
      const { data: allTranscripts, error: allError } = await supabase
        .from('call_transcripts')
        .select('id')
        .in('analysis_status', ['completed', 'skipped'])
        .is('deleted_at', null);

      if (allError) {
        console.error('[chunk-transcripts] Error fetching all transcripts:', allError);
        throw new Error('Failed to fetch transcripts for backfill');
      }

      const allIds = (allTranscripts || []).map(t => t.id);

      const { data: existingChunks } = await supabase
        .from('transcript_chunks')
        .select('transcript_id')
        .in('transcript_id', allIds.length > 0 ? allIds : ['00000000-0000-0000-0000-000000000000']);

      const chunkedIds = new Set((existingChunks || []).map(c => c.transcript_id));
      const unchunkedIds = allIds.filter(id => !chunkedIds.has(id));

      console.log(`[chunk-transcripts] Backfill: ${allIds.length} total completed, ${chunkedIds.size} already indexed, ${unchunkedIds.length} to process`);

      if (unchunkedIds.length === 0) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'All transcripts already indexed',
            total: allIds.length,
            indexed: chunkedIds.size,
            new_chunks: 0 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let totalChunksCreated = 0;
      let transcriptsProcessed = 0;

      for (let i = 0; i < unchunkedIds.length; i += CHUNKING_BATCH_SIZE) {
        const batchIds = unchunkedIds.slice(i, i + CHUNKING_BATCH_SIZE);
        
        const { data: transcripts } = await supabase
          .from('call_transcripts')
          .select('id, call_date, account_name, call_type, raw_text, rep_id')
          .in('id', batchIds);

        if (!transcripts || transcripts.length === 0) continue;

        const repIds = [...new Set(transcripts.map(t => t.rep_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', repIds);

        const repMap = new Map((profiles || []).map(p => [p.id, p.name]));

        const allChunks: TranscriptChunk[] = [];
        for (const transcript of transcripts) {
          const chunks = chunkText(transcript.raw_text || '');
          const repName = repMap.get(transcript.rep_id) || 'Unknown';
          
          // Only create chunks - embedding and NER are handled separately via backfill_embeddings/backfill_entities
          // This avoids edge function timeouts on large backfills
          for (let idx = 0; idx < chunks.length; idx++) {
            const chunkTextContent = chunks[idx];

            allChunks.push({
              transcript_id: transcript.id,
              chunk_index: idx,
              chunk_text: chunkTextContent,
              // No embedding or NER - these are generated separately to avoid timeout
              extraction_status: 'pending',
              metadata: {
                account_name: transcript.account_name || 'Unknown',
                call_date: transcript.call_date,
                call_type: transcript.call_type || 'Call',
                rep_name: repName,
                rep_id: transcript.rep_id,
              }
            });
          }
        }

        // Insert chunks in batches
        const INSERT_BATCH_SIZE = 100;
        for (let j = 0; j < allChunks.length; j += INSERT_BATCH_SIZE) {
          const insertBatch = allChunks.slice(j, j + INSERT_BATCH_SIZE);
          const { error: insertError } = await supabase
            .from('transcript_chunks')
            .insert(insertBatch);

          if (insertError) {
            console.error('[chunk-transcripts] Error inserting chunks:', insertError);
          } else {
            totalChunksCreated += insertBatch.length;
          }
        }

        transcriptsProcessed += transcripts.length;
        console.log(`[chunk-transcripts] Backfill progress: ${transcriptsProcessed}/${unchunkedIds.length} transcripts`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Backfilled ${transcriptsProcessed} transcripts with RAG V2`,
          total: allIds.length,
          indexed: chunkedIds.size + transcriptsProcessed,
          new_chunks: totalChunksCreated 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STANDARD MODE: SPECIFIC TRANSCRIPT_IDS WITH RAG V2 ==========
    const idsToProcess = transcript_ids || [];
    const isManager = userRole === 'manager';
    const isRep = userRole === 'rep';

    let authorizedTranscriptIds: string[] = [];

    if (isAdmin) {
      authorizedTranscriptIds = idsToProcess;
      console.log(`[chunk-transcripts] Admin ${userId} authorized for all ${idsToProcess.length} transcripts`);
    } else if (isManager) {
      const { data: managerTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', userId)
        .maybeSingle();

      if (!managerTeam) {
        return new Response(
          JSON.stringify({ error: 'No team assigned. Please contact an administrator.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: teamReps } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', managerTeam.id);

      const teamRepIds = new Set((teamReps || []).map(r => r.id));

      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('id, rep_id')
        .in('id', idsToProcess);

      authorizedTranscriptIds = (transcripts || [])
        .filter(t => teamRepIds.has(t.rep_id))
        .map(t => t.id);

      console.log(`[chunk-transcripts] Manager ${userId} authorized for ${authorizedTranscriptIds.length} team transcripts`);
    } else if (isRep) {
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('id, rep_id')
        .in('id', idsToProcess);

      authorizedTranscriptIds = (transcripts || [])
        .filter(t => t.rep_id === userId)
        .map(t => t.id);

      console.log(`[chunk-transcripts] Rep ${userId} authorized for ${authorizedTranscriptIds.length} own transcripts`);
    }

    if (authorizedTranscriptIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No transcripts to process (none authorized)',
          chunked: 0,
          new_chunks: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which transcripts already have chunks
    const { data: existingChunks } = await supabase
      .from('transcript_chunks')
      .select('transcript_id')
      .in('transcript_id', authorizedTranscriptIds);

    const chunkedIds = new Set((existingChunks || []).map(c => c.transcript_id));
    const idsToChunk = authorizedTranscriptIds.filter(id => !chunkedIds.has(id));

    console.log(`[chunk-transcripts] ${chunkedIds.size} already chunked, ${idsToChunk.length} to process`);

    if (idsToChunk.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All transcripts already indexed',
          chunked: authorizedTranscriptIds.length,
          new_chunks: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch transcripts to chunk
    const { data: transcripts, error: fetchError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, account_name, call_type, raw_text, rep_id')
      .in('id', idsToChunk);

    if (fetchError) {
      console.error('[chunk-transcripts] Error fetching transcripts:', fetchError);
      throw new Error('Failed to fetch transcripts');
    }

    // Get rep names for metadata
    const repIds = [...new Set((transcripts || []).map(t => t.rep_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', repIds);

    const repMap = new Map((profiles || []).map(p => [p.id, p.name]));

    // Chunk each transcript - only create chunks, no inline embedding/NER
    // Embedding and NER are handled separately via backfill_embeddings/backfill_entities
    // This avoids edge function timeouts on large or multiple transcript processing
    const allChunks: TranscriptChunk[] = [];
    
    for (const transcript of transcripts || []) {
      const chunks = chunkText(transcript.raw_text || '');
      const repName = repMap.get(transcript.rep_id) || 'Unknown';
      
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkTextContent = chunks[idx];

        allChunks.push({
          transcript_id: transcript.id,
          chunk_index: idx,
          chunk_text: chunkTextContent,
          // No embedding or NER - these are generated separately via backfill to avoid timeout
          extraction_status: 'pending',
          metadata: {
            account_name: transcript.account_name || 'Unknown',
            call_date: transcript.call_date,
            call_type: transcript.call_type || 'Call',
            rep_name: repName,
            rep_id: transcript.rep_id,
          }
        });
      }
    }

    console.log(`[chunk-transcripts] Created ${allChunks.length} RAG V2 chunks from ${transcripts?.length || 0} transcripts`);

    // Insert chunks in batches
    const BATCH_SIZE = 100;
    let insertedCount = 0;
    
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('transcript_chunks')
        .insert(batch);

      if (insertError) {
        console.error('[chunk-transcripts] Error inserting chunks:', insertError);
        throw new Error(`Failed to insert chunks: ${insertError.message}`);
      }
      
      insertedCount += batch.length;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Indexed ${transcripts?.length || 0} transcripts with RAG V2`,
        chunked: authorizedTranscriptIds.length,
        new_chunks: insertedCount 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[chunk-transcripts] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
