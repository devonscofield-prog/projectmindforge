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

    // Build a lowercase lookup set
    const lookupNames = accountNames.map((n: string) => n.toLowerCase().trim());

    // Fetch all prospects (account_name is used for matching)
    const { data: prospects, error: prospectError } = await supabase
      .from('prospects')
      .select(
        'id, prospect_name, account_name, status, heat_score, potential_revenue, active_revenue, last_contact_date, industry, rep_id'
      )
      .is('deleted_at', null);

    if (prospectError) {
      throw new Error(`Failed to fetch prospects: ${prospectError.message}`);
    }

    // Build a map of lowercase account_name -> prospect(s)
    // If multiple prospects share the same account_name, aggregate
    const prospectMap = new Map<string, typeof prospects>();
    for (const p of prospects || []) {
      const key = (p.account_name || p.prospect_name || '').toLowerCase().trim();
      if (!key) continue;
      if (!prospectMap.has(key)) {
        prospectMap.set(key, []);
      }
      prospectMap.get(key)!.push(p);
    }

    // Gather prospect IDs that matched for call counting
    const matchedProspectIds: string[] = [];
    const prospectIdToKey = new Map<string, string>();

    for (const name of lookupNames) {
      const matches = prospectMap.get(name);
      if (matches) {
        for (const m of matches) {
          matchedProspectIds.push(m.id);
          prospectIdToKey.set(m.id, name);
        }
      }
    }

    // Fetch call counts per prospect
    const callCountMap = new Map<string, number>();
    const latestCallMap = new Map<string, string>();

    if (matchedProspectIds.length > 0) {
      // Batch in chunks of 200 to avoid query limits
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
          const key = prospectIdToKey.get(c.prospect_id) || '';
          callCountMap.set(key, (callCountMap.get(key) || 0) + 1);
          if (!latestCallMap.has(key)) {
            latestCallMap.set(key, c.call_date);
          }
        }
      }
    }

    // Fetch rep names for matched prospects
    const repIds = [...new Set((prospects || []).filter(p => p.rep_id).map(p => p.rep_id))];
    const repNameMap = new Map<string, string>();
    if (repIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', repIds);
      for (const p of profiles || []) {
        repNameMap.set(p.id, p.name);
      }
    }

    // Build enrichment results
    const results: Record<string, Record<string, string>> = {};

    for (const name of lookupNames) {
      const matches = prospectMap.get(name);
      if (!matches || matches.length === 0) {
        results[name] = { SW_Match_Status: 'No Match' };
        continue;
      }

      // Use the "best" prospect: highest heat score, or most recent contact
      const best = matches.sort((a, b) => {
        if ((b.heat_score || 0) !== (a.heat_score || 0)) return (b.heat_score || 0) - (a.heat_score || 0);
        return (b.last_contact_date || '').localeCompare(a.last_contact_date || '');
      })[0];

      const callCount = callCountMap.get(name) || 0;
      const latestCall = latestCallMap.get(name) || '';
      const repName = best.rep_id ? (repNameMap.get(best.rep_id) || '') : '';

      // Aggregate revenue across all matching prospects
      const totalActiveRevenue = matches.reduce((sum, p) => sum + (p.active_revenue || 0), 0);
      const totalPotentialRevenue = matches.reduce((sum, p) => sum + (p.potential_revenue || 0), 0);

      results[name] = {
        SW_Match_Status: 'Matched',
        SW_Prospect_Name: best.prospect_name || '',
        SW_Account_Status: best.status || '',
        SW_Heat_Score: best.heat_score != null ? String(best.heat_score) : '',
        SW_Industry: best.industry || '',
        SW_Active_Revenue: totalActiveRevenue > 0 ? String(totalActiveRevenue) : '',
        SW_Potential_Revenue: totalPotentialRevenue > 0 ? String(totalPotentialRevenue) : '',
        SW_Last_Contact: best.last_contact_date || '',
        SW_Latest_Call_Date: latestCall,
        SW_Total_Calls: String(callCount),
        SW_Assigned_Rep: repName,
        SW_Prospect_Count: matches.length > 1 ? String(matches.length) : '1',
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
