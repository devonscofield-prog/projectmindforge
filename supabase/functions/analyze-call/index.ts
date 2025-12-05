// Main handler for analyze-call edge function
// Modularized in Phase 3 optimization

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { checkRateLimit, getCorsHeaders } from './lib/cors.ts';
import { generateRealAnalysis } from './lib/ai-gateway.ts';
import { updateProspectWithIntel, processStakeholdersBatched, triggerBackgroundTasks } from './lib/database-ops.ts';
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // Get the JWT from Authorization header
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('[analyze-call] Missing or invalid Authorization header');
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
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Check rate limit
  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    console.log(`[analyze-call] Rate limit exceeded for user: ${user.id}`);
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

  let callId: string | null = null;

  try {
    // Parse and validate input
    const body = await req.json();
    const { call_id } = body;

    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      console.warn('[analyze-call] Invalid call_id provided:', call_id);
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    callId = call_id;
    console.log(`[analyze-call] Starting analysis for call_id: ${callId}`);

    // Step 1: Read transcript WITH prospect in single query (validates access via RLS)
    const { data: transcriptWithProspect, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select(`
        id, rep_id, raw_text, call_date, source, prospect_id,
        prospect:prospects(
          id, industry, opportunity_details, ai_extracted_info, heat_score, suggested_follow_ups
        )
      `)
      .eq('id', callId)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Error fetching transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcriptWithProspect) {
      console.warn(`[analyze-call] Transcript not found or access denied for call_id: ${callId}`);
      return new Response(
        JSON.stringify({ error: 'Call transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cache IDs upfront
    const repId = transcriptWithProspect.rep_id;
    const prospectId = transcriptWithProspect.prospect_id;
    const prospectData = transcriptWithProspect.prospect;
    const currentProspect = (Array.isArray(prospectData) ? prospectData[0] : prospectData) as ProspectData | null;

    const transcript: TranscriptRow = {
      id: transcriptWithProspect.id,
      rep_id: repId,
      raw_text: transcriptWithProspect.raw_text,
      call_date: transcriptWithProspect.call_date,
      source: transcriptWithProspect.source
    };

    console.log(`[analyze-call] Transcript found for rep_id: ${repId}, prospect_id: ${prospectId || 'none'}`);

    // Step 2: Update analysis_status to 'processing'
    await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    // Step 3: Generate analysis using AI
    console.log('[analyze-call] Using real AI analysis');
    const analysis = await generateRealAnalysis(transcript);
    analysis.prompt_version = 'v2-real-2025-11-27';
    console.log('[analyze-call] Analysis generated');

    // Step 4: Insert into ai_call_analysis
    const { stakeholders_intel, ...analysisForDb } = analysis;
    
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert(analysisForDb)
      .select('id')
      .single();

    if (insertError) {
      console.error('[analyze-call] Error inserting analysis:', insertError);
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
    console.log(`[analyze-call] Analysis inserted with id: ${analysisId}`);

    // Step 5: Update status to 'completed'
    await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);

    // Step 6: Update prospect with AI intel (consolidated)
    if (prospectId && currentProspect && (analysis.prospect_intel || analysis.coach_output)) {
      try {
        await updateProspectWithIntel(supabaseAdmin, prospectId, currentProspect, analysis, callId);
      } catch (prospectErr) {
        console.error('[analyze-call] Failed to update prospect with AI intel:', prospectErr);
      }
    }

    // Step 7: Process stakeholders (batched)
    if (prospectId && stakeholders_intel && stakeholders_intel.length > 0) {
      try {
        await processStakeholdersBatched(supabaseAdmin, prospectId, repId, callId, stakeholders_intel);
      } catch (stakeholderErr) {
        console.error('[analyze-call] Failed to process stakeholders:', stakeholderErr);
      }
    }

    console.log(`[analyze-call] Analysis completed successfully for call_id: ${callId}`);

    // Step 8: Trigger background tasks
    triggerBackgroundTasks(supabaseUrl, supabaseServiceKey, prospectId, callId, EdgeRuntime.waitUntil);

    return new Response(
      JSON.stringify({ 
        success: true, 
        analysis_id: analysisId,
        message: 'Analysis completed successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-call] Unexpected error:', error);
    
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
        console.error('[analyze-call] Failed to update error status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
