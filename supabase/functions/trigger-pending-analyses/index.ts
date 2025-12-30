import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 8);
  const log = (msg: string) => console.log(`[${correlationId}] ${msg}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    if (!serviceKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Step 1: Recover any stuck processing/pending calls (5+ minutes old)
    try {
      const { data: recovered } = await supabase.rpc('recover_stuck_processing_transcripts');
      if (recovered && recovered.length > 0) {
        log(`Recovered ${recovered.length} stuck transcript(s): ${recovered.map((r: { account_name: string }) => r.account_name).join(', ')}`);
      }
    } catch (e) {
      log(`Recovery check failed (non-critical): ${e instanceof Error ? e.message : 'Unknown'}`);
    }

    // Step 2: Find calls that are pending for more than 10 seconds
    const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();
    
    const { data: pendingCalls, error: queryError } = await supabase
      .from('call_transcripts')
      .select('id, account_name, created_at')
      .eq('analysis_status', 'pending')
      .lt('created_at', tenSecondsAgo)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 at a time to avoid overload

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!pendingCalls || pendingCalls.length === 0) {
      log('No pending calls to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    log(`Found ${pendingCalls.length} pending calls to process`);

    const results = [];
    for (const call of pendingCalls) {
      log(`Triggering analysis for call ${call.id} (${call.account_name})`);
      
      // Fire-and-forget: Don't await the response since analysis can take 60+ seconds
      fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ call_id: call.id }),
      }).catch(err => {
        log(`Background analysis trigger failed for ${call.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      });

      results.push({ call_id: call.id, success: true, triggered: true });

      // Small delay between triggers to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    log(`Triggered ${results.length} analyses (fire-and-forget)`);

    return new Response(JSON.stringify({ 
      processed: pendingCalls.length,
      triggered: results.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`Error: ${errorMsg}`);
    return new Response(JSON.stringify({ error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
