import { createClient } from "@supabase/supabase-js";
import { validateSignedRequest, timingSafeEqual } from "../_shared/hmac.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Cleanup stuck roleplay sessions edge function.
 * Called periodically via CRON to recover sessions stuck in "in_progress" state.
 *
 * A session is considered stuck if it's been in_progress for more than 10 minutes
 * without any activity.
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

    // Auth: require HMAC signature or service role key
    const bodyText = await req.text();
    const hasSignature = req.headers.has('X-Request-Signature');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (hasSignature) {
      const validation = await validateSignedRequest(req.headers, bodyText, supabaseServiceKey);
      if (!validation.valid) {
        console.warn('[cleanup-stuck-sessions] HMAC validation failed:', validation.error);
        return new Response(JSON.stringify({ error: 'Invalid request signature' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (token) {
      const isService = await timingSafeEqual(token, supabaseServiceKey);
      if (!isService) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Running stuck session cleanup...');

    // Find and recover stuck sessions (in_progress for more than 10 minutes)
    const thresholdMinutes = 10;
    const thresholdTime = new Date(Date.now() - thresholdMinutes * 60 * 1000).toISOString();

    // Get stuck sessions for logging (both in_progress and pending)
    const { data: stuckSessions, error: fetchError } = await supabaseClient
      .from('roleplay_sessions')
      .select('id, trainee_id, persona_id, started_at, status')
      .in('status', ['in_progress', 'pending'])
      .lt('started_at', thresholdTime);

    if (fetchError) {
      console.error('Error fetching stuck sessions:', fetchError);
      throw new Error('Failed to fetch stuck sessions');
    }

    if (!stuckSessions || stuckSessions.length === 0) {
      console.log('No stuck sessions found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck sessions found',
        recovered: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${stuckSessions.length} stuck sessions`);

    // Update all stuck sessions to abandoned
    const { error: updateError } = await supabaseClient
      .from('roleplay_sessions')
      .update({
        status: 'abandoned',
        ended_at: new Date().toISOString(),
        session_config: { auto_recovered: true },
      })
      .in('status', ['in_progress', 'pending'])
      .lt('started_at', thresholdTime);

    if (updateError) {
      console.error('Error updating stuck sessions:', updateError);
      throw new Error('Failed to update stuck sessions');
    }

    console.log(`Successfully recovered ${stuckSessions.length} stuck sessions`);

    // Log details for debugging
    stuckSessions.forEach(session => {
      console.log(`  - Session ${session.id} (${session.status}): started ${session.started_at}`);
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Recovered ${stuckSessions.length} stuck sessions`,
      recovered: stuckSessions.length,
      sessions: stuckSessions.map(s => s.id),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[cleanup-stuck-sessions] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again.', requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
