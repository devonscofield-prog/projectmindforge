import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Cleanup stuck roleplay sessions edge function.
 * Called periodically via CRON to recover sessions stuck in "in_progress" state.
 * 
 * A session is considered stuck if it's been in_progress for more than 10 minutes
 * without any activity.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
    console.error('Error in cleanup-stuck-sessions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
