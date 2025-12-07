/**
 * analyze-call Edge Function - Analysis 2.0 Pipeline
 * 
 * Multi-agent analysis system:
 * - Agent 1: The Clerk (metadata extraction) - gemini-2.5-flash
 * - Agent 2: The Referee (behavioral scoring) - gemini-2.5-flash
 * - Agent 3: The Auditor (strategy audit) - gemini-2.5-pro
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { getCorsHeaders } from './lib/cors.ts';
import { 
  analyzeCallMetadata, 
  analyzeCallBehavior, 
  analyzeCallStrategy 
} from '../_shared/analysis-agents.ts';

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get the JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create service role client for bypassing RLS
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Parse and validate input
    const body = await req.json();
    const { call_id } = body;

    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Starting Analysis 2.0 for call_id: ${call_id}, user: ${user.id}`);

    // Fetch the transcript
    const { data: transcript, error: fetchError } = await supabaseAdmin
      .from('call_transcripts')
      .select('id, raw_text, rep_id, account_name, analysis_status')
      .eq('id', call_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Failed to fetch transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      return new Response(
        JSON.stringify({ error: 'Transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already being processed (idempotency)
    if (transcript.analysis_status === 'processing') {
      console.log('[analyze-call] Already processing, skipping');
      return new Response(
        JSON.stringify({ error: 'Analysis already in progress', call_id }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', call_id);

    const startTime = Date.now();

    // Run ALL THREE agents in PARALLEL
    console.log('[analyze-call] Running Clerk, Referee, and Auditor agents in parallel...');
    
    const [metadataResult, behaviorResult, strategyResult] = await Promise.all([
      analyzeCallMetadata(transcript.raw_text),
      analyzeCallBehavior(transcript.raw_text),
      analyzeCallStrategy(transcript.raw_text),
    ]);

    const analysisTime = Date.now() - startTime;
    console.log(`[analyze-call] All agents completed in ${analysisTime}ms`);
    console.log(`[analyze-call] Scores - Behavior: ${behaviorResult.overall_score}, Threading: ${strategyResult.strategic_threading.score}, Critical Gaps: ${strategyResult.critical_gaps.length}`);

    // Check if an analysis record already exists for this call
    const { data: existingAnalysis } = await supabaseAdmin
      .from('ai_call_analysis')
      .select('id')
      .eq('call_id', call_id)
      .maybeSingle();

    if (existingAnalysis) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('ai_call_analysis')
        .update({
          analysis_metadata: metadataResult,
          analysis_behavior: behaviorResult,
          analysis_strategy: strategyResult,
          analysis_pipeline_version: 'v2',
          // Keep legacy call_summary populated for backward compatibility
          call_summary: metadataResult.summary,
        })
        .eq('id', existingAnalysis.id);

      if (updateError) {
        console.error('[analyze-call] Failed to update analysis:', updateError);
        throw new Error('Failed to save analysis results');
      }
    } else {
      // Insert new record
      const { error: insertError } = await supabaseAdmin
        .from('ai_call_analysis')
        .insert({
          call_id: call_id,
          rep_id: transcript.rep_id,
          model_name: 'google/gemini-2.5-flash,google/gemini-2.5-pro',
          call_summary: metadataResult.summary,
          analysis_metadata: metadataResult,
          analysis_behavior: behaviorResult,
          analysis_strategy: strategyResult,
          analysis_pipeline_version: 'v2',
        });

      if (insertError) {
        console.error('[analyze-call] Failed to insert analysis:', insertError);
        throw new Error('Failed to save analysis results');
      }
    }

    // Update transcript status to completed
    await supabaseAdmin
      .from('call_transcripts')
      .update({ 
        analysis_status: 'completed',
        analysis_version: 'v2'
      })
      .eq('id', call_id);

    console.log(`[analyze-call] Analysis 2.0 complete for call_id: ${call_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        call_id: call_id,
        analysis_version: 'v2',
        metadata: metadataResult,
        behavior: behaviorResult,
        strategy: strategyResult,
        processing_time_ms: analysisTime,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-call] Error:', errorMessage);

    // Try to update transcript status to error
    try {
      const body = await req.clone().json();
      if (body.call_id && UUID_REGEX.test(body.call_id)) {
        await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error',
            analysis_error: errorMessage 
          })
          .eq('id', body.call_id);
      }
    } catch (e) {
      console.error('[analyze-call] Failed to update error status:', e);
    }

    // Return appropriate error response
    const isRateLimit = errorMessage.includes('Rate limit');
    const isCredits = errorMessage.includes('credits');

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: isRateLimit ? 429 : isCredits ? 402 : 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
