import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { call_id } = await req.json();
    if (!call_id) {
      return new Response(
        JSON.stringify({ error: 'Missing call_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] User ${user.id} requesting reanalysis for call ${call_id}`);

    // Check user role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();
    
    const userRole = roleData?.role || 'rep';

    // Fetch the call to verify ownership and get rep_id
    const { data: call, error: callError } = await supabase
      .from('call_transcripts')
      .select('id, rep_id, analysis_status')
      .eq('id', call_id)
      .is('deleted_at', null)
      .single();

    if (callError || !call) {
      console.error(`[reanalyze-call] Call not found: ${call_id}`);
      return new Response(
        JSON.stringify({ error: 'Call not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify permission: rep owns the call OR user is admin
    if (userRole !== 'admin' && call.rep_id !== user.id) {
      console.warn(`[reanalyze-call] Unauthorized attempt by ${user.id} for call owned by ${call.rep_id}`);
      return new Response(
        JSON.stringify({ error: 'Not authorized to reanalyze this call' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already processing
    if (call.analysis_status === 'processing') {
      return new Response(
        JSON.stringify({ error: 'Analysis already in progress' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for clearing analysis and triggering re-analysis
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Clear existing analysis data
    const { error: clearError } = await adminClient
      .from('ai_call_analysis')
      .update({
        analysis_metadata: null,
        analysis_behavior: null,
        analysis_strategy: null,
        analysis_psychology: null,
        deal_heat_analysis: null,
        call_summary: 'Re-analyzing...',
        call_notes: null,
        recap_email_draft: null,
        strengths: null,
        opportunities: null,
        deal_gaps: null,
        trend_indicators: null,
        prospect_intel: null,
        coach_output: null,
        raw_json: null,
      })
      .eq('call_id', call_id);

    if (clearError) {
      console.error(`[reanalyze-call] Error clearing old analysis:`, clearError);
      // Continue anyway - the new analysis will overwrite
    }

    // Reset transcript status to processing
    const { error: updateError } = await adminClient
      .from('call_transcripts')
      .update({ 
        analysis_status: 'processing',
        analysis_error: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', call_id);

    if (updateError) {
      console.error(`[reanalyze-call] Error updating transcript status:`, updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to queue reanalysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Status reset to processing, invoking analyze-call`);

    // Trigger the analyze-call function with force flag to bypass idempotency check
    const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ call_id, force_reanalyze: true }),
    });

    if (!analyzeResponse.ok) {
      const errorText = await analyzeResponse.text();
      console.error(`[reanalyze-call] analyze-call failed:`, analyzeResponse.status, errorText);
      
      // Reset status back to error so user can retry
      await adminClient
        .from('call_transcripts')
        .update({ 
          analysis_status: 'error',
          analysis_error: 'Failed to start reanalysis'
        })
        .eq('id', call_id);

      return new Response(
        JSON.stringify({ error: 'Failed to start reanalysis' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Successfully triggered reanalysis for call ${call_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Reanalysis started',
        call_id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reanalyze-call] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
