import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
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

    // Check if manager is authorized to manage this rep's calls
    let isManagerOfRep = false;
    if (userRole === 'manager' && call.rep_id !== user.id) {
      const { data: isManager } = await supabase
        .rpc('is_manager_of_user', { 
          _manager_id: user.id, 
          _rep_id: call.rep_id 
        });
      isManagerOfRep = isManager === true;
    }

    // Verify permission: rep owns the call OR user is admin OR manager of the rep
    if (userRole !== 'admin' && call.rep_id !== user.id && !isManagerOfRep) {
      console.warn(`[reanalyze-call] Unauthorized attempt by ${user.id} (role: ${userRole}) for call owned by ${call.rep_id}`);
      return new Response(
        JSON.stringify({ error: 'Not authorized to reanalyze this call' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[reanalyze-call] Authorized: user=${user.id}, role=${userRole}, isManagerOfRep=${isManagerOfRep}`);

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

    // Clear existing analysis data including follow-up suggestions
    const { error: clearError } = await adminClient
      .from('ai_call_analysis')
      .update({
        analysis_metadata: null,
        analysis_behavior: null,
        analysis_strategy: null,
        analysis_psychology: null,
        deal_heat_analysis: null,
        follow_up_suggestions: null, // Clear suggestions so they regenerate
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
    
    // Also reset suggestions_reviewed_at so the panel shows again
    await adminClient
      .from('call_transcripts')
      .update({ suggestions_reviewed_at: null })
      .eq('id', call_id);

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

    // Generate HMAC signature for service-to-service authentication
    const body = JSON.stringify({ call_id, force_reanalyze: true });
    const timestamp = Date.now().toString();
    const nonce = crypto.randomUUID();
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
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Trigger the analyze-call function with force flag - fire and forget
    // Don't await the response since analyze-call takes 60-90 seconds and would timeout
    fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'X-Request-Signature': signature,
        'X-Request-Timestamp': timestamp,
        'X-Request-Nonce': nonce,
      },
      body,
    }).catch((err) => {
      // Log but don't fail - the analysis will be picked up by trigger-pending-analyses if needed
      console.error(`[reanalyze-call] Background analyze-call failed to start:`, err);
    });

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
