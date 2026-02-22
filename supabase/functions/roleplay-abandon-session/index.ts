import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Dedicated abandon session endpoint that works with navigator.sendBeacon.
 *
 * sendBeacon cannot include Authorization headers, so this function:
 * 1. Does NOT require JWT authentication (verify_jwt = false in config.toml)
 * 2. Validates the session exists and is in an abandonable state
 * 3. Validates that the provided traineeId matches the session's owner
 * 4. Uses service role to update the session status
 *
 * Security: Only allows marking sessions as "abandoned" - no other operations.
 * Both sessionId and traineeId must be valid UUIDs.
 * The traineeId must match the session's trainee_id to prevent unauthorized abandons.
 */
Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body - handle both JSON and text (sendBeacon might send as text)
    let sessionId: string;
    let traineeId: string;
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      sessionId = body.sessionId;
      traineeId = body.traineeId;
    } else {
      // sendBeacon might send as text/plain
      const text = await req.text();
      try {
        const parsed = JSON.parse(text);
        sessionId = parsed.sessionId;
        traineeId = parsed.traineeId;
      } catch {
        console.error('Failed to parse request body:', text);
        throw new Error('Invalid request body');
      }
    }

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    if (!traineeId) {
      throw new Error('traineeId is required');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(sessionId)) {
      throw new Error('Invalid sessionId format');
    }
    if (!uuidRegex.test(traineeId)) {
      throw new Error('Invalid traineeId format');
    }

    console.log(`Abandoning session via beacon: ${sessionId}`);

    // Verify session exists, belongs to the trainee, and is in a state that can be abandoned
    const { data: session, error: fetchError } = await supabaseClient
      .from('roleplay_sessions')
      .select('id, status, trainee_id')
      .eq('id', sessionId)
      .eq('trainee_id', traineeId)
      .single();

    if (fetchError || !session) {
      console.error('Session not found:', fetchError);
      // Return success anyway to not leak information
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only abandon if in progress or pending
    if (!['in_progress', 'pending'].includes(session.status)) {
      console.log(`Session ${sessionId} already in final state: ${session.status}`);
      return new Response(JSON.stringify({
        success: true,
        message: 'Session already completed',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update session to abandoned (scoped to trainee for safety)
    const { error: updateError } = await supabaseClient
      .from('roleplay_sessions')
      .update({
        status: 'abandoned',
        ended_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('trainee_id', traineeId);

    if (updateError) {
      console.error('Session abandon error:', updateError);
      throw new Error('Failed to abandon session');
    }

    console.log(`Session ${sessionId} abandoned successfully`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Session abandoned',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[roleplay-abandon-session] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again.',
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
