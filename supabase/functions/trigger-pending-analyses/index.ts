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

    // Find calls that are pending for more than 30 seconds
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    
    const { data: pendingCalls, error: queryError } = await supabase
      .from('call_transcripts')
      .select('id, account_name, created_at')
      .eq('analysis_status', 'pending')
      .lt('created_at', thirtySecondsAgo)
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
      try {
        log(`Triggering analysis for call ${call.id} (${call.account_name})`);
        
        // Invoke analyze-call edge function
        const response = await fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ call_id: call.id }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          log(`Failed to trigger analysis for ${call.id}: ${response.status} - ${errorText}`);
          results.push({ call_id: call.id, success: false, error: errorText });
        } else {
          log(`Successfully triggered analysis for ${call.id}`);
          results.push({ call_id: call.id, success: true });
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        log(`Error triggering analysis for ${call.id}: ${errorMsg}`);
        results.push({ call_id: call.id, success: false, error: errorMsg });
      }

      // Small delay between calls to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const successCount = results.filter(r => r.success).length;
    log(`Processed ${successCount}/${pendingCalls.length} calls successfully`);

    return new Response(JSON.stringify({ 
      processed: pendingCalls.length,
      successful: successCount,
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
