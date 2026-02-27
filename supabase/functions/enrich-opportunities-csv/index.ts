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

    const { accountNames, contactNames, threshold } = await req.json();
    const matchThreshold = typeof threshold === 'number' && threshold >= 0.1 && threshold <= 1.0 ? threshold : 0.3;

    if (!Array.isArray(accountNames) || accountNames.length === 0) {
      return new Response(JSON.stringify({ error: 'accountNames array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fuzzy match by account name
    const { data: accountMatches, error: matchError } = await supabase.rpc('fuzzy_match_prospects', {
      p_account_names: accountNames,
      p_threshold: 0.3,
    });

    if (matchError) {
      throw new Error(`Fuzzy match failed: ${matchError.message}`);
    }

    // Group best account matches by input_name
    const bestAccountMatches = new Map<string, (typeof accountMatches)[number]>();
    for (const m of accountMatches || []) {
      const key = m.input_name.toLowerCase().trim();
      const existing = bestAccountMatches.get(key);
      if (!existing || m.similarity_score > existing.similarity_score) {
        bestAccountMatches.set(key, m);
      }
    }

    // 2. Fuzzy match by contact name (if provided)
    // contactNames is an array of { accountName, contactName } objects
    const contactNamesList: string[] = [];
    const contactToAccountMap = new Map<string, string>(); // contactName lower -> accountName lower

    if (Array.isArray(contactNames) && contactNames.length > 0) {
      for (const entry of contactNames) {
        if (entry.contactName) {
          const cKey = entry.contactName.toLowerCase().trim();
          contactNamesList.push(entry.contactName);
          contactToAccountMap.set(cKey, (entry.accountName || '').toLowerCase().trim());
        }
      }
    }

    const bestContactMatches = new Map<string, { match: any; contactName: string }>();

    if (contactNamesList.length > 0) {
      const uniqueContacts = [...new Set(contactNamesList)];
      const { data: contactMatches, error: contactError } = await supabase.rpc('fuzzy_match_stakeholders', {
        p_contact_names: uniqueContacts,
        p_threshold: 0.3,
      });

      if (contactError) {
        console.error('Contact fuzzy match failed:', contactError.message);
      } else {
        // Group best contact match by the associated account name key
        for (const m of contactMatches || []) {
          const contactKey = m.input_name.toLowerCase().trim();
          const accountKey = contactToAccountMap.get(contactKey);
          if (!accountKey) continue;

          const existing = bestContactMatches.get(accountKey);
          if (!existing || m.similarity_score > existing.match.similarity_score) {
            bestContactMatches.set(accountKey, { match: m, contactName: m.stakeholder_name });
          }
        }
      }
    }

    // 3. Merge: pick best match per account (account match vs contact match)
    const finalMatches = new Map<string, { match: any; source: 'account' | 'contact'; contactName?: string }>();

    for (const inputName of accountNames) {
      const key = inputName.toLowerCase().trim();
      const accountMatch = bestAccountMatches.get(key);
      const contactMatch = bestContactMatches.get(key);

      if (accountMatch && contactMatch) {
        // Pick whichever has higher similarity
        if (accountMatch.similarity_score >= contactMatch.match.similarity_score) {
          finalMatches.set(key, { match: accountMatch, source: 'account', contactName: contactMatch.contactName });
        } else {
          finalMatches.set(key, { match: contactMatch.match, source: 'contact', contactName: contactMatch.contactName });
        }
      } else if (accountMatch) {
        finalMatches.set(key, { match: accountMatch, source: 'account' });
      } else if (contactMatch) {
        finalMatches.set(key, { match: contactMatch.match, source: 'contact', contactName: contactMatch.contactName });
      }
    }

    // 4. Gather matched prospect IDs for call counting
    const matchedProspectIds = [...finalMatches.values()].map((m) => m.match.prospect_id);
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
          for (const [key, fm] of finalMatches) {
            if (fm.match.prospect_id === c.prospect_id) {
              callCountMap.set(key, (callCountMap.get(key) || 0) + 1);
              if (!latestCallMap.has(key)) latestCallMap.set(key, c.call_date);
            }
          }
        }
      }
    }

    // 5. Fetch rep names
    const repIds = [...new Set([...finalMatches.values()].filter((m) => m.match.rep_id).map((m) => m.match.rep_id))];
    const repNameMap = new Map<string, string>();
    if (repIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', repIds);
      for (const p of profiles || []) {
        repNameMap.set(p.id, p.name);
      }
    }

    // 6. Build results
    const results: Record<string, Record<string, string>> = {};

    for (const inputName of accountNames) {
      const key = inputName.toLowerCase().trim();
      const fm = finalMatches.get(key);

      if (!fm) {
        results[key] = { SW_Match_Status: 'No Match' };
        continue;
      }

      const m = fm.match;
      const callCount = callCountMap.get(key) || 0;
      const latestCall = latestCallMap.get(key) || '';
      const repName = m.rep_id ? repNameMap.get(m.rep_id) || '' : '';
      const confidencePct = Math.round(m.similarity_score * 100);

      results[key] = {
        SW_Match_Status: m.similarity_score >= 0.95 ? 'Matched' : 'Fuzzy Match',
        SW_Confidence: `${confidencePct}%`,
        SW_Match_Source: fm.source === 'contact' ? 'Contact' : 'Account',
        SW_Matched_Account: m.account_name || m.prospect_name || '',
        SW_Prospect_Name: m.prospect_name || '',
        SW_Matched_Contact: fm.contactName || '',
        SW_Contact_Title: fm.source === 'contact' ? (m.job_title || '') : '',
        SW_Account_Status: m.status || '',
        SW_Heat_Score: m.heat_score != null ? String(m.heat_score) : '',
        SW_Industry: m.industry || '',
        SW_Active_Revenue: m.active_revenue ? String(m.active_revenue) : '',
        SW_Potential_Revenue: m.potential_revenue ? String(m.potential_revenue) : '',
        SW_Last_Contact: m.last_contact_date || '',
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
