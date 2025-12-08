/**
 * analyze-call Edge Function - Analysis 2.0 Pipeline (P1 Optimized)
 * 
 * Uses the Agent Registry pattern for clean, maintainable agent orchestration.
 * 
 * P1 Optimizations (2024-12):
 * - Per-agent timeouts (15s flash, 30s pro) with graceful degradation
 * - Skeptic runs async (non-blocking) to reduce critical path
 * - Simplified Negotiator/Spy prompts for faster inference
 * - Request deduplication via row-level locking
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { getCorsHeaders, checkRateLimit } from './lib/cors.ts';
import { runAnalysisPipeline, SpeakerContext } from '../_shared/pipeline.ts';

// Minimum transcript length for meaningful analysis
const MIN_TRANSCRIPT_LENGTH = 500;

/**
 * Trigger background chunking for RAG indexing
 */
async function triggerBackgroundChunking(callId: string, supabaseUrl: string, serviceKey: string): Promise<void> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/chunk-transcripts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ transcript_ids: [callId] }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[analyze-call] Background chunking failed for ${callId}:`, response.status, errorText);
    } else {
      console.log(`[analyze-call] Background chunking triggered for ${callId}`);
    }
  } catch (err) {
    console.warn(`[analyze-call] Failed to trigger background chunking for ${callId}:`, err);
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  const token = authHeader.replace('Bearer ', '');
  const isInternalCall = token === supabaseServiceKey;
  
  let userId: string;
  
  if (isInternalCall) {
    userId = 'system-internal';
    console.log('[analyze-call] Internal service call detected, bypassing user auth');
  } else {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    userId = user.id;

    const rateLimitResult = checkRateLimit(userId);
    if (!rateLimitResult.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimitResult.retryAfter || 60) } }
      );
    }
  }

  let targetCallId: string | null = null;

  try {
    // Recover stuck transcripts
    try {
      const { data: recovered } = await supabaseAdmin.rpc('recover_stuck_processing_transcripts');
      if (recovered?.length > 0) {
        console.log(`[analyze-call] Recovered ${recovered.length} stuck transcript(s)`);
      }
    } catch (e) { /* non-critical */ }

    const body = await req.json();
    targetCallId = body.call_id;

    if (!targetCallId || typeof targetCallId !== 'string' || !UUID_REGEX.test(targetCallId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Starting Analysis 2.0 for call_id: ${targetCallId}, user: ${userId}`);

    // Fetch transcript with speaker context
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('call_transcripts')
      .select('id, raw_text, rep_id, account_name, primary_stakeholder_name, manager_id, additional_speakers, analysis_status')
      .eq('id', targetCallId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError || !transcript) {
      return new Response(
        JSON.stringify({ error: fetchError ? 'Failed to fetch transcript' : 'Transcript not found' }),
        { status: fetchError ? 500 : 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript.raw_text || transcript.raw_text.trim().length < MIN_TRANSCRIPT_LENGTH) {
      return new Response(
        JSON.stringify({ error: `Transcript too short. Minimum ${MIN_TRANSCRIPT_LENGTH} characters required.` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch rep name for speaker context
    const { data: repProfile } = await supabaseAdmin
      .from('profiles')
      .select('name')
      .eq('id', transcript.rep_id)
      .maybeSingle();

    // Build speaker context for Speaker Labeler (allow partial context with rep name only)
    const speakerContext: SpeakerContext | undefined = repProfile?.name ? {
      repName: repProfile.name,
      stakeholderName: transcript.primary_stakeholder_name || 'Unknown',
      accountName: transcript.account_name || 'Unknown Company',
      managerOnCall: !!transcript.manager_id,
      additionalSpeakers: transcript.additional_speakers || [],
    } : undefined;

    if (speakerContext) {
      console.log(`[analyze-call] Speaker context: REP=${speakerContext.repName}, PROSPECT=${speakerContext.stakeholderName}, Manager=${speakerContext.managerOnCall}, Others=${speakerContext.additionalSpeakers.length}`);
    } else {
      console.log(`[analyze-call] No speaker context available (missing rep profile name)`);
    }

    const { force_reanalyze } = body;
    
    // Request deduplication: Atomically check and set processing status
    // This prevents race conditions where multiple requests try to analyze the same call
    if (!force_reanalyze) {
      const { data: lockResult, error: lockError } = await supabaseAdmin
        .from('call_transcripts')
        .update({ analysis_status: 'processing', analysis_error: null, updated_at: new Date().toISOString() })
        .eq('id', targetCallId)
        .neq('analysis_status', 'processing')
        .select('id')
        .maybeSingle();
      
      if (lockError) {
        console.error('[analyze-call] Lock acquisition failed:', lockError);
        return new Response(
          JSON.stringify({ error: 'Failed to acquire analysis lock' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (!lockResult) {
        // Another request is already processing this call
        console.log(`[analyze-call] Deduplication: ${targetCallId} already being processed`);
        return new Response(
          JSON.stringify({ error: 'Analysis already in progress', call_id: targetCallId }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      // Force reanalyze: just update status directly
      await supabaseAdmin.from('call_transcripts').update({ analysis_status: 'processing', analysis_error: null }).eq('id', targetCallId);
    }

    // Run the pipeline with speaker context (uses Agent Registry pattern)
    const result = await runAnalysisPipeline(transcript.raw_text, supabaseAdmin, targetCallId, speakerContext);

    // Save results
    const { data: existingAnalysis } = await supabaseAdmin.from('ai_call_analysis').select('id').eq('call_id', targetCallId).maybeSingle();

    const analysisData = {
      analysis_metadata: result.metadata,
      analysis_behavior: result.behavior,
      analysis_strategy: result.strategy,
      analysis_psychology: result.psychology,
      analysis_coaching: result.coaching,
      analysis_pipeline_version: 'v2-registry',
      call_summary: result.metadata.summary,
      raw_json: result.warnings.length > 0 ? { analysis_warnings: result.warnings } : null,
    };

    if (existingAnalysis) {
      await supabaseAdmin.from('ai_call_analysis').update(analysisData).eq('id', existingAnalysis.id);
    } else {
      await supabaseAdmin.from('ai_call_analysis').insert({
        call_id: targetCallId,
        rep_id: transcript.rep_id,
        model_name: 'google/gemini-2.5-flash,google/gemini-2.5-pro',
        ...analysisData,
      });
    }

    await supabaseAdmin.from('call_transcripts').update({ analysis_status: 'completed', analysis_version: 'v2' }).eq('id', targetCallId);

    console.log(`[analyze-call] Analysis complete for ${targetCallId}, Grade: ${result.coaching.overall_grade}`);

    // @ts-ignore - EdgeRuntime available in Supabase
    EdgeRuntime.waitUntil(triggerBackgroundChunking(targetCallId, supabaseUrl, supabaseServiceKey));

    return new Response(
      JSON.stringify({
        success: true,
        call_id: targetCallId,
        analysis_version: 'v2-registry',
        metadata: result.metadata,
        behavior: result.behavior,
        strategy: result.strategy,
        psychology: result.psychology,
        coaching: result.coaching,
        processing_time_ms: Math.round(result.totalDurationMs),
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-call] Error:', errorMessage);

    if (targetCallId && UUID_REGEX.test(targetCallId)) {
      await supabaseAdmin.from('call_transcripts').update({ analysis_status: 'error', analysis_error: errorMessage }).eq('id', targetCallId);
    }

    const isRateLimit = errorMessage.includes('Rate limit');
    const isCredits = errorMessage.includes('credits');
    const isTimeout = errorMessage.includes('timeout');

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: isRateLimit ? 429 : isCredits ? 402 : isTimeout ? 504 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
