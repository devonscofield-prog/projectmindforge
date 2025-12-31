import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

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

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://lovable.dev',
    'https://www.lovable.dev',
  ];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    const cleanDomain = customDomain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/+$/, '')
      .trim();
    
    if (cleanDomain) {
      allowedOrigins.push(`https://${cleanDomain}`);
      allowedOrigins.push(`https://www.${cleanDomain}`);
    }
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || 
    devPatterns.some(pattern => pattern.test(requestOrigin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Zod validation schemas
const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1, "Message content cannot be empty").max(50000, "Message too long")
});

const salesAssistantChatSchema = z.object({
  messages: z.array(chatMessageSchema).min(1, "At least one message required").max(50, "Too many messages")
});

const SALES_ASSISTANT_SYSTEM_PROMPT = `You are a strategic AI Sales Assistant with complete visibility into this rep's entire pipeline - all accounts, calls, follow-ups, and performance data.

Your Role:
- Provide holistic pipeline analysis and recommendations
- Identify high-priority accounts that need immediate attention
- Spot patterns across accounts (common objections, winning strategies)
- Help with weekly planning and time allocation
- Surface missed follow-ups and stale deals
- Forecast pipeline health and identify at-risk deals

Your Personality:
- Strategic and data-driven - back up insights with specific data from their pipeline
- Proactive - surface issues they haven't asked about yet
- Action-oriented - every insight should lead to a concrete next step
- Supportive but direct - celebrate wins while pushing for improvement

When Responding:
- Reference specific accounts, deals, and data points
- Prioritize by impact - focus on highest-value opportunities first
- Be concise but thorough - busy reps need actionable summaries
- If asked about a specific account, provide deep context
- Suggest cross-account strategies when patterns emerge

You have access to:
- All active and historical accounts
- Call history and AI analysis across all accounts
- Pending follow-ups and their priorities
- Pipeline values and heat scores
- Stakeholder information across accounts`;

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = salesAssistantChatSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[sales-assistant-chat] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { messages } = validation.data;

    console.log(`[sales-assistant-chat] Starting global assistant chat`);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for data access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user and check rate limit
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.log(`[sales-assistant-chat] Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    // Fetch ALL rep's data in parallel
    const [
      { data: prospects },
      { data: recentCalls },
      { data: followUps },
      { data: stakeholders }
    ] = await Promise.all([
      supabase.from('prospects')
        .select('id, prospect_name, account_name, status, heat_score, account_heat_score, active_revenue, potential_revenue, last_contact_date, industry, ai_extracted_info')
        .eq('rep_id', user.id)
        .is('deleted_at', null)
        .order('last_contact_date', { ascending: false, nullsFirst: false }),
      supabase.from('call_transcripts')
        .select('id, call_date, call_type, account_name, prospect_id, analysis_status')
        .eq('rep_id', user.id)
        .is('deleted_at', null)
        .order('call_date', { ascending: false })
        .limit(30),
      supabase.from('account_follow_ups')
        .select('id, title, description, priority, status, category, prospect_id, created_at')
        .eq('rep_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
      supabase.from('stakeholders')
        .select('id, name, job_title, prospect_id, influence_level, champion_score, is_primary_contact')
        .eq('rep_id', user.id)
        .is('deleted_at', null)
    ]);

    // Get analyses for recent calls
    const callIds = (recentCalls || []).map(c => c.id);
    let analyses: Record<string, any> = {};
    
    if (callIds.length > 0) {
      const { data: analysisData } = await supabase
        .from('ai_call_analysis')
        .select('call_id, call_summary, coach_output')
        .in('call_id', callIds);
      
      if (analysisData) {
        for (const a of analysisData) {
          analyses[a.call_id] = a;
        }
      }
    }

    // Build comprehensive pipeline context
    const contextPrompt = buildPipelineContext(
      prospects || [],
      recentCalls || [],
      analyses,
      followUps || [],
      stakeholders || []
    );

    // Get product knowledge context
    let productContext = '';
    try {
      const { data: productChunks } = await supabase.rpc('find_product_knowledge', {
        query_text: messages[messages.length - 1]?.content || null,
        match_count: 4,
      });
      if (productChunks?.length) {
        productContext = '\n\n--- PRODUCT KNOWLEDGE ---\n';
        for (const chunk of productChunks.slice(0, 4)) {
          productContext += `${chunk.chunk_text}\n\n`;
        }
        productContext += '--- END PRODUCT KNOWLEDGE ---\n';
      }
    } catch (err) {
      console.warn('[sales-assistant-chat] Product knowledge retrieval warning:', err);
    }

    // Call OpenAI API directly for GPT 5.2
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    console.log(`[sales-assistant-chat] Calling OpenAI API (GPT 5.2) with ${messages.length} messages`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2',
        messages: [
          { 
            role: 'system', 
            content: `${SALES_ASSISTANT_SYSTEM_PROMPT}\n\n## PIPELINE CONTEXT\n${contextPrompt}${productContext}` 
          },
          ...messages.slice(-20) // Limit conversation history
        ],
        stream: true,
        max_completion_tokens: 4096,
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[sales-assistant-chat] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[sales-assistant-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildPipelineContext(
  prospects: any[],
  calls: any[],
  analyses: Record<string, any>,
  followUps: any[],
  stakeholders: any[]
): string {
  // Create lookup maps
  const prospectMap = new Map(prospects.map(p => [p.id, p]));
  const stakeholdersByProspect = new Map<string, any[]>();
  for (const s of stakeholders) {
    const list = stakeholdersByProspect.get(s.prospect_id) || [];
    list.push(s);
    stakeholdersByProspect.set(s.prospect_id, list);
  }
  
  // Calculate pipeline stats
  const activeProspects = prospects.filter(p => p.status === 'active');
  const hotDeals = activeProspects.filter(p => (p.account_heat_score ?? p.heat_score ?? 0) >= 70);
  const warmDeals = activeProspects.filter(p => {
    const score = p.account_heat_score ?? p.heat_score ?? 0;
    return score >= 40 && score < 70;
  });
  const coldDeals = activeProspects.filter(p => (p.account_heat_score ?? p.heat_score ?? 0) < 40);
  const totalPipeline = activeProspects.reduce((sum, p) => sum + (p.active_revenue || p.potential_revenue || 0), 0);
  
  // Find stale accounts (no contact in 14+ days)
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const staleAccounts = activeProspects.filter(p => {
    if (!p.last_contact_date) return true;
    return new Date(p.last_contact_date) < twoWeeksAgo;
  });
  
  // Group follow-ups by priority
  const highPriorityFollowUps = followUps.filter(f => f.priority === 'high');
  const mediumPriorityFollowUps = followUps.filter(f => f.priority === 'medium');

  let context = `### PIPELINE SUMMARY
Total Accounts: ${prospects.length} (${activeProspects.length} active)
Pipeline Value: $${totalPipeline.toLocaleString()}
Hot Deals (70+): ${hotDeals.length}
Warm Deals (40-69): ${warmDeals.length}
Cold Deals (<40): ${coldDeals.length}
Stale Accounts (14+ days no contact): ${staleAccounts.length}
Pending Follow-ups: ${followUps.length} (${highPriorityFollowUps.length} high priority)
`;

  // High priority follow-ups
  if (highPriorityFollowUps.length > 0) {
    context += `\n### HIGH PRIORITY FOLLOW-UPS\n`;
    for (const f of highPriorityFollowUps.slice(0, 8)) {
      const prospect = prospectMap.get(f.prospect_id);
      context += `- [${prospect?.account_name || 'Unknown'}] ${f.title}\n`;
      if (f.description) context += `  ${f.description.substring(0, 100)}...\n`;
    }
  }

  // Stale accounts that need attention
  if (staleAccounts.length > 0) {
    context += `\n### STALE ACCOUNTS (Need Attention)\n`;
    for (const p of staleAccounts.slice(0, 6)) {
      const daysSince = p.last_contact_date 
        ? Math.floor((Date.now() - new Date(p.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
        : 'Never contacted';
      context += `- ${p.account_name || p.prospect_name}: ${typeof daysSince === 'number' ? `${daysSince} days` : daysSince}`;
      if (p.active_revenue) context += ` ($${p.active_revenue.toLocaleString()})`;
      context += '\n';
    }
  }

  // Hot deals details
  if (hotDeals.length > 0) {
    context += `\n### HOT DEALS (Score 70+)\n`;
    for (const p of hotDeals.slice(0, 6)) {
      const score = p.account_heat_score ?? p.heat_score ?? 0;
      const stks = stakeholdersByProspect.get(p.id) || [];
      context += `- **${p.account_name || p.prospect_name}** (Heat: ${score})`;
      if (p.active_revenue) context += ` - $${p.active_revenue.toLocaleString()}`;
      context += `\n  Stakeholders: ${stks.length}`;
      const champion = stks.find(s => s.champion_score && s.champion_score >= 7);
      if (champion) context += ` (Champion: ${champion.name})`;
      context += '\n';
    }
  }

  // All active accounts summary
  context += `\n### ALL ACTIVE ACCOUNTS\n`;
  for (const p of activeProspects.slice(0, 15)) {
    const score = p.account_heat_score ?? p.heat_score ?? 0;
    const followUpCount = followUps.filter(f => f.prospect_id === p.id).length;
    context += `- ${p.account_name || p.prospect_name}: Heat ${score}`;
    if (p.active_revenue) context += `, $${p.active_revenue.toLocaleString()}`;
    if (followUpCount > 0) context += `, ${followUpCount} pending tasks`;
    if (p.industry) context += ` [${p.industry}]`;
    context += '\n';
  }

  // Recent calls
  context += `\n### RECENT CALLS (Last 30)\n`;
  for (const call of calls.slice(0, 10)) {
    const analysis = analyses[call.id];
    context += `- ${call.call_date}: ${call.account_name || 'Unknown'} (${call.call_type || 'Call'})`;
    if (analysis?.call_summary) {
      context += `\n  Summary: ${analysis.call_summary.substring(0, 150)}...`;
    }
    context += '\n';
  }

  // Medium priority follow-ups
  if (mediumPriorityFollowUps.length > 0) {
    context += `\n### OTHER PENDING FOLLOW-UPS\n`;
    for (const f of mediumPriorityFollowUps.slice(0, 6)) {
      const prospect = prospectMap.get(f.prospect_id);
      context += `- [${prospect?.account_name || 'Unknown'}] ${f.title}\n`;
    }
  }

  return context;
}
