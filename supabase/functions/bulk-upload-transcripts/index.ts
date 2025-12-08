import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ============= CORS Utilities =============
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173',
    'https://lovable.dev',
    'https://lovableproject.com',
  ];

  // Allow custom domain from environment variable
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }

  const isAllowed = origin && (
    allowedOrigins.includes(origin) ||
    origin.endsWith('.lovable.dev') ||
    origin.endsWith('.lovableproject.com')
  );

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://lovable.dev',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

function errorResponse(message: string, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: message }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function jsonResponse(data: unknown, corsHeaders: Record<string, string>, status: number = 200): Response {
  return new Response(
    JSON.stringify(data),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============= Security Utilities =============
const MAX_TRANSCRIPT_LENGTH = 500_000; // 500KB per transcript
const MIN_TRANSCRIPT_LENGTH = 100;

function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return '';
  // Remove null bytes and script tags
  return input
    .replace(/\0/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[REMOVED]')
    .replace(/\bon\w+\s*=/gi, '[REMOVED]=')
    .trim();
}

// ============= Zod Validation Schemas =============
const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Date must be in YYYY-MM-DD format" });

const transcriptItemSchema = z.object({
  fileName: z.string().min(1, "File name required").max(255, "File name too long"),
  rawText: z.string()
    .min(MIN_TRANSCRIPT_LENGTH, `Transcript too short (min ${MIN_TRANSCRIPT_LENGTH} chars)`)
    .max(MAX_TRANSCRIPT_LENGTH, `Transcript too long (max ${MAX_TRANSCRIPT_LENGTH} chars)`)
    .transform(sanitizeUserInput),
  repId: uuidSchema,
  callDate: dateStringSchema.optional(),
  callType: z.string().max(50).optional(),
  callTypeOther: z.string().max(100).transform(sanitizeUserInput).optional(),
  accountName: z.string().max(200).transform(sanitizeUserInput).optional(),
  stakeholderName: z.string().max(200).transform(sanitizeUserInput).optional(),
  salesforceLink: z.string().url("Invalid Salesforce URL").max(500).optional().or(z.literal(''))
});

const bulkUploadSchema = z.object({
  transcripts: z.array(transcriptItemSchema)
    .min(1, "At least one transcript required")
    .max(100, "Maximum 100 transcripts per upload"),
  processingMode: z.enum(['analyze', 'index_only']).optional().default('analyze')
});

// ============= Constants =============
const BASE_DELAY_MS = 500;       // Starting delay (higher for analyze-call)
const MAX_DELAY_MS = 10000;      // 10 seconds max backoff
const MAX_RETRIES = 3;           // Retries per item
const ANALYSIS_BATCH_SIZE = 3;   // Calls to analyze-call per batch
const MAX_TRANSCRIPTS = 100;     // Max transcripts per upload

// ============= Type Definitions =============
interface TranscriptInput {
  fileName: string;
  rawText: string;
  repId: string;
  callDate?: string;
  callType?: string;
  callTypeOther?: string;
  accountName?: string;
  stakeholderName?: string;
  salesforceLink?: string;
}

interface BulkUploadRequest {
  transcripts: TranscriptInput[];
  processingMode?: 'analyze' | 'index_only';
}

interface InsertedTranscript {
  id: string;
  fileName: string;
  prospectId: string | null;
}

interface ProcessResult {
  success: boolean;
  result?: unknown;
  error?: string;
  fileName?: string;
}

interface BulkUploadResponse {
  success: boolean;
  summary: {
    total: number;
    inserted: number;
    analysisQueued: number;
    analysisFailed: number;
    indexingQueued: number;
    indexingFailed: number;
    insertFailed: number;
  };
  results: Array<{
    fileName: string;
    transcriptId?: string;
    status: 'success' | 'insert_failed' | 'analysis_queued' | 'analysis_failed' | 'indexing_queued' | 'indexing_failed';
    error?: string;
  }>;
}

// ============= Adaptive Rate Limiting Utility =============
// Handles rate limiting and retries for downstream functions (like analyze-call)
async function processWithAdaptiveRateLimit<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  batchSize: number = ANALYSIS_BATCH_SIZE,
  getItemName?: (item: T) => string
): Promise<Array<{ success: boolean; result?: R; error?: string; item: T }>> {
  const results: Array<{ success: boolean; result?: R; error?: string; item: T }> = [];
  let currentDelay = BASE_DELAY_MS;

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(items.length / batchSize);
    
    console.log(`[bulk-upload] Processing batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    for (const item of batch) {
      let retries = 0;
      let success = false;
      const itemName = getItemName ? getItemName(item) : 'item';

      while (retries < MAX_RETRIES && !success) {
        try {
          const result = await processor(item);
          results.push({ success: true, result, item });
          success = true;
          // Decay delay on success
          currentDelay = Math.max(BASE_DELAY_MS, currentDelay * 0.9);
        } catch (error: unknown) {
          const err = error as { status?: number; message?: string };
          const isRateLimited = err.status === 429 || 
            (err.message && err.message.includes('429')) ||
            (err.message && err.message.toLowerCase().includes('rate limit'));
          
          if (isRateLimited) {
            retries++;
            // Exponential backoff on rate limit
            currentDelay = Math.min(MAX_DELAY_MS, currentDelay * 2);
            console.log(`[bulk-upload] Rate limited for ${itemName}, waiting ${currentDelay}ms (retry ${retries}/${MAX_RETRIES})`);
            await new Promise(r => setTimeout(r, currentDelay));
          } else {
            console.error(`[bulk-upload] Processing failed for ${itemName}:`, error);
            results.push({ success: false, error: err.message || 'Unknown error', item });
            break;
          }
        }
      }

      if (!success && retries >= MAX_RETRIES) {
        console.error(`[bulk-upload] Max retries exceeded for ${itemName}`);
        results.push({ success: false, error: 'Max retries exceeded due to rate limiting', item });
      }
    }

    // Delay between batches to respect rate limits
    if (i + batchSize < items.length) {
      console.log(`[bulk-upload] Waiting ${currentDelay}ms before next batch`);
      await new Promise(r => setTimeout(r, currentDelay));
    }
  }

  return results;
}

// ============= Helper: Insert Transcript =============
// NOTE: Bulk uploads NEVER create accounts - transcripts are stored with metadata only
// Account linkage must be done through individual call submission if needed
async function insertTranscript(
  supabase: SupabaseClient,
  transcript: TranscriptInput,
  prospectId: string | null,
  processingMode: 'analyze' | 'index_only' = 'analyze'
): Promise<{ transcriptId: string | null; error?: string }> {
  try {
    // Use defaults for optional fields
    const today = new Date().toISOString().split('T')[0];
    
    // Set analysis_status based on processing mode
    // 'skipped' means no AI analysis will run, just indexing
    const analysisStatus = processingMode === 'index_only' ? 'skipped' : 'pending';
    
    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({
        rep_id: transcript.repId,
        prospect_id: prospectId,
        raw_text: transcript.rawText,
        call_date: transcript.callDate || today,
        call_type: transcript.callType || 'first_demo',
        call_type_other: transcript.callTypeOther || null,
        primary_stakeholder_name: transcript.stakeholderName || null,
        account_name: transcript.accountName || null,
        salesforce_demo_link: transcript.salesforceLink || null,
        source: 'bulk_upload',
        analysis_status: analysisStatus,
        notes: `Bulk uploaded from file: ${transcript.fileName}`, // Track original filename
      })
      .select('id')
      .single();

    if (error) {
      console.error('[bulk-upload] Failed to insert transcript:', error);
      return { transcriptId: null, error: error.message };
    }

    return { transcriptId: data.id };
  } catch (error) {
    console.error('[bulk-upload] Error inserting transcript:', error);
    return { transcriptId: null, error: 'Failed to insert transcript' };
  }
}

// ============= Helper: Queue Analysis =============
async function queueAnalysis(
  supabase: SupabaseClient,
  transcriptId: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('analyze-call', {
      body: { call_id: transcriptId }
    });

    if (error) {
      throw error;
    }

    console.log(`[bulk-upload] Analysis queued for ${fileName} (${transcriptId})`);
    return { success: true };
  } catch (error: unknown) {
    const err = error as { message?: string };
    console.error(`[bulk-upload] Failed to queue analysis for ${fileName}:`, error);
    return { success: false, error: err.message || 'Analysis queue failed' };
  }
}

// ============= Helper: Queue Batch Indexing (fire-and-forget with HMAC) =============
// Uses fetch directly to avoid awaiting the response - indexing happens in background
async function queueBatchIndexingAsync(transcriptIds: string[]): Promise<void> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const body = JSON.stringify({ transcript_ids: transcriptIds });
  
  // Generate HMAC signature for service-to-service authentication
  const timestamp = Date.now().toString();
  const nonce = crypto.randomUUID();
  const signaturePayload = `${timestamp}.${nonce}.${body}`;
  const secret = serviceKey.substring(0, 32);
  
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
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  // Fire and forget - don't await the response
  fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      'X-Request-Signature': signature,
      'X-Request-Timestamp': timestamp,
      'X-Request-Nonce': nonce,
    },
    body
  }).then(response => {
    if (!response.ok) {
      console.error(`[bulk-upload] Background indexing request returned status ${response.status}`);
    } else {
      console.log(`[bulk-upload] Background indexing request acknowledged`);
    }
  }).catch(err => {
    console.error('[bulk-upload] Background indexing request failed:', err);
  });
  
  console.log(`[bulk-upload] Background indexing triggered for ${transcriptIds.length} transcripts`);
}

// ============= Helper: Validate RepId Exists =============
async function validateRepIds(
  supabase: SupabaseClient,
  repIds: string[]
): Promise<{ valid: boolean; invalidIds: string[] }> {
  const uniqueIds = [...new Set(repIds)];
  
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id')
    .in('id', uniqueIds)
    .eq('is_active', true);
  
  const validIds = new Set(profiles?.map(p => p.id) || []);
  const invalidIds = uniqueIds.filter(id => !validIds.has(id));
  
  return { valid: invalidIds.length === 0, invalidIds };
}

// ============= Validation using Zod =============
function validateRequestWithZod(body: unknown): 
  { valid: true; data: z.infer<typeof bulkUploadSchema> } | 
  { valid: false; error: string; issues?: Array<{ path: string; message: string }> } {
  
  const result = bulkUploadSchema.safeParse(body);
  
  if (result.success) {
    return { valid: true, data: result.data };
  }
  
  const issues = result.error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message
  }));
  
  return { 
    valid: false, 
    error: `Validation failed: ${issues[0]?.message || 'Invalid request'}`,
    issues 
  };
}

// ============= Main Handler =============
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405, corsHeaders);
  }

  console.log('[bulk-upload] Starting bulk upload request');

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // ============= Authentication =============
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Authorization header required', 401, corsHeaders);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('[bulk-upload] Authentication failed:', authError);
      return errorResponse('User not authenticated', 401, corsHeaders);
    }

    // ============= Admin Role Verification =============
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'admin') {
      console.warn(`[bulk-upload] Non-admin access attempt by user ${user.id}`);
      return errorResponse('Admin access required', 403, corsHeaders);
    }

    console.log(`[bulk-upload] Admin verified: ${user.email}`);

    // ============= Parse and Validate Request =============
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid JSON in request body', 400, corsHeaders);
    }

    const validation = validateRequestWithZod(body);
    if (!validation.valid) {
      console.warn('[bulk-upload] Validation failed:', validation.issues);
      return errorResponse(validation.error, 400, corsHeaders);
    }

    const { transcripts, processingMode } = validation.data;
    console.log(`[bulk-upload] Processing ${transcripts.length} transcripts in ${processingMode} mode`);

    // ============= Validate RepIds Exist =============
    const repIds = transcripts.map((t: TranscriptInput) => t.repId);
    const { valid: repIdsValid, invalidIds } = await validateRepIds(supabase, repIds);
    
    if (!repIdsValid) {
      console.error(`[bulk-upload] Invalid repIds found: ${invalidIds.join(', ')}`);
      return errorResponse(`Invalid or inactive rep IDs: ${invalidIds.join(', ')}`, 400, corsHeaders);
    }

    // ============= Phase 1: Insert All Transcripts =============
    const insertedTranscripts: InsertedTranscript[] = [];
    const insertResults: BulkUploadResponse['results'] = [];

    for (const transcript of transcripts) {
      // Bulk uploads NEVER create accounts - always set prospect_id to null
      // Account name and stakeholder name are stored as metadata only
      const prospectId: string | null = null;

      // Insert transcript with appropriate analysis_status based on processing mode
      const { transcriptId, error: insertError } = await insertTranscript(
        supabase,
        transcript,
        prospectId,
        processingMode
      );

      if (insertError || !transcriptId) {
        insertResults.push({
          fileName: transcript.fileName,
          status: 'insert_failed',
          error: insertError || 'Unknown insert error',
        });
      } else {
        insertedTranscripts.push({
          id: transcriptId,
          fileName: transcript.fileName,
          prospectId,
        });
        // Initial status depends on mode
        insertResults.push({
          fileName: transcript.fileName,
          transcriptId,
          status: processingMode === 'analyze' ? 'analysis_queued' : 'indexing_queued',
        });
      }
    }

    console.log(`[bulk-upload] Inserted ${insertedTranscripts.length}/${transcripts.length} transcripts`);

    // ============= Phase 2: Queue Processing Based on Mode =============
    let analysisQueued = 0;
    let analysisFailed = 0;
    let indexingQueued = 0;
    let indexingFailed = 0;

    if (insertedTranscripts.length > 0) {
      if (processingMode === 'analyze') {
        // Full analysis mode: call analyze-call (which also triggers chunking)
        console.log('[bulk-upload] Starting analysis queue with adaptive rate limiting');
        
        const analysisResults = await processWithAdaptiveRateLimit(
          insertedTranscripts,
          async (t) => queueAnalysis(supabase, t.id, t.fileName),
          ANALYSIS_BATCH_SIZE,
          (t) => t.fileName
        );

        // Update results based on analysis queue outcome
        for (const result of analysisResults) {
          const resultIndex = insertResults.findIndex(r => r.fileName === result.item.fileName);
          if (resultIndex !== -1) {
            if (result.success) {
              analysisQueued++;
              insertResults[resultIndex].status = 'success';
            } else {
              analysisFailed++;
              insertResults[resultIndex].status = 'analysis_failed';
              insertResults[resultIndex].error = result.error;
            }
          }
        }
      } else {
        // Index only mode: trigger batch indexing in background (fire-and-forget)
        console.log('[bulk-upload] Triggering background batch indexing');
        
        const transcriptIds = insertedTranscripts.map(t => t.id);
        
        // Fire and forget - don't wait for indexing to complete
        queueBatchIndexingAsync(transcriptIds);
        
        // Mark all as indexing_queued since we've triggered the batch
        indexingQueued = insertedTranscripts.length;
        for (const t of insertedTranscripts) {
          const resultIndex = insertResults.findIndex(r => r.fileName === t.fileName);
          if (resultIndex !== -1) {
            insertResults[resultIndex].status = 'success';
          }
        }
      }
    }

    // ============= Build Response =============
    const response: BulkUploadResponse = {
      success: insertedTranscripts.length > 0,
      summary: {
        total: transcripts.length,
        inserted: insertedTranscripts.length,
        analysisQueued,
        analysisFailed,
        indexingQueued,
        indexingFailed,
        insertFailed: transcripts.length - insertedTranscripts.length,
      },
      results: insertResults,
    };

    console.log('[bulk-upload] Bulk upload complete:', response.summary);

    return jsonResponse(response, corsHeaders);

  } catch (error) {
    console.error('[bulk-upload] Unexpected error:', error);
    const err = error as { message?: string };
    return errorResponse(`Internal server error: ${err.message || 'Unknown error'}`, 500, corsHeaders);
  }
});
