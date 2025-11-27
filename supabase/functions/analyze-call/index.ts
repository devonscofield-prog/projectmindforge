import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
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

  let callId: string | null = null;

  try {
    // Parse and validate input
    const body = await req.json();
    const { call_id } = body;

    // Validate call_id is present and is a valid UUID
    if (!call_id || typeof call_id !== 'string' || !UUID_REGEX.test(call_id)) {
      console.warn('[analyze-call] Invalid call_id provided:', call_id);
      return new Response(
        JSON.stringify({ error: 'Invalid call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    callId = call_id;
    console.log(`[analyze-call] Starting analysis for call_id: ${callId}`);

    // Step 1: Read the transcript row using user's RLS context (validates access)
    const { data: transcript, error: fetchError } = await supabaseUser
      .from('call_transcripts')
      .select('id, rep_id, raw_text, call_date, source')
      .eq('id', callId)
      .maybeSingle();

    if (fetchError) {
      console.error('[analyze-call] Error fetching transcript:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch call transcript' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!transcript) {
      console.warn(`[analyze-call] Transcript not found or access denied for call_id: ${callId}`);
      return new Response(
        JSON.stringify({ error: 'Call transcript not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[analyze-call] Transcript found for rep_id: ${transcript.rep_id}`);

    // Step 2: Update analysis_status to 'processing' using service role client
    const { error: updateProcessingError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'processing', analysis_error: null })
      .eq('id', callId);

    if (updateProcessingError) {
      console.error('[analyze-call] Error updating status to processing:', updateProcessingError);
      // Continue anyway, this is not critical
    }

    // Step 3: Build mock analysis object matching ai_call_analysis table schema
    const mockAnalysis = {
      call_id: transcript.id,
      rep_id: transcript.rep_id,
      model_name: 'mock-model',
      prompt_version: 'v0-mock',
      confidence: 0.85,
      call_summary: 'Mock summary of the sales call based on the transcript text.',
      discovery_score: 78,
      objection_handling_score: 82,
      rapport_communication_score: 88,
      product_knowledge_score: 75,
      deal_advancement_score: 70,
      call_effectiveness_score: 80,
      trend_indicators: {
        discovery: 'improving',
        objections: 'stable'
      },
      deal_gaps: {
        critical_missing_info: ['No confirmed decision process'],
        unresolved_objections: ['Pricing concern not fully addressed']
      },
      strengths: [
        { area: 'rapport', example: 'Built good rapport at the start of the call.' },
        { area: 'product_knowledge', example: 'Clear explanation of core features.' }
      ],
      opportunities: [
        { area: 'discovery', example: 'Dig deeper on budget timeline and decision makers.' },
        { area: 'objection_handling', example: 'Address pricing concerns with ROI framing.' }
      ],
      skill_tags: ['discovery_depth_medium', 'objection_follow_up_ok', 'rapport_strong'],
      deal_tags: ['no_confirmed_timeline', 'single_threaded'],
      meta_tags: ['mock_analysis', 'short_transcript'],
      raw_json: null as any // Will be set below
    };

    // Set raw_json to the full analysis object
    mockAnalysis.raw_json = { ...mockAnalysis, raw_json: undefined };

    console.log('[analyze-call] Mock analysis generated');

    // Step 4: Insert into ai_call_analysis using service role client
    const { data: analysisResult, error: insertError } = await supabaseAdmin
      .from('ai_call_analysis')
      .insert(mockAnalysis)
      .select('id')
      .single();

    if (insertError) {
      console.error('[analyze-call] Error inserting analysis:', insertError);
      
      // Update transcript with error status
      await supabaseAdmin
        .from('call_transcripts')
        .update({
          analysis_status: 'error',
          analysis_error: `Mock analysis failed: ${insertError.message}`
        })
        .eq('id', callId);

      return new Response(
        JSON.stringify({ error: 'Failed to save analysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysisId = analysisResult.id;
    console.log(`[analyze-call] Analysis inserted with id: ${analysisId}`);

    // Step 5: Update call_transcripts.analysis_status to 'completed'
    const { error: updateCompletedError } = await supabaseAdmin
      .from('call_transcripts')
      .update({ analysis_status: 'completed' })
      .eq('id', callId);

    if (updateCompletedError) {
      console.error('[analyze-call] Error updating status to completed:', updateCompletedError);
      // Analysis was saved, so we still return success
    }

    console.log(`[analyze-call] Analysis completed successfully for call_id: ${callId}`);

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        call_id: callId,
        analysis_id: analysisId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[analyze-call] Unexpected error:', error);

    // If we have a callId, try to update status to error
    if (callId) {
      try {
        await supabaseAdmin
          .from('call_transcripts')
          .update({
            analysis_status: 'error',
            analysis_error: `Mock analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          })
          .eq('id', callId);
      } catch (updateErr) {
        console.error('[analyze-call] Failed to update error status:', updateErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Analysis failed'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
