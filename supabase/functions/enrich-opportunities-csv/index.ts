import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the caller is an admin
    const anonClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!);
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { accountNames } = await req.json();

    if (!Array.isArray(accountNames) || accountNames.length === 0) {
      return new Response(JSON.stringify({ error: 'accountNames array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use fuzzy matching via pg_trgm similarity (threshold 0.3 ≈ catches 80-90% confidence matches)
    const { data: matches, error: matchError } = await supabase.rpc('fuzzy_match_prospects', {
      p_account_names: accountNames,
      p_threshold: 0.3,
    });

    if (matchError) {
      throw new Error(`Fuzzy match failed: ${matchError.message}`);
    }

    // Group matches by input_name, pick best match per input
    const bestMatches = new Map<string, (typeof matches)[number]>();
    const allMatchesByName = new Map<string, (typeof matches)[number][]>();

    for (const m of matches || []) {
      const key = m.input_name.toLowerCase().trim();
      if (!allMatchesByName.has(key)) allMatchesByName.set(key, []);
      allMatchesByName.get(key)!.push(m);

      const existing = bestMatches.get(key);
      if (!existing || m.similarity_score > existing.similarity_score) {
        bestMatches.set(key, m);
      }
    }

    // Gather matched prospect IDs for call counting
    const matchedProspectIds = [...bestMatches.values()].map((m) => m.prospect_id);

    // Fetch call counts per prospect
    const callCountMap = new Map<string, number>();
    const latestCallMap = new Map<string, string>();

    if (matchedProspectIds.length > 0) {
      for (let i = 0; i < matchedProspectIds.length; i += 200) {
        const batch = matchedProspectIds.slice(i, i + 200);
        const { data: calls } = await supabase
          .from('call_transcripts')
          .select('prospect_id, call_date')
          .in('prospect_id', batch)
          .is('deleted_at', null)
          .order('call_date', { ascending: false });

        for (const c of calls || []) {
          if (!c.prospect_id) continue;
          // Map prospect_id back to input_name
          for (const [key, best] of bestMatches) {
            if (best.prospect_id === c.prospect_id) {
              callCountMap.set(key, (callCountMap.get(key) || 0) + 1);
              if (!latestCallMap.has(key)) latestCallMap.set(key, c.call_date);
            }
          }
        }
      }
    }

    // Fetch rep names
    const repIds = [...new Set([...bestMatches.values()].filter((m) => m.rep_id).map((m) => m.rep_id))];
    const repNameMap = new Map<string, string>();
    if (repIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', repIds);
      for (const p of profiles || []) {
        repNameMap.set(p.id, p.name);
      }
    }

    // Build results
    const results: Record<string, Record<string, string>> = {};

    for (const inputName of accountNames) {
      const key = inputName.toLowerCase().trim();
      const best = bestMatches.get(key);

      if (!best) {
        results[key] = { SW_Match_Status: 'No Match' };
        continue;
      }

      const callCount = callCountMap.get(key) || 0;
      const latestCall = latestCallMap.get(key) || '';
      const repName = best.rep_id ? repNameMap.get(best.rep_id) || '' : '';
      const confidencePct = Math.round(best.similarity_score * 100);

      results[key] = {
        SW_Match_Status: best.similarity_score >= 0.95 ? 'Matched' : 'Fuzzy Match',
        SW_Confidence: `${confidencePct}%`,
        SW_Matched_Account: best.account_name || best.prospect_name || '',
        SW_Prospect_Name: best.prospect_name || '',
        SW_Account_Status: best.status || '',
        SW_Heat_Score: best.heat_score != null ? String(best.heat_score) : '',
        SW_Industry: best.industry || '',
        SW_Active_Revenue: best.active_revenue ? String(best.active_revenue) : '',
        SW_Potential_Revenue: best.potential_revenue ? String(best.potential_revenue) : '',
        SW_Last_Contact: best.last_contact_date || '',
        SW_Latest_Call_Date: latestCall,
        SW_Total_Calls: String(callCount),
        SW_Assigned_Rep: repName,
      };
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('enrich-opportunities-csv error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
