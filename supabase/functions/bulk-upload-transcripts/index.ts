import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// ============= CORS Utilities =============
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'http://localhost:8080',
    'http://localhost:8081',
    'http://localhost:5173',
    'https://lovable.dev',
    'https://lovableproject.com',
  ];

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
  callDate: string;
  callType: string;
  callTypeOther?: string;
  accountName: string;
  stakeholderName: string;
  salesforceLink?: string;
}

interface BulkUploadRequest {
  transcripts: TranscriptInput[];
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
    insertFailed: number;
  };
  results: Array<{
    fileName: string;
    transcriptId?: string;
    status: 'success' | 'insert_failed' | 'analysis_queued' | 'analysis_failed';
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

// ============= Helper: Get or Create Prospect =============
async function getOrCreateProspect(
  supabase: SupabaseClient,
  repId: string,
  accountName: string,
  stakeholderName: string,
  salesforceLink?: string
): Promise<{ prospectId: string | null; error?: string }> {
  try {
    // Try to find existing prospect by account name for this rep
    const { data: existingProspect } = await supabase
      .from('prospects')
      .select('id')
      .eq('rep_id', repId)
      .eq('account_name', accountName)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingProspect) {
      return { prospectId: existingProspect.id };
    }

    // Create new prospect
    const { data: newProspect, error: createError } = await supabase
      .from('prospects')
      .insert({
        rep_id: repId,
        prospect_name: stakeholderName,
        account_name: accountName,
        salesforce_link: salesforceLink || null,
        status: 'active',
        heat_score: 5, // Default middle score
      })
      .select('id')
      .single();

    if (createError) {
      console.error('[bulk-upload] Failed to create prospect:', createError);
      return { prospectId: null, error: createError.message };
    }

    return { prospectId: newProspect.id };
  } catch (error) {
    console.error('[bulk-upload] Error in getOrCreateProspect:', error);
    return { prospectId: null, error: 'Failed to get or create prospect' };
  }
}

// ============= Helper: Insert Transcript =============
async function insertTranscript(
  supabase: SupabaseClient,
  transcript: TranscriptInput,
  prospectId: string | null
): Promise<{ transcriptId: string | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('call_transcripts')
      .insert({
        rep_id: transcript.repId,
        prospect_id: prospectId,
        raw_text: transcript.rawText,
        call_date: transcript.callDate,
        call_type: transcript.callType,
        call_type_other: transcript.callTypeOther || null,
        primary_stakeholder_name: transcript.stakeholderName,
        account_name: transcript.accountName,
        salesforce_demo_link: transcript.salesforceLink || null,
        source: 'other', // Using 'other' for bulk uploads
        analysis_status: 'pending',
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

// ============= Validation =============
function validateRequest(body: unknown): { valid: true; data: BulkUploadRequest } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const request = body as BulkUploadRequest;
  
  if (!Array.isArray(request.transcripts)) {
    return { valid: false, error: 'transcripts must be an array' };
  }

  if (request.transcripts.length === 0) {
    return { valid: false, error: 'transcripts array cannot be empty' };
  }

  if (request.transcripts.length > MAX_TRANSCRIPTS) {
    return { valid: false, error: `Maximum ${MAX_TRANSCRIPTS} transcripts per upload` };
  }

  // Validate each transcript
  for (let i = 0; i < request.transcripts.length; i++) {
    const t = request.transcripts[i];
    if (!t.fileName) return { valid: false, error: `Transcript ${i + 1}: fileName is required` };
    if (!t.rawText) return { valid: false, error: `Transcript ${i + 1}: rawText is required` };
    if (!t.repId) return { valid: false, error: `Transcript ${i + 1}: repId is required` };
    if (!t.callDate) return { valid: false, error: `Transcript ${i + 1}: callDate is required` };
    if (!t.callType) return { valid: false, error: `Transcript ${i + 1}: callType is required` };
    if (!t.accountName) return { valid: false, error: `Transcript ${i + 1}: accountName is required` };
    if (!t.stakeholderName) return { valid: false, error: `Transcript ${i + 1}: stakeholderName is required` };
  }

  return { valid: true, data: request };
}

// ============= Main Handler =============
serve(async (req) => {
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

    const validation = validateRequest(body);
    if (!validation.valid) {
      return errorResponse(validation.error, 400, corsHeaders);
    }

    const { transcripts } = validation.data;
    console.log(`[bulk-upload] Processing ${transcripts.length} transcripts`);

    // ============= Phase 1: Insert All Transcripts =============
    const insertedTranscripts: InsertedTranscript[] = [];
    const insertResults: BulkUploadResponse['results'] = [];

    for (const transcript of transcripts) {
      // Get or create prospect
      const { prospectId, error: prospectError } = await getOrCreateProspect(
        supabase,
        transcript.repId,
        transcript.accountName,
        transcript.stakeholderName,
        transcript.salesforceLink
      );

      if (prospectError) {
        console.error(`[bulk-upload] Prospect creation failed for ${transcript.fileName}: ${prospectError}`);
      }

      // Insert transcript
      const { transcriptId, error: insertError } = await insertTranscript(
        supabase,
        transcript,
        prospectId
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
        insertResults.push({
          fileName: transcript.fileName,
          transcriptId,
          status: 'analysis_queued', // Will be updated if analysis fails
        });
      }
    }

    console.log(`[bulk-upload] Inserted ${insertedTranscripts.length}/${transcripts.length} transcripts`);

    // ============= Phase 2: Queue Analysis with Adaptive Rate Limiting =============
    let analysisQueued = 0;
    let analysisFailed = 0;

    if (insertedTranscripts.length > 0) {
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
    }

    // ============= Build Response =============
    const response: BulkUploadResponse = {
      success: insertedTranscripts.length > 0,
      summary: {
        total: transcripts.length,
        inserted: insertedTranscripts.length,
        analysisQueued,
        analysisFailed,
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
