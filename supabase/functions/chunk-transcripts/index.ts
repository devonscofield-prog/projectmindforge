import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { timingSafeEqual } from "../_shared/hmac.ts";

// Version indicator for deployment verification
console.log('[chunk-transcripts] Version: v3-timeout30s-parallel3');

// Declare EdgeRuntime for Deno edge functions
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

import { getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rateLimiter.ts";
import { getCorrelationId, createTracedLogger } from "../_shared/tracing.ts";

// Zod validation schema - supports transcript_ids, backfill modes, reset, full_reindex, and ner_batch
const chunkTranscriptsSchema = z.object({
  transcript_ids: z.array(z.string().uuid()).max(100).optional(),
  backfill_all: z.boolean().optional(),
  backfill_embeddings: z.boolean().optional(),
  backfill_entities: z.boolean().optional(),
  reset_all_chunks: z.boolean().optional(),
  full_reindex: z.boolean().optional(),
  ner_batch: z.boolean().optional(),
  embedding_batch: z.boolean().optional(),
  batch_size: z.number().min(1).max(50).optional(),
  job_id: z.string().uuid().optional(),
}).refine(
  (data) => data.backfill_all === true || data.backfill_embeddings === true || 
            data.backfill_entities === true || data.reset_all_chunks === true ||
            data.full_reindex === true || data.ner_batch === true ||
            data.embedding_batch === true ||
            (data.transcript_ids && data.transcript_ids.length > 0),
  { message: "Either transcript_ids, a backfill mode, reset_all_chunks, full_reindex, ner_batch, or embedding_batch is required" }
);

// Constants
const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;
const NER_BATCH_SIZE = 3; // Reduced to 3 for more reliable parallel processing
const BASE_DELAY_MS = 200;
const MAX_DELAY_MS = 5000;
const MAX_RETRIES = 3;
const NER_CHUNKS_PER_API_CALL = 3; // Kept for legacy background jobs
const NER_INTERNAL_TIMEOUT_MS = 120000; // 120 seconds internal timeout (edge function limit is 150s)
const NER_PER_CHUNK_TIMEOUT_MS = 30000; // 30 seconds per individual chunk
const CHUNKING_BATCH_SIZE = 50;
const EMBEDDING_BATCH_SIZE = 10;
const EMBEDDING_DELAY_MS = 500;
const NER_BATCH_DELAY_MS = 500;
const NER_ERROR_DELAY_MS = 2000;
const NER_RETRY_MAX = 3;
const NER_RETRY_BASE_DELAY_MS = 500;

// ========== HMAC SIGNATURE VALIDATION ==========
async function validateHmacSignature(
  headers: Headers,
  body: string,
  serviceRoleKey: string,
  maxAgeMs: number = 300000 // 5 minutes
): Promise<{ valid: boolean; error?: string }> {
  const signature = headers.get('X-Request-Signature');
  const timestamp = headers.get('X-Request-Timestamp');
  const nonce = headers.get('X-Request-Nonce');
  
  // Check for required headers
  if (!signature || !timestamp || !nonce) {
    return { valid: false, error: 'Missing signature headers' };
  }
  
  // Validate timestamp to prevent replay attacks
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return { valid: false, error: 'Invalid timestamp format' };
  }
  
  const now = Date.now();
  if (now - requestTime > maxAgeMs) {
    return { valid: false, error: 'Request expired' };
  }
  
  if (requestTime > now + 60000) { // Allow 1 minute clock skew
    return { valid: false, error: 'Request timestamp in future' };
  }
  
  // Reconstruct and validate signature
  const signaturePayload = `${timestamp}.${nonce}.${body}`;
  const secret = serviceRoleKey.substring(0, 32);
  
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(signaturePayload);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const expectedBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const expectedSignature = Array.from(new Uint8Array(expectedBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  
  if (result !== 0) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  return { valid: true };
}

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

  const speakerPattern = /(?=\n\n(?:REP|PROSPECT):)/gi;
  const paragraphPattern = /\n\n+/;
  const sentencePattern = /(?<=[.!?])\s+/;

  let sections = text.split(speakerPattern).filter(s => s.trim().length > 0);
  sections = recursiveSplit(sections, paragraphPattern, CHUNK_SIZE * 1.5);
  sections = recursiveSplit(sections, sentencePattern, CHUNK_SIZE * 1.5);
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

// Generate embedding using OpenAI API directly
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
          input: text.slice(0, 8000)
        })
      });

      if (response.status === 429) {
        const errorText = await response.text();
        console.warn(`[chunk-transcripts] Embedding rate limited (attempt ${attempt + 1}/${maxRetries}):`, errorText);
        
        const waitMatch = errorText.match(/try again in (\d+(?:\.\d+)?)(ms|s)/i);
        if (waitMatch) {
          const waitTime = parseFloat(waitMatch[1]);
          retryDelay = waitMatch[2].toLowerCase() === 's' ? waitTime * 1000 : waitTime;
          retryDelay = Math.ceil(retryDelay) + 100;
        } else {
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

      return `[${embedding.join(',')}]`;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (!lastError.message.includes('429')) {
        throw lastError;
      }
    }
  }

  console.error('[chunk-transcripts] Embedding generation failed after all retries:', lastError);
  throw lastError || new Error('Embedding generation failed');
}

// Retry helper with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: { maxRetries?: number; baseDelay?: number; operationName?: string } = {}
): Promise<T> {
  const { maxRetries = NER_RETRY_MAX, baseDelay = NER_RETRY_BASE_DELAY_MS, operationName = 'operation' } = options;
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      const isServerError = lastError.message.includes('500') || 
                           lastError.message.includes('502') || 
                           lastError.message.includes('503') || 
                           lastError.message.includes('504') ||
                           lastError.message.includes('Worker threw exception');
      
      const isRateLimited = lastError.message.includes('429');
      
      if (!isServerError && !isRateLimited) {
        console.error(`[chunk-transcripts] ${operationName} failed with non-retryable error:`, lastError.message);
        throw lastError;
      }
      
      if (attempt === maxRetries) {
        console.error(`[chunk-transcripts] ${operationName} failed after ${maxRetries + 1} attempts:`, lastError.message);
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt);
      console.log(`[chunk-transcripts] ${operationName} retry ${attempt + 1}/${maxRetries} after ${delay}ms (error: ${lastError.message.slice(0, 100)})`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  throw lastError || new Error(`${operationName} failed`);
}

// NER extraction (single chunk - for compatibility)
async function extractEntities(
  chunkTextContent: string,
  context: { accountName?: string; repName?: string; callType?: string },
  apiKey: string
): Promise<NERResult> {
  const results = await extractEntitiesBatchInternal([{ id: 'single', text: chunkTextContent }], context, apiKey);
  return results.get('single') || { entities: {}, topics: [], meddpicc_elements: [] };
}

// Public batched NER extraction with retry wrapper
async function extractEntitiesBatch(
  chunks: Array<{ id: string; text: string }>,
  context: { accountName?: string; repName?: string; callType?: string },
  apiKey: string
): Promise<Map<string, NERResult>> {
  return retryWithBackoff(
    () => extractEntitiesBatchInternal(chunks, context, apiKey),
    { maxRetries: NER_RETRY_MAX, baseDelay: NER_RETRY_BASE_DELAY_MS, operationName: 'NER batch extraction' }
  );
}

// Internal batched NER extraction
async function extractEntitiesBatchInternal(
  chunks: Array<{ id: string; text: string }>,
  context: { accountName?: string; repName?: string; callType?: string },
  apiKey: string
): Promise<Map<string, NERResult>> {
  const resultsMap = new Map<string, NERResult>();
  
  if (chunks.length === 0) {
    return resultsMap;
  }

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

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
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
    console.error('[chunk-transcripts] Batch NER API error:', response.status, errorText.slice(0, 500));
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
    
    chunks.forEach((chunk, index) => {
      if (index < results.length) {
        resultsMap.set(chunk.id, {
          entities: results[index].entities || {},
          topics: results[index].topics || [],
          meddpicc_elements: results[index].meddpicc_elements || []
        });
      } else {
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

// ========== BACKGROUND JOB PROCESSING ==========

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processNERBackfillJob(
  jobId: string,
  supabase: SupabaseClient<any, "public", any>,
  openaiNerKey: string
) {
  console.log(`[chunk-transcripts] Starting background NER backfill for job ${jobId}`);
  
  let totalProcessed = 0;
  let totalErrors = 0;
  let shouldStop = false;
  let lastHeartbeat = Date.now();
  const HEARTBEAT_INTERVAL_MS = 10000; // Update every 10 seconds
  
  // Helper to update heartbeat
  const updateHeartbeat = async (forceProgress = false) => {
    const now = Date.now();
    if (forceProgress || now - lastHeartbeat > HEARTBEAT_INTERVAL_MS) {
      lastHeartbeat = now;
      
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });
      
      const { count: chunksWithEntities } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('extraction_status', 'completed');
      
      await supabase
        .from('background_jobs')
        .update({
          progress: {
            processed: chunksWithEntities || 0,
            total: totalChunks || 0,
            errors: totalErrors,
            message: `Processing NER extraction...`
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
      
      console.log(`[chunk-transcripts] Heartbeat: ${chunksWithEntities}/${totalChunks} chunks processed`);
    }
  };
  
  try {
    // IMMEDIATELY update progress to show job is alive
    console.log(`[chunk-transcripts] Sending initial heartbeat for job ${jobId}`);
    await updateHeartbeat(true);
    
    // Main processing loop
    while (!shouldStop) {
      // Check if job was cancelled
      const { data: job } = await supabase
        .from('background_jobs')
        .select('status')
        .eq('id', jobId)
        .single() as { data: { status: string } | null };
      
      if (job?.status === 'cancelled') {
        console.log(`[chunk-transcripts] Job ${jobId} was cancelled`);
        shouldStop = true;
        break;
      }
      
      // Fetch chunks needing NER
      const { data: chunksNeedingNER, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, metadata, transcript_id')
        .or('extraction_status.eq.pending,extraction_status.eq.failed')
        .limit(9) as { data: Array<{ id: string; chunk_text: string; metadata: any; transcript_id: string }> | null; error: any };
      
      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks:', fetchError);
        throw fetchError;
      }
      
      if (!chunksNeedingNER || chunksNeedingNER.length === 0) {
        console.log(`[chunk-transcripts] No more chunks to process`);
        shouldStop = true;
        break;
      }
      
      console.log(`[chunk-transcripts] Processing batch of ${chunksNeedingNER.length} chunks`);
      
      // Process chunks in batches
      for (let i = 0; i < chunksNeedingNER.length; i += NER_CHUNKS_PER_API_CALL) {
        const batch = chunksNeedingNER.slice(i, i + NER_CHUNKS_PER_API_CALL);
        
        const firstMetadata = batch[0]?.metadata as { account_name?: string; rep_name?: string; call_type?: string } | undefined;
        const context = {
          accountName: firstMetadata?.account_name,
          repName: firstMetadata?.rep_name,
          callType: firstMetadata?.call_type
        };
        
        try {
          const batchInput = batch.map(chunk => ({
            id: chunk.id,
            text: chunk.chunk_text
          }));
          
          const nerResults = await extractEntitiesBatch(batchInput, context, openaiNerKey);
          
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
                totalErrors++;
              } else {
                totalProcessed++;
              }
            } else {
              totalErrors++;
            }
          }
        } catch (error) {
          console.error(`[chunk-transcripts] NER batch failed:`, error);
          for (const chunk of batch) {
            await supabase
              .from('transcript_chunks')
              .update({ extraction_status: 'failed' })
              .eq('id', chunk.id);
            totalErrors++;
          }
        }
        
        // Update heartbeat after each batch
        await updateHeartbeat();
        
        // Delay between batches
        if (i + NER_CHUNKS_PER_API_CALL < chunksNeedingNER.length) {
          await new Promise(r => setTimeout(r, NER_BATCH_DELAY_MS));
        }
      }
      
      // Small delay before next batch
      await new Promise(r => setTimeout(r, 500));
    }
    
    // Mark job as completed
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        progress: {
          processed: totalProcessed,
          total: totalProcessed + totalErrors,
          errors: totalErrors,
          message: 'Completed'
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`[chunk-transcripts] NER backfill job ${jobId} completed: ${totalProcessed} processed, ${totalErrors} errors`);
    
  } catch (error) {
    console.error(`[chunk-transcripts] NER backfill job ${jobId} failed:`, error);
    
    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processEmbeddingsBackfillJob(
  jobId: string,
  supabase: SupabaseClient<any, "public", any>,
  openaiApiKey: string
) {
  console.log(`[chunk-transcripts] Starting background embeddings backfill for job ${jobId}`);
  
  let totalProcessed = 0;
  let totalErrors = 0;
  let shouldStop = false;
  
  try {
    while (!shouldStop) {
      // Check if job was cancelled
      const { data: job } = await supabase
        .from('background_jobs')
        .select('status')
        .eq('id', jobId)
        .single() as { data: { status: string } | null };
      
      if (job?.status === 'cancelled') {
        console.log(`[chunk-transcripts] Job ${jobId} was cancelled`);
        shouldStop = true;
        break;
      }
      
      // Fetch chunks needing embeddings
      const { data: chunksNeedingEmbeddings, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text')
        .is('embedding', null)
        .limit(EMBEDDING_BATCH_SIZE) as { data: Array<{ id: string; chunk_text: string }> | null; error: any };
      
      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks:', fetchError);
        throw fetchError;
      }
      
      if (!chunksNeedingEmbeddings || chunksNeedingEmbeddings.length === 0) {
        console.log(`[chunk-transcripts] No more chunks to process`);
        shouldStop = true;
        break;
      }
      
      // Process sequentially with delays
      for (const chunk of chunksNeedingEmbeddings) {
        try {
          await new Promise(r => setTimeout(r, EMBEDDING_DELAY_MS));
          
          const embedding = await generateEmbedding(chunk.chunk_text, openaiApiKey);
          const { error: updateError } = await supabase
            .from('transcript_chunks')
            .update({ embedding })
            .eq('id', chunk.id);
          
          if (updateError) {
            console.error(`[chunk-transcripts] Failed to save embedding for chunk ${chunk.id}:`, updateError);
            totalErrors++;
          } else {
            totalProcessed++;
          }
        } catch (error) {
          console.error(`[chunk-transcripts] Embedding failed for chunk ${chunk.id}:`, error);
          totalErrors++;
        }
      }
      
      // Update job progress
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });
      
      const { count: chunksWithEmbeddings } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);
      
      await supabase
        .from('background_jobs')
        .update({
          progress: {
            processed: chunksWithEmbeddings || 0,
            total: totalChunks || 0,
            errors: totalErrors
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);
    }
    
    // Mark job as completed
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`[chunk-transcripts] Embeddings backfill job ${jobId} completed: ${totalProcessed} processed, ${totalErrors} errors`);
    
  } catch (error) {
    console.error(`[chunk-transcripts] Embeddings backfill job ${jobId} failed:`, error);
    
    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

// ========== FULL REINDEX BACKGROUND JOB PROCESSING ==========

interface FullReindexProgress {
  stage: 'reset' | 'chunking' | 'embeddings' | 'ner';
  stages_completed: string[];
  current_stage_progress: { processed: number; total: number };
  overall_percent: number;
  message: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processFullReindexJob(
  jobId: string,
  supabase: SupabaseClient<any, "public", any>,
  openaiApiKey: string,
  openaiNerKey: string
) {
  console.log(`[chunk-transcripts] Starting full reindex background job ${jobId}`);
  
  const updateProgress = async (progress: FullReindexProgress) => {
    await supabase
      .from('background_jobs')
      .update({
        progress,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  };
  
  const checkCancelled = async (): Promise<boolean> => {
    const { data: job } = await supabase
      .from('background_jobs')
      .select('status')
      .eq('id', jobId)
      .single() as { data: { status: string } | null };
    return job?.status === 'cancelled';
  };
  
  try {
    // ========== STAGE 1: RESET (Delete all chunks) ==========
    console.log(`[chunk-transcripts] Full reindex - Stage 1: Deleting all chunks`);
    await updateProgress({
      stage: 'reset',
      stages_completed: [],
      current_stage_progress: { processed: 0, total: 1 },
      overall_percent: 0,
      message: 'Deleting existing chunks...'
    });
    
    const { count: beforeCount } = await supabase
      .from('transcript_chunks')
      .select('*', { count: 'exact', head: true });
    
    const { error: deleteError } = await supabase
      .from('transcript_chunks')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (deleteError) {
      throw new Error(`Failed to delete chunks: ${deleteError.message}`);
    }
    
    console.log(`[chunk-transcripts] Deleted ${beforeCount || 0} chunks`);
    
    if (await checkCancelled()) {
      console.log(`[chunk-transcripts] Job ${jobId} cancelled during reset`);
      return;
    }
    
    // ========== STAGE 2: CHUNKING (Re-chunk all transcripts) ==========
    console.log(`[chunk-transcripts] Full reindex - Stage 2: Re-chunking transcripts`);
    await updateProgress({
      stage: 'chunking',
      stages_completed: ['reset'],
      current_stage_progress: { processed: 0, total: 0 },
      overall_percent: 10,
      message: 'Re-chunking transcripts...'
    });
    
    // Fetch all eligible transcripts
    const { data: allTranscripts, error: fetchError } = await supabase
      .from('call_transcripts')
      .select(`
        id,
        raw_text,
        account_name,
        call_date,
        call_type,
        rep_id,
        profiles:rep_id (name)
      `)
      .in('analysis_status', ['completed', 'skipped'])
      .is('deleted_at', null);
    
    if (fetchError) {
      throw new Error(`Failed to fetch transcripts: ${fetchError.message}`);
    }
    
    const transcripts = allTranscripts || [];
    console.log(`[chunk-transcripts] Found ${transcripts.length} transcripts to chunk`);
    
    let chunkedCount = 0;
    let totalChunks = 0;
    
    for (let i = 0; i < transcripts.length; i += CHUNKING_BATCH_SIZE) {
      if (await checkCancelled()) {
        console.log(`[chunk-transcripts] Job ${jobId} cancelled during chunking`);
        return;
      }
      
      const batch = transcripts.slice(i, i + CHUNKING_BATCH_SIZE);
      const chunksToInsert: TranscriptChunk[] = [];
      
      for (const transcript of batch) {
        const textChunks = chunkText(transcript.raw_text);
        const repProfileData = transcript.profiles as unknown;
        const repName = Array.isArray(repProfileData) 
          ? (repProfileData[0] as { name?: string })?.name 
          : (repProfileData as { name?: string } | null)?.name;
        
        for (let chunkIndex = 0; chunkIndex < textChunks.length; chunkIndex++) {
          chunksToInsert.push({
            transcript_id: transcript.id,
            chunk_index: chunkIndex,
            chunk_text: textChunks[chunkIndex],
            extraction_status: 'pending',
            metadata: {
              account_name: transcript.account_name || 'Unknown',
              call_date: transcript.call_date,
              call_type: transcript.call_type || 'Unknown',
              rep_name: repName || 'Unknown',
              rep_id: transcript.rep_id
            }
          });
        }
      }
      
      if (chunksToInsert.length > 0) {
        const { error: insertError, count } = await supabase
          .from('transcript_chunks')
          .upsert(chunksToInsert, { 
            onConflict: 'transcript_id,chunk_index', 
            ignoreDuplicates: true 
          });
        
        if (insertError) {
          console.error(`[chunk-transcripts] Chunk upsert error:`, insertError);
        } else {
          totalChunks += chunksToInsert.length;
          console.log(`[chunk-transcripts] Upserted ${chunksToInsert.length} chunks (duplicates skipped)`);
        }
      }
      
      chunkedCount += batch.length;
      await updateProgress({
        stage: 'chunking',
        stages_completed: ['reset'],
        current_stage_progress: { processed: chunkedCount, total: transcripts.length },
        overall_percent: 10 + Math.floor((chunkedCount / transcripts.length) * 20),
        message: `Chunking transcripts... ${chunkedCount}/${transcripts.length}`
      });
    }
    
    console.log(`[chunk-transcripts] Created ${totalChunks} chunks from ${transcripts.length} transcripts`);
    
    // ========== STAGE 3: EMBEDDINGS ==========
    console.log(`[chunk-transcripts] Full reindex - Stage 3: Generating embeddings`);
    await updateProgress({
      stage: 'embeddings',
      stages_completed: ['reset', 'chunking'],
      current_stage_progress: { processed: 0, total: totalChunks },
      overall_percent: 30,
      message: 'Generating embeddings...'
    });
    
    let embeddingsProcessed = 0;
    let embeddingsErrors = 0;
    let hasMoreEmbeddings = true;
    
    while (hasMoreEmbeddings) {
      if (await checkCancelled()) {
        console.log(`[chunk-transcripts] Job ${jobId} cancelled during embeddings`);
        return;
      }
      
      const { data: chunksNeedingEmbeddings } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text')
        .is('embedding', null)
        .limit(EMBEDDING_BATCH_SIZE) as { data: Array<{ id: string; chunk_text: string }> | null };
      
      if (!chunksNeedingEmbeddings || chunksNeedingEmbeddings.length === 0) {
        hasMoreEmbeddings = false;
        break;
      }
      
      for (const chunk of chunksNeedingEmbeddings) {
        try {
          await new Promise(r => setTimeout(r, EMBEDDING_DELAY_MS));
          const embedding = await generateEmbedding(chunk.chunk_text, openaiApiKey);
          
          const { error: updateError } = await supabase
            .from('transcript_chunks')
            .update({ embedding })
            .eq('id', chunk.id);
          
          if (updateError) {
            embeddingsErrors++;
          } else {
            embeddingsProcessed++;
          }
        } catch (error) {
          console.error(`[chunk-transcripts] Embedding error:`, error);
          embeddingsErrors++;
        }
      }
      
      const { count: withEmbeddings } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .not('embedding', 'is', null);
      
      await updateProgress({
        stage: 'embeddings',
        stages_completed: ['reset', 'chunking'],
        current_stage_progress: { processed: withEmbeddings || 0, total: totalChunks },
        overall_percent: 30 + Math.floor(((withEmbeddings || 0) / totalChunks) * 35),
        message: `Generating embeddings... ${withEmbeddings || 0}/${totalChunks}`
      });
    }
    
    console.log(`[chunk-transcripts] Embeddings complete: ${embeddingsProcessed} processed, ${embeddingsErrors} errors`);
    
    // ========== STAGE 4: NER EXTRACTION ==========
    console.log(`[chunk-transcripts] Full reindex - Stage 4: NER extraction`);
    await updateProgress({
      stage: 'ner',
      stages_completed: ['reset', 'chunking', 'embeddings'],
      current_stage_progress: { processed: 0, total: totalChunks },
      overall_percent: 65,
      message: 'Extracting entities...'
    });
    
    let nerProcessed = 0;
    let nerErrors = 0;
    let hasMoreNER = true;
    
    while (hasMoreNER) {
      if (await checkCancelled()) {
        console.log(`[chunk-transcripts] Job ${jobId} cancelled during NER`);
        return;
      }
      
      const { data: chunksNeedingNER } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, metadata, transcript_id')
        .or('extraction_status.eq.pending,extraction_status.eq.failed')
        .limit(9) as { data: Array<{ id: string; chunk_text: string; metadata: any; transcript_id: string }> | null };
      
      if (!chunksNeedingNER || chunksNeedingNER.length === 0) {
        hasMoreNER = false;
        break;
      }
      
      for (let i = 0; i < chunksNeedingNER.length; i += NER_CHUNKS_PER_API_CALL) {
        const batch = chunksNeedingNER.slice(i, i + NER_CHUNKS_PER_API_CALL);
        const firstMetadata = batch[0]?.metadata as { account_name?: string; rep_name?: string; call_type?: string } | undefined;
        const context = {
          accountName: firstMetadata?.account_name,
          repName: firstMetadata?.rep_name,
          callType: firstMetadata?.call_type
        };
        
        try {
          const batchInput = batch.map(chunk => ({ id: chunk.id, text: chunk.chunk_text }));
          const nerResults = await extractEntitiesBatch(batchInput, context, lovableApiKey);
          
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
                nerErrors++;
              } else {
                nerProcessed++;
              }
            } else {
              nerErrors++;
            }
          }
        } catch (error) {
          console.error(`[chunk-transcripts] NER batch failed:`, error);
          for (const chunk of batch) {
            await supabase
              .from('transcript_chunks')
              .update({ extraction_status: 'failed' })
              .eq('id', chunk.id);
            nerErrors++;
          }
        }
        
        if (i + NER_CHUNKS_PER_API_CALL < chunksNeedingNER.length) {
          await new Promise(r => setTimeout(r, NER_BATCH_DELAY_MS));
        }
      }
      
      const { count: withNER } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .eq('extraction_status', 'completed');
      
      await updateProgress({
        stage: 'ner',
        stages_completed: ['reset', 'chunking', 'embeddings'],
        current_stage_progress: { processed: withNER || 0, total: totalChunks },
        overall_percent: 65 + Math.floor(((withNER || 0) / totalChunks) * 35),
        message: `Extracting entities... ${withNER || 0}/${totalChunks}`
      });
      
      await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`[chunk-transcripts] NER complete: ${nerProcessed} processed, ${nerErrors} errors`);
    
    // ========== COMPLETE ==========
    await supabase
      .from('background_jobs')
      .update({
        status: 'completed',
        progress: {
          stage: 'ner',
          stages_completed: ['reset', 'chunking', 'embeddings', 'ner'],
          current_stage_progress: { processed: totalChunks, total: totalChunks },
          overall_percent: 100,
          message: `Complete! ${totalChunks} chunks indexed`
        },
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
    
    console.log(`[chunk-transcripts] Full reindex job ${jobId} completed successfully`);
    
  } catch (error) {
    console.error(`[chunk-transcripts] Full reindex job ${jobId} failed:`, error);
    
    await supabase
      .from('background_jobs')
      .update({
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);
  }
}

// ========== MAIN SERVER HANDLER ==========

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);
  const log = createTracedLogger('chunk-transcripts', correlationId);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const openaiNerKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Clone request to read body twice (for signature validation and parsing)
    const bodyText = await req.text();
    let body: unknown;
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const parseResult = chunkTranscriptsSchema.safeParse(body);

    if (!parseResult.success) {
      console.error('[chunk-transcripts] Validation error:', parseResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid request', details: parseResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { transcript_ids, backfill_all, backfill_embeddings, backfill_entities, reset_all_chunks, full_reindex, ner_batch, embedding_batch, batch_size, job_id } = parseResult.data;

    // Helper function to update job status
    const updateJobStatus = async (status: 'processing' | 'completed' | 'failed', error?: string) => {
      if (!job_id) return;
      const updates: Record<string, unknown> = { 
        status, 
        updated_at: new Date().toISOString() 
      };
      if (error) updates.error = error;
      if (status === 'processing') updates.started_at = new Date().toISOString();
      if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
      await supabase.from('background_jobs').update(updates).eq('id', job_id);
    };

    // Mark job as processing if job_id provided
    await updateJobStatus('processing');

    // Auth check with HMAC signature validation for service-to-service calls
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userRole: string | null = null;
    let isSignedRequest = false;

    // Check if this is a signed service-to-service request
    if (req.headers.has('X-Request-Signature')) {
      const validation = await validateHmacSignature(req.headers, bodyText, supabaseServiceKey);
      if (!validation.valid) {
        console.warn('[chunk-transcripts] Invalid HMAC signature:', validation.error);
        return new Response(
          JSON.stringify({ error: 'Invalid request signature', details: validation.error }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      isSignedRequest = true;
      userId = 'service-internal';
      console.log('[chunk-transcripts] Validated signed service-to-service request');
    } else if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      
      // Check if this is the service role key (internal call without signature - legacy support)
      if (await timingSafeEqual(token, supabaseServiceKey)) {
        userId = 'service-internal-legacy';
        console.log('[chunk-transcripts] Legacy service role key auth (consider using HMAC signatures)');
      } else {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (!authError && user) {
          userId = user.id;
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .single();
          userRole = roleData?.role || null;
        }
      }
    }

    const isAdmin = userRole === 'admin';
    const isInternalCall = isSignedRequest || userId === 'service-internal-legacy';

    // Rate limiting for non-admin (5 requests per 60 seconds)
    if (userId && !isAdmin) {
      const { allowed, retryAfter } = await checkRateLimit(supabase, userId, 'chunk-transcripts', 5, 60);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: `Rate limited. Try again in ${retryAfter} seconds.` }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ========== RESET ALL CHUNKS MODE ==========
    if (reset_all_chunks) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can reset all chunks' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated reset_all_chunks`);

      const { count: beforeCount } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

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

    // ========== NER BATCH MODE (Frontend-driven, TRUE BATCHING - single AI call for all chunks) ==========
    if (ner_batch) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use ner_batch mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const effectiveBatchSize = batch_size || NER_BATCH_SIZE;
      console.log(`[chunk-transcripts] Admin ${userId} processing NER batch (size: ${effectiveBatchSize}) - TRUE BATCHING v4`);
      
      const batchStartTime = Date.now();

      // Get total counts first
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: pendingChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .or('extraction_status.eq.pending,extraction_status.is.null');

      // Fetch chunks needing NER
      const { data: chunksNeedingNER, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text, metadata, transcript_id')
        .or('extraction_status.eq.pending,extraction_status.is.null')
        .limit(effectiveBatchSize);

      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks for NER batch:', fetchError);
        throw new Error('Failed to fetch chunks for NER');
      }

      if (!chunksNeedingNER || chunksNeedingNER.length === 0) {
        console.log(`[chunk-transcripts] No more chunks need NER extraction`);
        return new Response(
          JSON.stringify({
            processed: 0,
            remaining: 0,
            total: totalChunks || 0,
            errors: 0,
            complete: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let processed = 0;
      let errors = 0;

      // Prepare batch input for TRUE BATCHING - single AI call for ALL chunks
      const batchInput = chunksNeedingNER.map(chunk => ({
        id: chunk.id,
        text: chunk.chunk_text
      }));

      // Get context from first chunk (they're likely from same/similar transcripts)
      const firstMetadata = chunksNeedingNER[0].metadata as { account_name?: string; rep_name?: string; call_type?: string } | undefined;
      const context = {
        accountName: firstMetadata?.account_name,
        repName: firstMetadata?.rep_name,
        callType: firstMetadata?.call_type
      };

      console.log(`[chunk-transcripts] Calling extractEntitiesBatch with ${batchInput.length} chunks in SINGLE AI call`);

      try {
        // SINGLE AI CALL for all chunks - true batching!
        const nerResults = await extractEntitiesBatch(batchInput, context, lovableApiKey);
        
        const aiCallTime = Date.now() - batchStartTime;
        console.log(`[chunk-transcripts] AI batch call completed in ${aiCallTime}ms for ${batchInput.length} chunks`);

        // Update all chunks in database
        for (const chunk of chunksNeedingNER) {
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
              console.error(`[chunk-transcripts] DB update failed for chunk ${chunk.id.slice(0, 8)}:`, updateError.message);
              errors++;
            } else {
              processed++;
            }
          } else {
            console.warn(`[chunk-transcripts] No NER result for chunk ${chunk.id.slice(0, 8)}`);
            errors++;
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`[chunk-transcripts] Batch NER extraction failed:`, errorMsg);
        
        // Mark all chunks as failed
        for (const chunk of chunksNeedingNER) {
          await supabase
            .from('transcript_chunks')
            .update({ extraction_status: 'failed' })
            .eq('id', chunk.id);
          errors++;
        }
      }

      const elapsedMs = Date.now() - batchStartTime;
      const remaining = Math.max(0, (pendingChunks || 0) - processed);
      console.log(`[chunk-transcripts] NER batch complete in ${elapsedMs}ms: ${processed} processed, ${errors} errors, ${remaining} remaining`);

      return new Response(
        JSON.stringify({
          processed,
          remaining,
          total: totalChunks || 0,
          errors,
          complete: remaining === 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== EMBEDDING BATCH MODE (Frontend-driven, synchronous) ==========
    if (embedding_batch) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use embedding_batch mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const effectiveBatchSize = Math.min(batch_size || 10, 50);
      console.log(`[chunk-transcripts] Admin ${userId} processing embedding batch (size: ${effectiveBatchSize})`);

      // Get total counts
      const { count: totalChunks } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true });

      const { count: missingEmbeddings } = await supabase
        .from('transcript_chunks')
        .select('*', { count: 'exact', head: true })
        .is('embedding', null);

      // Fetch chunks needing embeddings
      const { data: chunksNeedingEmbeddings, error: fetchError } = await supabase
        .from('transcript_chunks')
        .select('id, chunk_text')
        .is('embedding', null)
        .limit(effectiveBatchSize);

      if (fetchError) {
        console.error('[chunk-transcripts] Error fetching chunks for embedding batch:', fetchError);
        throw new Error('Failed to fetch chunks for embeddings');
      }

      if (!chunksNeedingEmbeddings || chunksNeedingEmbeddings.length === 0) {
        console.log(`[chunk-transcripts] No more chunks need embeddings`);
        return new Response(
          JSON.stringify({
            processed: 0,
            remaining: 0,
            total: totalChunks || 0,
            errors: 0,
            complete: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let processed = 0;
      let errors = 0;

      for (const chunk of chunksNeedingEmbeddings) {
        try {
          const embedding = await generateEmbedding(chunk.chunk_text, openaiApiKey);
          const { error: updateError } = await supabase
            .from('transcript_chunks')
            .update({ embedding })
            .eq('id', chunk.id);

          if (updateError) {
            console.error(`[chunk-transcripts] DB update failed for embedding chunk ${chunk.id.slice(0, 8)}:`, updateError.message);
            errors++;
          } else {
            processed++;
          }
        } catch (error) {
          console.error(`[chunk-transcripts] Embedding failed for chunk ${chunk.id.slice(0, 8)}:`, error);
          errors++;
        }
      }

      const remaining = Math.max(0, (missingEmbeddings || 0) - processed);
      console.log(`[chunk-transcripts] Embedding batch complete: ${processed} processed, ${errors} errors, ${remaining} remaining`);

      return new Response(
        JSON.stringify({
          processed,
          remaining,
          total: totalChunks || 0,
          errors,
          complete: remaining === 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL EMBEDDINGS MODE (Background Job) ==========
    if (backfill_embeddings) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_embeddings mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_embeddings (background job)`);

      // Check for existing active job
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id, status')
        .eq('job_type', 'embedding_backfill')
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ 
            error: 'Embeddings backfill already in progress',
            job_id: existingJob.id 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          job_type: 'embedding_backfill',
          status: 'processing',
          created_by: userId,
          started_at: new Date().toISOString(),
          progress: { processed: 0, total: 0, errors: 0 }
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error('Failed to create background job');
      }

      // Start background processing
      EdgeRuntime.waitUntil(processEmbeddingsBackfillJob(job.id, supabase, openaiApiKey));

      // Return immediately with job ID
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Embeddings backfill started in background',
          job_id: job.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL ENTITIES MODE (Background Job) ==========
    if (backfill_entities) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_entities mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_entities (background job)`);

      // Check for existing active job
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id, status')
        .eq('job_type', 'ner_backfill')
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ 
            error: 'NER backfill already in progress',
            job_id: existingJob.id 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          job_type: 'ner_backfill',
          status: 'processing',
          created_by: userId,
          started_at: new Date().toISOString(),
          progress: { processed: 0, total: 0, errors: 0 }
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error('Failed to create background job');
      }

      // Start background processing
      EdgeRuntime.waitUntil(processNERBackfillJob(job.id, supabase, lovableApiKey));

      // Return immediately with job ID
      return new Response(
        JSON.stringify({
          success: true,
          message: 'NER backfill started in background',
          job_id: job.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== BACKFILL ALL MODE ==========
    if (backfill_all) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use backfill_all mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated backfill_all`);

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
          
          for (let idx = 0; idx < chunks.length; idx++) {
            const chunkTextContent = chunks[idx];

            allChunks.push({
              transcript_id: transcript.id,
              chunk_index: idx,
              chunk_text: chunkTextContent,
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

        const INSERT_BATCH_SIZE = 100;
        for (let j = 0; j < allChunks.length; j += INSERT_BATCH_SIZE) {
          const insertBatch = allChunks.slice(j, j + INSERT_BATCH_SIZE);
          const { error: insertError } = await supabase
            .from('transcript_chunks')
            .upsert(insertBatch, { 
              onConflict: 'transcript_id,chunk_index', 
              ignoreDuplicates: true 
            });

          if (insertError) {
            console.error('[chunk-transcripts] Error upserting chunks:', insertError);
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

    // ========== FULL REINDEX MODE (Background Job) ==========
    if (full_reindex) {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Only admins can use full_reindex mode' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[chunk-transcripts] Admin ${userId} initiated full_reindex (background job)`);

      // Check for existing active job
      const { data: existingJob } = await supabase
        .from('background_jobs')
        .select('id, status')
        .eq('job_type', 'full_reindex')
        .in('status', ['pending', 'processing'])
        .maybeSingle();

      if (existingJob) {
        return new Response(
          JSON.stringify({ 
            error: 'Full reindex already in progress',
            job_id: existingJob.id 
          }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create job record
      const { data: job, error: jobError } = await supabase
        .from('background_jobs')
        .insert({
          job_type: 'full_reindex',
          status: 'processing',
          created_by: userId,
          started_at: new Date().toISOString(),
          progress: { 
            stage: 'reset', 
            stages_completed: [], 
            current_stage_progress: { processed: 0, total: 0 },
            overall_percent: 0,
            message: 'Starting full reindex...'
          }
        })
        .select()
        .single();

      if (jobError || !job) {
        throw new Error('Failed to create background job');
      }

      // Start background processing
      EdgeRuntime.waitUntil(processFullReindexJob(job.id, supabase, openaiApiKey, lovableApiKey));

      // Return immediately with job ID
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Full reindex started in background',
          job_id: job.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ========== STANDARD MODE: SPECIFIC TRANSCRIPT_IDS ==========
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

    // Check which are already chunked
    const { data: existingChunks } = await supabase
      .from('transcript_chunks')
      .select('transcript_id')
      .in('transcript_id', authorizedTranscriptIds);

    const chunkedIds = new Set((existingChunks || []).map(c => c.transcript_id));
    const idsNeedingChunks = authorizedTranscriptIds.filter(id => !chunkedIds.has(id));

    console.log(`[chunk-transcripts] ${authorizedTranscriptIds.length} authorized, ${chunkedIds.size} already chunked, ${idsNeedingChunks.length} need chunks`);

    if (idsNeedingChunks.length === 0) {
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

    // Fetch transcripts
    const { data: transcriptsToChunk, error: fetchError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, account_name, call_type, raw_text, rep_id')
      .in('id', idsNeedingChunks);

    if (fetchError) {
      console.error('[chunk-transcripts] Error fetching transcripts:', fetchError);
      throw new Error('Failed to fetch transcripts');
    }

    // Get rep names
    const repIds = [...new Set((transcriptsToChunk || []).map(t => t.rep_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', repIds.length > 0 ? repIds : ['00000000-0000-0000-0000-000000000000']);

    const repMap = new Map((profiles || []).map(p => [p.id, p.name]));

    // Create chunks
    const allChunks: TranscriptChunk[] = [];
    for (const transcript of (transcriptsToChunk || [])) {
      const chunks = chunkText(transcript.raw_text || '');
      const repName = repMap.get(transcript.rep_id) || 'Unknown';

      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkTextContent = chunks[idx];

        allChunks.push({
          transcript_id: transcript.id,
          chunk_index: idx,
          chunk_text: chunkTextContent,
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

    console.log(`[chunk-transcripts] Generated ${allChunks.length} chunks from ${transcriptsToChunk?.length || 0} transcripts`);

    // Insert chunks (upsert to handle duplicates gracefully)
    let totalInserted = 0;
    const INSERT_BATCH_SIZE = 100;
    for (let i = 0; i < allChunks.length; i += INSERT_BATCH_SIZE) {
      const batch = allChunks.slice(i, i + INSERT_BATCH_SIZE);
      const { error: insertError } = await supabase
        .from('transcript_chunks')
        .upsert(batch, { 
          onConflict: 'transcript_id,chunk_index', 
          ignoreDuplicates: true 
        });

      if (insertError) {
        console.error('[chunk-transcripts] Error upserting chunks:', insertError);
      } else {
        totalInserted += batch.length;
      }
    }

    // ========== AUTO NER + EMBEDDINGS FOR NEW CHUNKS ==========
    // Process embeddings and NER for the newly created chunks
    let embeddingsGenerated = 0;
    let nerExtracted = 0;

    // Get the chunks we just inserted
    const { data: newChunks } = await supabase
      .from('transcript_chunks')
      .select('id, chunk_text, metadata')
      .in('transcript_id', idsNeedingChunks)
      .is('embedding', null);

    if (newChunks && newChunks.length > 0) {
      console.log(`[chunk-transcripts] Generating embeddings for ${newChunks.length} new chunks`);
      
      // Generate embeddings
      for (const chunk of newChunks) {
        try {
          const embedding = await generateEmbedding(chunk.chunk_text, openaiApiKey);
          await supabase
            .from('transcript_chunks')
            .update({ embedding })
            .eq('id', chunk.id);
          embeddingsGenerated++;
        } catch (error) {
          console.error(`[chunk-transcripts] Embedding failed for chunk ${chunk.id}:`, error);
        }
        // Small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 100));
      }
      
      console.log(`[chunk-transcripts] Generated ${embeddingsGenerated} embeddings`);
    }

    // Process NER extraction for new chunks
    const { data: chunksNeedingNER } = await supabase
      .from('transcript_chunks')
      .select('id, chunk_text, metadata')
      .in('transcript_id', idsNeedingChunks)
      .or('extraction_status.eq.pending,extraction_status.is.null');

    if (chunksNeedingNER && chunksNeedingNER.length > 0) {
      console.log(`[chunk-transcripts] Running NER extraction for ${chunksNeedingNER.length} chunks`);
      
      // Process in batches
      for (let i = 0; i < chunksNeedingNER.length; i += NER_CHUNKS_PER_API_CALL) {
        const batch = chunksNeedingNER.slice(i, i + NER_CHUNKS_PER_API_CALL);
        
        const firstMetadata = batch[0]?.metadata as { account_name?: string; rep_name?: string; call_type?: string } | undefined;
        const context = {
          accountName: firstMetadata?.account_name,
          repName: firstMetadata?.rep_name,
          callType: firstMetadata?.call_type
        };

        try {
          const batchInput = batch.map(chunk => ({
            id: chunk.id,
            text: chunk.chunk_text
          }));

          const nerResults = await extractEntitiesBatch(batchInput, context, lovableApiKey);

          for (const chunk of batch) {
            const nerResult = nerResults.get(chunk.id);
            if (nerResult) {
              await supabase
                .from('transcript_chunks')
                .update({
                  entities: nerResult.entities,
                  topics: nerResult.topics,
                  meddpicc_elements: nerResult.meddpicc_elements,
                  extraction_status: 'completed'
                })
                .eq('id', chunk.id);
              nerExtracted++;
            }
          }
        } catch (error) {
          console.error(`[chunk-transcripts] NER batch failed:`, error);
          // Mark as failed so they can be retried later
          for (const chunk of batch) {
            await supabase
              .from('transcript_chunks')
              .update({ extraction_status: 'failed' })
              .eq('id', chunk.id);
          }
        }

        // Delay between batches
        if (i + NER_CHUNKS_PER_API_CALL < chunksNeedingNER.length) {
          await new Promise(r => setTimeout(r, NER_BATCH_DELAY_MS));
        }
      }
      
      console.log(`[chunk-transcripts] NER extraction complete: ${nerExtracted} chunks`);
    }

    // Mark job as completed
    await updateJobStatus('completed');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Created ${totalInserted} chunks from ${transcriptsToChunk?.length || 0} transcripts`,
        chunked: (transcriptsToChunk?.length || 0) + chunkedIds.size,
        new_chunks: totalInserted,
        embeddings_generated: embeddingsGenerated,
        ner_extracted: nerExtracted,
        skipped: chunkedIds.size
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('Unhandled error:', error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId: correlationId }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('origin')), 'Content-Type': 'application/json' } }
    );
  }
});
