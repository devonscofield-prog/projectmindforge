import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Rate limiting: 20 requests per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true };
}

// Clean up old rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) rateLimitMap.delete(key);
  }
}, 60 * 1000);

// CORS
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    const cleanDomain = customDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').trim();
    if (cleanDomain) {
      allowedOrigins.push(`https://${cleanDomain}`);
      allowedOrigins.push(`https://www.${cleanDomain}`);
    }
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(p => p.test(requestOrigin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Validation
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(50000),
});

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  page_context: z.string().max(200).optional().default('/admin'),
});

const SYSTEM_PROMPT = `You are an AI admin assistant for StormWind, a sales coaching and call analytics platform. You have full visibility into all platform data and can answer any question an admin might have.

Your Personality:
- Professional, concise, and data-driven
- When presenting numbers, use clear formatting with bullet points and tables
- Always reference specific data points rather than speaking in generalities
- If you don't have enough data to answer definitively, say so clearly

Your Capabilities:
- Analyze sales coaching trends, call volumes, and rep performance
- Identify patterns in team behavior and coaching effectiveness  
- Provide actionable insights about pipeline health, account engagement, and team productivity
- Answer questions about any user, team, account, or call in the system
- Help admins understand what's happening across their organization

Communication Style:
- Lead with the key insight or answer, then provide supporting data
- Use markdown formatting for readability (headers, bold, lists, tables)
- Keep responses focused — answer the question asked, don't dump all available data
- When trends are relevant, note direction (improving, declining, stable)`;

// Context fetching functions
async function fetchDashboardContext(supabase: any): Promise<string> {
  const [
    { data: stats },
    { data: recentCalls },
    { data: recentCoaching },
  ] = await Promise.all([
    supabase.rpc('get_cached_admin_stats'),
    supabase.from('call_transcripts')
      .select('id, call_date, account_name, call_type, rep_id, analysis_status')
      .is('deleted_at', null)
      .order('call_date', { ascending: false })
      .limit(15),
    supabase.from('coaching_sessions')
      .select('id, session_date, focus_area, rep_id, manager_id')
      .order('session_date', { ascending: false })
      .limit(10),
  ]);

  let ctx = '## DASHBOARD OVERVIEW\n';
  if (stats) {
    ctx += `Total Users: ${stats.totalUsers}\nTotal Teams: ${stats.totalTeams}\nTotal Calls: ${stats.totalCalls}\nTotal Prospects: ${stats.totalProspects}\n`;
    if (stats.roleDistribution) {
      ctx += `Role Distribution: ${stats.roleDistribution.admin} admins, ${stats.roleDistribution.manager} managers, ${stats.roleDistribution.rep} reps\n`;
    }
  }
  if (recentCalls?.length) {
    ctx += `\n### Recent Calls (last ${recentCalls.length})\n`;
    for (const c of recentCalls.slice(0, 10)) {
      ctx += `- ${c.call_date} | ${c.account_name || 'Unknown'} | ${c.call_type || 'Call'} | Status: ${c.analysis_status}\n`;
    }
  }
  if (recentCoaching?.length) {
    ctx += `\n### Recent Coaching Sessions\n`;
    for (const s of recentCoaching.slice(0, 5)) {
      ctx += `- ${s.session_date} | Focus: ${s.focus_area}\n`;
    }
  }
  return ctx;
}

async function fetchCoachHistoryContext(supabase: any): Promise<string> {
  const [
    { data: sessions },
    { data: userNames },
  ] = await Promise.all([
    supabase.from('sales_coach_sessions')
      .select('id, user_id, prospect_id, title, messages, created_at, updated_at')
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase.from('profiles').select('id, name'),
  ]);

  const nameMap = new Map((userNames || []).map((u: any) => [u.id, u.name]));
  
  let ctx = '## SALES COACH CHAT HISTORY\n';
  ctx += `Total sessions loaded: ${sessions?.length || 0}\n`;
  
  if (sessions?.length) {
    // Usage stats
    const uniqueUsers = new Set(sessions.map((s: any) => s.user_id));
    ctx += `Unique users: ${uniqueUsers.size}\n`;
    
    // Sessions by user
    const userSessionCount: Record<string, number> = {};
    for (const s of sessions) {
      const name = nameMap.get(s.user_id) || 'Unknown';
      userSessionCount[name] = (userSessionCount[name] || 0) + 1;
    }
    ctx += '\n### Sessions by User\n';
    for (const [name, count] of Object.entries(userSessionCount).sort((a, b) => b[1] - a[1])) {
      ctx += `- ${name}: ${count} sessions\n`;
    }

    ctx += '\n### Recent Sessions\n';
    for (const s of sessions.slice(0, 15)) {
      const userName = nameMap.get(s.user_id) || 'Unknown';
      const msgCount = Array.isArray(s.messages) ? s.messages.length : 0;
      ctx += `- [${s.updated_at?.substring(0, 10)}] ${userName}: "${s.title || 'Untitled'}" (${msgCount} messages)\n`;
    }
  }
  return ctx;
}

async function fetchCallHistoryContext(supabase: any): Promise<string> {
  const [
    { data: calls },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('call_transcripts')
      .select('id, call_date, account_name, call_type, rep_id, analysis_status, prospect_id')
      .is('deleted_at', null)
      .order('call_date', { ascending: false })
      .limit(30),
    supabase.from('profiles').select('id, name, team_id'),
  ]);

  const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
  
  let ctx = '## CALL HISTORY\n';
  ctx += `Total calls loaded: ${calls?.length || 0}\n`;
  
  if (calls?.length) {
    // Stats
    const repCallCount: Record<string, number> = {};
    const callTypeCount: Record<string, number> = {};
    for (const c of calls) {
      const name = nameMap.get(c.rep_id) || 'Unknown';
      repCallCount[name] = (repCallCount[name] || 0) + 1;
      const type = c.call_type || 'Unknown';
      callTypeCount[type] = (callTypeCount[type] || 0) + 1;
    }
    
    ctx += '\n### Calls by Rep\n';
    for (const [name, count] of Object.entries(repCallCount).sort((a, b) => b[1] - a[1])) {
      ctx += `- ${name}: ${count} calls\n`;
    }
    ctx += '\n### Calls by Type\n';
    for (const [type, count] of Object.entries(callTypeCount).sort((a, b) => b[1] - a[1])) {
      ctx += `- ${type}: ${count}\n`;
    }
    
    ctx += '\n### Recent Calls\n';
    for (const c of calls.slice(0, 20)) {
      ctx += `- ${c.call_date} | ${nameMap.get(c.rep_id) || 'Unknown'} | ${c.account_name || 'N/A'} | ${c.call_type || 'Call'} | ${c.analysis_status}\n`;
    }
  }
  return ctx;
}

async function fetchUsersContext(supabase: any): Promise<string> {
  const [
    { data: profiles },
    { data: roles },
    { data: teams },
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email, is_active, team_id, last_seen_at, created_at'),
    supabase.from('user_roles').select('user_id, role'),
    supabase.from('teams').select('id, name, manager_id'),
  ]);

  const roleMap = new Map((roles || []).map((r: any) => [r.user_id, r.role]));
  const teamMap = new Map((teams || []).map((t: any) => [t.id, t.name]));
  
  let ctx = '## USERS\n';
  ctx += `Total users: ${profiles?.length || 0}\n`;
  
  if (profiles?.length) {
    const active = profiles.filter((p: any) => p.is_active).length;
    ctx += `Active: ${active}, Inactive: ${profiles.length - active}\n`;
    
    ctx += '\n### User List\n';
    for (const p of profiles) {
      const role = roleMap.get(p.id) || 'unknown';
      const team = p.team_id ? teamMap.get(p.team_id) || 'Unknown Team' : 'No team';
      const lastSeen = p.last_seen_at ? p.last_seen_at.substring(0, 10) : 'Never';
      ctx += `- ${p.name} (${p.email}) | Role: ${role} | Team: ${team} | Active: ${p.is_active} | Last seen: ${lastSeen}\n`;
    }
  }
  return ctx;
}

async function fetchTeamsContext(supabase: any): Promise<string> {
  const [
    { data: teams },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('teams').select('id, name, manager_id, created_at'),
    supabase.from('profiles').select('id, name, team_id, is_active'),
  ]);

  const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
  
  let ctx = '## TEAMS\n';
  ctx += `Total teams: ${teams?.length || 0}\n`;
  
  if (teams?.length) {
    for (const t of teams) {
      const members = (profiles || []).filter((p: any) => p.team_id === t.id);
      const activeMembers = members.filter((m: any) => m.is_active);
      ctx += `\n### ${t.name}\n`;
      ctx += `Manager: ${nameMap.get(t.manager_id) || 'None'}\n`;
      ctx += `Members: ${activeMembers.length} active, ${members.length - activeMembers.length} inactive\n`;
      for (const m of members) {
        ctx += `  - ${m.name} (${m.is_active ? 'active' : 'inactive'})\n`;
      }
    }
  }
  return ctx;
}

async function fetchAccountsContext(supabase: any): Promise<string> {
  const [
    { data: prospects },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('prospects')
      .select('id, prospect_name, account_name, status, heat_score, active_revenue, potential_revenue, last_contact_date, rep_id, industry')
      .is('deleted_at', null)
      .order('last_contact_date', { ascending: false })
      .limit(30),
    supabase.from('profiles').select('id, name'),
  ]);

  const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));
  
  let ctx = '## ACCOUNTS\n';
  ctx += `Total accounts loaded: ${prospects?.length || 0}\n`;
  
  if (prospects?.length) {
    const active = prospects.filter((p: any) => p.status === 'active');
    const totalPipeline = active.reduce((sum: number, p: any) => sum + (p.potential_revenue || 0), 0);
    const hotAccounts = active.filter((p: any) => (p.heat_score || 0) >= 70);
    
    ctx += `Active: ${active.length} | Hot (≥70): ${hotAccounts.length} | Pipeline: $${totalPipeline.toLocaleString()}\n`;
    
    ctx += '\n### Account List\n';
    for (const p of prospects.slice(0, 30)) {
      ctx += `- ${p.account_name || p.prospect_name} | ${p.status} | Heat: ${p.heat_score || 'N/A'} | Rev: $${(p.active_revenue || p.potential_revenue || 0).toLocaleString()} | Rep: ${nameMap.get(p.rep_id) || 'Unknown'} | Last contact: ${p.last_contact_date || 'Never'}\n`;
    }
  }
  return ctx;
}

async function fetchCoachingTrendsContext(supabase: any): Promise<string> {
  const { data: trends } = await supabase
    .from('coaching_trend_analyses')
    .select('id, rep_id, title, call_count, date_range_from, date_range_to, analysis_data, created_at')
    .order('created_at', { ascending: false })
    .limit(10);
  
  const { data: profiles } = await supabase.from('profiles').select('id, name');
  const nameMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

  let ctx = '## COACHING TRENDS\n';
  ctx += `Total trend analyses: ${trends?.length || 0}\n`;
  
  if (trends?.length) {
    for (const t of trends.slice(0, 10)) {
      ctx += `\n### ${t.title || 'Analysis'} — ${nameMap.get(t.rep_id) || 'Unknown'}\n`;
      ctx += `Period: ${t.date_range_from} to ${t.date_range_to} | Calls: ${t.call_count}\n`;
      if (t.analysis_data) {
        const data = typeof t.analysis_data === 'string' ? JSON.parse(t.analysis_data) : t.analysis_data;
        if (data.overall_summary) ctx += `Summary: ${data.overall_summary}\n`;
        if (data.key_strengths?.length) ctx += `Strengths: ${data.key_strengths.join(', ')}\n`;
        if (data.areas_for_improvement?.length) ctx += `Areas to improve: ${data.areas_for_improvement.join(', ')}\n`;
      }
    }
  }
  return ctx;
}

async function fetchPerformanceContext(supabase: any): Promise<string> {
  const { data: summary } = await supabase.rpc('get_performance_summary', { p_hours: 24 });
  
  let ctx = '## PERFORMANCE METRICS (Last 24h)\n';
  if (summary?.length) {
    for (const m of summary) {
      ctx += `- ${m.metric_type}/${m.metric_name}: avg=${m.avg_duration_ms}ms p50=${m.p50_duration_ms}ms p90=${m.p90_duration_ms}ms errors=${m.error_count}/${m.total_count} (${m.error_rate}%)\n`;
    }
  } else {
    ctx += 'No performance data in the last 24 hours.\n';
  }
  return ctx;
}

// Fetch ALL context in parallel for full platform visibility
async function fetchAllContext(supabase: any, pageContext: string): Promise<string> {
  const fetchers = [
    { name: 'dashboard', fn: () => fetchDashboardContext(supabase) },
    { name: 'users', fn: () => fetchUsersContext(supabase) },
    { name: 'teams', fn: () => fetchTeamsContext(supabase) },
    { name: 'accounts', fn: () => fetchAccountsContext(supabase) },
    { name: 'callHistory', fn: () => fetchCallHistoryContext(supabase) },
    { name: 'coachHistory', fn: () => fetchCoachHistoryContext(supabase) },
    { name: 'coachingTrends', fn: () => fetchCoachingTrendsContext(supabase) },
    { name: 'performance', fn: () => fetchPerformanceContext(supabase) },
  ];

  const results = await Promise.allSettled(fetchers.map(f => f.fn()));

  const sections: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled' && result.value) {
      sections.push(result.value);
    } else if (result.status === 'rejected') {
      console.warn(`[admin-assistant] Fetcher '${fetchers[i].name}' failed:`, result.reason);
    }
  }

  return sections.join('\n\n');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: validation.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages, page_context } = validation.data;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfter || 60) } }
      );
    }

    // Fetch ALL platform context in parallel
    console.log(`[admin-assistant] Fetching all context (current page: ${page_context})`);
    const contextData = await fetchAllContext(supabase, page_context);

    // Call OpenAI
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    console.log(`[admin-assistant] Calling GPT-5.2 with ${messages.length} messages, page: ${page_context}`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2-2025-12-11',
        messages: [
          { role: 'system', content: `${SYSTEM_PROMPT}\n\nThe admin is currently viewing: ${page_context}\nPrioritize data relevant to this page when answering, but you have visibility into ALL platform data below.\n\n## PLATFORM DATA\n${contextData}` },
          ...messages.slice(-20),
        ],
        stream: true,
        max_completion_tokens: 32768,
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[admin-assistant] OpenAI error:', aiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[admin-assistant] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
