/**
 * analyze-call Edge Function - Stage 1 of Analysis 2.0
 * 
 * This function has been cleared for the Analysis 2.0 upgrade.
 * The legacy analysis logic has been removed.
 * 
 * TODO: Implement new modular analysis pipeline here.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { UUID_REGEX } from './lib/constants.ts';
import { getCorsHeaders } from './lib/cors.ts';

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
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Create service role client for bypassing RLS when writing
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

    // ============================================================
    // ANALYSIS 2.0 - PLACEHOLDER
    // 
    // The legacy "God Prompt" analysis logic has been removed.
    // New modular analysis pipeline will be implemented here.
    // 
    // For now, return a placeholder response indicating the
    // analysis system is being upgraded.
    // ============================================================

    console.log(`[analyze-call] Analysis 2.0 placeholder - call_id: ${call_id}, user: ${user.id}`);

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Analysis system is being upgraded to 2.0. Please try again later.',
        call_id: call_id,
        upgrade_in_progress: true
      }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[analyze-call] Error:', errorMessage);

    return new Response(
      JSON.stringify({ error: 'Analysis failed. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
