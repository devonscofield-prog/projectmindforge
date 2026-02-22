import { createClient } from "@supabase/supabase-js";
import { validateSignedRequest, timingSafeEqual, signRequest } from "../_shared/hmac.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

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

    // Auth: require HMAC signature or service role key
    const bodyText = await req.text();
    const hasSignature = req.headers.has('X-Request-Signature');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (hasSignature) {
      const validation = await validateSignedRequest(req.headers, bodyText, serviceKey);
      if (!validation.valid) {
        log(`HMAC validation failed: ${validation.error}`);
        return new Response(JSON.stringify({ error: 'Invalid request signature' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      log('Authenticated via HMAC signature');
    } else if (token) {
      const isService = await timingSafeEqual(token, serviceKey);
      if (!isService) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      log('Authenticated via service role key');
    } else {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
      
      // Fire-and-forget with HMAC signature: Don't await the response since analysis can take 60+ seconds
      const analyzeBody = JSON.stringify({ call_id: call.id });
      signRequest(analyzeBody, serviceKey).then(sigHeaders => {
        fetch(`${supabaseUrl}/functions/v1/analyze-call`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            ...sigHeaders,
          },
          body: analyzeBody,
        }).catch(err => {
          log(`Background analysis trigger failed for ${call.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
        });
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
    const requestId = crypto.randomUUID().slice(0, 8);
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    log(`Error ${requestId}: ${errorMsg}`);
    return new Response(JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
