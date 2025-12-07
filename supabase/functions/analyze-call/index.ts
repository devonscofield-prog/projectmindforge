// Main handler for analyze-call edge function
// Modularized in Phase 3, enhanced logging in Phase 4

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { checkRateLimit, getCorsHeaders } from './lib/cors.ts';
import { generateRealAnalysis } from './lib/ai-gateway.ts';
import { updateProspectWithIntel, processStakeholdersBatched, triggerBackgroundTasks } from './lib/database-ops.ts';
import { Logger } from './lib/logger.ts';
import type { TranscriptRow, ProspectData } from './lib/types.ts';

// Declare EdgeRuntime for Supabase Edge Functions
declare const EdgeRuntime: {
  waitUntil: (promise: Promise<unknown>) => void;
};

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize structured logger with correlation ID
  const logger = new Logger();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get the JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.error('Missing or invalid Authorization header');
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create user client bound to request (respects RLS)
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  // Create service role client for bypassing RLS when writing
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  // Verify user and check rate limit
  logger.startPhase('auth');
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    logger.error('Invalid authentication', { error: authError?.message });
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check rate limit
  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    logger.warn('Rate limit exceeded', { userId: user.id, retryAfter: rateLimit.retryAfter });
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimit.retryAfter || 60)
        } 
      }
    );
  }
  logger.endPhase();

  let callId: string | null = null;

  try {
    // Parse and validate input
    logger.startPhase('validation');
    const body = await req.json();
    const { call_id } = body;

    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      logger.warn('Invalid call_id provided', { call_id });
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    callId = call_id;
    logger.setCallId(callId);
    logger.endPhase();

    // Step 1: Read transcript WITH prospect in single query (exclude soft-deleted)
    logger.startPhase('fetch_transcript');
    const { data: transcriptWithProspect, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select(`
        id, rep_id, raw_text, call_date, source, prospect_id, analysis_status,
        prospect:prospects(
          id, industry, opportunity_details, ai_extracted_info, heat_score, suggested_follow_ups
        )
      `)
      .eq('id', callId)
      .is('deleted_at', null)
      .maybeSingle();

    if (fetchError) {
      logger.error('Error fetching transcript', { error: fetchError.message });
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcriptWithProspect) {
      logger.warn('Transcript not found or access denied');
      return new Response(
        JSON.stringify({ error: 'Call transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Idempotency check: prevent duplicate analysis
    const currentStatus = transcriptWithProspect.analysis_status;
    if (currentStatus === 'processing') {
      logger.warn('Transcript already being processed', { callId, status: currentStatus });
      return new Response(
        JSON.stringify({ error: 'Analysis already in progress for this transcript', status: currentStatus }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (currentStatus === 'completed') {
      // Check if analysis already exists
      const { data: existingAnalysis } = await supabaseUser
        .from('ai_call_analysis')
        .select('id')
        .eq('call_id', callId)
        .is('deleted_at', null)
        .maybeSingle();
      
      if (existingAnalysis) {
        logger.info('Transcript already analyzed', { callId, analysisId: existingAnalysis.id });
        return new Response(
          JSON.stringify({ 
            success: true, 
            analysis_id: existingAnalysis.id, 
            message: 'Analysis already exists',
            already_analyzed: true 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Cache IDs upfront
    const repId = transcriptWithProspect.rep_id;
    const prospectId = transcriptWithProspect.prospect_id;
    const prospectData = transcriptWithProspect.prospect;
    const currentProspect = (Array.isArray(prospectData) ? prospectData[0] : prospectData) as ProspectData | null;

    logger.setRepId(repId);
    logger.info('Transcript fetched', { 
      repId, 
      prospectId: prospectId || 'none',
      transcriptLength: transcriptWithProspect.raw_text.length
    });

    const transcript: TranscriptRow = {
      id: transcriptWithProspect.id,
      rep_id: repId,
      raw_text: transcriptWithProspect.raw_text,
      call_date: transcriptWithProspect.call_date,
      source: transcriptWithProspect.source
    };
    logger.endPhase();

    // Step 2: Update analysis_status to 'processing'
    logger.startPhase('set_processing');
    await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);
    logger.endPhase();

    // Step 3: Generate analysis using AI
    logger.startPhase('ai_analysis');
    const analysis = await generateRealAnalysis(transcript, logger);
    analysis.prompt_version = 'v2-real-2025-11-27';
    logger.info('AI analysis completed', {
      callNotesLength: analysis.call_notes.length,
      stakeholdersCount: analysis.stakeholders_intel?.length || 0,
      heatScore: analysis.coach_output?.heat_signature?.score
    });
    logger.endPhase();

    // Step 4: Insert into ai_call_analysis
    logger.startPhase('save_analysis');
    const { stakeholders_intel, ...analysisForDb } = analysis;
    
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert(analysisForDb)
      .select('id')
      .single();

    if (insertError) {
      logger.error('Error inserting analysis', { error: insertError.message });
      await supabaseAdmin
        .from('call_transcripts')
        .update({
          analysis_status: 'error',
          analysis_error: `Analysis failed: ${insertError.message}`
        })
        .eq('id', callId);

      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisId = analysisResult.id;
    logger.info('Analysis saved', { analysisId });
    logger.endPhase();

    // Step 5: Update status to 'completed'
    logger.startPhase('set_completed');
    await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);
    logger.endPhase();

    // Step 6: Update prospect with AI intel (consolidated)
    if (prospectId && currentProspect && (analysis.prospect_intel || analysis.coach_output)) {
      logger.startPhase('update_prospect');
      try {
        await updateProspectWithIntel(supabaseAdmin, prospectId, currentProspect, analysis, callId, logger);
      } catch (prospectErr) {
        logger.error('Failed to update prospect', { error: String(prospectErr) });
      }
      logger.endPhase();
    }

    // Step 7: Process stakeholders (batched)
    if (prospectId && stakeholders_intel && stakeholders_intel.length > 0) {
      logger.startPhase('process_stakeholders');
      try {
        await processStakeholdersBatched(supabaseAdmin, prospectId, repId, callId, stakeholders_intel, logger);
      } catch (stakeholderErr) {
        logger.error('Failed to process stakeholders', { error: String(stakeholderErr) });
      }
      logger.endPhase();
    }

    // Step 8: Trigger background tasks with job tracking
    logger.startPhase('trigger_background');
    await triggerBackgroundTasks(
      supabaseAdmin,
      supabaseUrl,
      supabaseServiceKey,
      prospectId,
      callId,
      user.id,
      EdgeRuntime.waitUntil,
      logger
    );
    logger.endPhase();

    // Log final summary
    logger.logSummary(true, analysisId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis_id: analysisId,
        message: 'Analysis completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logger.error('Unexpected error', { error: error instanceof Error ? error.message : String(error) });
    
    if (callId) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({ 
            analysis_status: 'error',
            analysis_error: error instanceof Error ? error.message : 'Unexpected error during analysis'
          })
          .eq('id', callId);
      } catch (updateError) {
        logger.error('Failed to update error status', { error: String(updateError) });
      }
    }

    logger.logSummary(false);

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
