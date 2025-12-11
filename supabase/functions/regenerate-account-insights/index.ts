import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Rate limiting: 10 requests per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
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
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  
  // Allow custom domain from environment variable
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }
  
  // Allow StormWind domain from environment variable
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`);
    allowedOrigins.push(`https://www.${stormwindDomain}`);
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Zod validation schema
const regenerateInsightsSchema = z.object({
  prospect_id: z.string().uuid({ message: "Invalid prospect_id UUID format" })
});

// System prompt for generating consolidated account insights
const INSIGHTS_SYSTEM_PROMPT = `You are a senior B2B sales analyst. Your task is to analyze ALL available data about an account (calls, emails, stakeholders) and generate comprehensive, actionable insights.

Analyze the provided data and extract:

1. **business_context**: 2-3 sentences summarizing what this company does, their industry, and current situation based on all communications.

2. **pain_points**: Array of specific pain points or challenges mentioned across ALL communications (calls AND emails). Be specific - not "they need better software" but "struggling with manual data entry taking 4 hours daily".

3. **decision_process**: 
   - stakeholders: Key people involved in the decision (from calls, emails, and stakeholder data)
   - timeline: Any timeline or urgency signals mentioned
   - budget_signals: Any budget or pricing discussions

4. **competitors_mentioned**: Array of competitor names mentioned in any communication.

5. **communication_summary**: 2-3 sentences summarizing recent email exchanges and their tone/outcome. What's the current state of the conversation?

6. **key_opportunities**: Array of 2-3 specific opportunities identified from the data that the rep should pursue.

7. **relationship_health**: A brief assessment of the overall relationship based on communication patterns, response rates, and stakeholder engagement.

8. **industry**: Determine the most likely industry for this account based on the communications. Must be one of: education, local_government, state_government, federal_government, healthcare, msp, technology, finance, manufacturing, retail, nonprofit, other. Only set if you're confident based on evidence in the communications.

Be concise but specific. Base everything on actual data provided, don't make assumptions.`;

interface AccountInsights {
  business_context?: string;
  pain_points?: string[];
  current_state?: string;
  decision_process?: {
    stakeholders?: string[];
    timeline?: string;
    budget_signals?: string;
  };
  competitors_mentioned?: string[];
  communication_summary?: string;
  key_opportunities?: string[];
  relationship_health?: string;
  industry?: string;
  last_analyzed_at?: string;
  // V2 aggregated fields
  critical_gaps_summary?: { category: string; description: string; suggested_question?: string }[];
  competitors_summary?: { name: string; status?: string; positioning?: string }[];
  prospect_persona?: { disc?: string; archetype?: string; communication_style?: string; dos?: string[]; donts?: string[] };
  coaching_trend?: { avg_grade?: string; primary_focus_area?: string; recent_grades?: string[] };
  latest_heat_analysis?: { score: number; temperature: string; trend: string; recommended_action?: string };
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS
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

    const validation = regenerateInsightsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[regenerate-account-insights] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prospect_id } = validation.data;

    console.log(`[regenerate-account-insights] Starting for prospect: ${prospect_id}`);

    // Get auth token and verify user for rate limiting
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role
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
      console.log(`[regenerate-account-insights] Rate limit exceeded for user: ${user.id}`);
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

    // Fetch all data in parallel
    const [
      { data: prospect, error: prospectError },
      { data: calls },
      { data: stakeholders },
      { data: emailLogs }
    ] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts')
        .select('id, call_date, call_type, raw_text')
        .eq('prospect_id', prospect_id)
        .order('call_date', { ascending: false }),
      supabase.from('stakeholders')
        .select('id, name, job_title, influence_level, champion_score, is_primary_contact, email')
        .eq('prospect_id', prospect_id),
      supabase.from('email_logs')
        .select('direction, subject, body, email_date, contact_name, stakeholder_id, notes')
        .eq('prospect_id', prospect_id)
        .order('email_date', { ascending: false })
    ]);

    if (prospectError || !prospect) {
      console.error('[regenerate-account-insights] Prospect not found:', prospectError);
      return new Response(
        JSON.stringify({ error: 'Prospect not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI analyses for calls - now using V2 fields
    const callIds = (calls || []).map(c => c.id);
    let analyses: Record<string, any> = {};
    
    if (callIds.length > 0) {
      const { data: analysisData } = await supabase
        .from('ai_call_analysis')
        .select(`
          call_id, 
          call_summary, 
          analysis_metadata, 
          analysis_strategy, 
          analysis_psychology,
          analysis_coaching,
          deal_heat_analysis
        `)
        .in('call_id', callIds);
      
      if (analysisData) {
        analyses = analysisData.reduce((acc, a) => {
          acc[a.call_id] = a;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // If no data, return existing insights
    if ((calls || []).length === 0 && (emailLogs || []).length === 0) {
      console.log('[regenerate-account-insights] No data to analyze');
      return new Response(
        JSON.stringify({ success: true, message: 'No data to analyze' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context for AI
    const contextPrompt = buildInsightsPrompt(prospect, calls || [], analyses, stakeholders || [], emailLogs || []);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[regenerate-account-insights] Calling Lovable AI for analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: INSIGHTS_SYSTEM_PROMPT },
          { role: 'user', content: contextPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'submit_account_insights',
            description: 'Submit the analyzed account insights',
            parameters: {
              type: 'object',
              properties: {
                business_context: { type: 'string', description: '2-3 sentences about the company' },
                pain_points: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Specific pain points mentioned' 
                },
                decision_process: {
                  type: 'object',
                  properties: {
                    stakeholders: { type: 'array', items: { type: 'string' } },
                    timeline: { type: 'string' },
                    budget_signals: { type: 'string' }
                  }
                },
                competitors_mentioned: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: 'Competitor names mentioned' 
                },
                communication_summary: { type: 'string', description: 'Summary of recent communications' },
                key_opportunities: { 
                  type: 'array', 
                  items: { type: 'string' },
                  description: '2-3 specific opportunities' 
                },
                relationship_health: { type: 'string', description: 'Brief relationship assessment' },
                industry: { 
                  type: 'string', 
                  enum: ['education', 'local_government', 'state_government', 'federal_government', 'healthcare', 'msp', 'technology', 'finance', 'manufacturing', 'retail', 'nonprofit', 'other'],
                  description: 'The industry of the account based on communications'
                }
              },
              required: ['business_context']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'submit_account_insights' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[regenerate-account-insights] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[regenerate-account-insights] AI response received');

    // Extract insights from tool call
    let insights: AccountInsights = {};
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        insights = JSON.parse(toolCall.function.arguments);
        insights.last_analyzed_at = new Date().toISOString();
        
        // Merge V2 aggregated insights from analyses
        const v2Insights = extractV2Insights(analyses);
        insights = { ...insights, ...v2Insights };
        console.log('[regenerate-account-insights] Merged V2 insights:', Object.keys(v2Insights));
      } catch (e) {
        console.error('[regenerate-account-insights] Failed to parse tool arguments:', e);
      }
    }

    // Update prospect with new insights
    const updateData: Record<string, unknown> = {
      ai_extracted_info: insights,
      updated_at: new Date().toISOString()
    };
    
    // Auto-populate industry only if not already set on the prospect
    if (insights.industry && !prospect.industry) {
      updateData.industry = insights.industry;
      console.log(`[regenerate-account-insights] Auto-populating industry: ${insights.industry}`);
    }
    
    const { error: updateError } = await supabase
      .from('prospects')
      .update(updateData)
      .eq('id', prospect_id);

    if (updateError) {
      console.error('[regenerate-account-insights] Failed to update prospect:', updateError);
      throw new Error('Failed to save insights');
    }

    console.log(`[regenerate-account-insights] Completed successfully for prospect: ${prospect_id}`);

    return new Response(
      JSON.stringify({ success: true, insights }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[regenerate-account-insights] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildInsightsPrompt(
  prospect: any,
  calls: any[],
  analyses: Record<string, any>,
  stakeholders: any[],
  emailLogs: any[]
): string {
  const stakeholderMap = new Map(stakeholders.map(s => [s.id, s]));
  
  let prompt = `## ACCOUNT: ${prospect.account_name || prospect.prospect_name}
Status: ${prospect.status}
Heat Score: ${prospect.heat_score || 'Not rated'}/100
Potential Revenue: ${prospect.potential_revenue ? `$${prospect.potential_revenue.toLocaleString()}` : 'Unknown'}

## STAKEHOLDERS (${stakeholders.length})
`;

  for (const s of stakeholders) {
    prompt += `- ${s.name}${s.job_title ? ` (${s.job_title})` : ''} - ${s.influence_level || 'unknown influence'}${s.champion_score ? `, Champion: ${s.champion_score}/10` : ''}${s.is_primary_contact ? ' [PRIMARY]' : ''}\n`;
  }

  prompt += `\n## CALL HISTORY (${calls.length} calls)\n`;
  
  // Aggregate V2 data for summary
  const allCriticalGaps: any[] = [];
  const allCompetitors: any[] = [];
  const coachGrades: string[] = [];
  let latestPsychology: any = null;
  let latestHeat: any = null;
  
  for (const call of calls.slice(0, 10)) {
    const analysis = analyses[call.id];
    prompt += `\n### ${call.call_date} - ${call.call_type || 'Call'}\n`;
    
    if (analysis) {
      if (analysis.call_summary) prompt += `Summary: ${analysis.call_summary}\n`;
      
      // V2 Strategy data
      if (analysis.analysis_strategy) {
        const strategy = analysis.analysis_strategy;
        if (strategy.critical_gaps?.length) {
          prompt += `Critical Gaps: ${strategy.critical_gaps.map((g: any) => `[${g.category}] ${g.description}`).join('; ')}\n`;
          allCriticalGaps.push(...strategy.critical_gaps);
        }
        if (strategy.competitive_intel?.competitors?.length) {
          prompt += `Competitors: ${strategy.competitive_intel.competitors.map((c: any) => c.name).join(', ')}\n`;
          allCompetitors.push(...strategy.competitive_intel.competitors);
        }
      }
      
      // V2 Coaching data
      if (analysis.analysis_coaching?.overall_grade) {
        coachGrades.push(analysis.analysis_coaching.overall_grade);
        prompt += `Coach Grade: ${analysis.analysis_coaching.overall_grade}\n`;
      }
      
      // V2 Psychology data (take the latest)
      if (analysis.analysis_psychology && !latestPsychology) {
        latestPsychology = analysis.analysis_psychology;
        prompt += `Prospect DISC: ${analysis.analysis_psychology.disc_profile || 'Unknown'}\n`;
      }
      
      // Deal heat (take the latest)
      if (analysis.deal_heat_analysis && !latestHeat) {
        latestHeat = analysis.deal_heat_analysis;
        prompt += `Deal Heat: ${analysis.deal_heat_analysis.heat_score}/100 (${analysis.deal_heat_analysis.temperature})\n`;
      }
      
      // V2 Metadata
      if (analysis.analysis_metadata?.participants?.length) {
        const decisionMakers = analysis.analysis_metadata.participants.filter((p: any) => p.is_decision_maker);
        if (decisionMakers.length) {
          prompt += `Decision Makers: ${decisionMakers.map((p: any) => p.name).join(', ')}\n`;
        }
      }
    }
    
    // Include transcript excerpt (shorter now that we have rich analysis)
    const excerpt = call.raw_text.substring(0, 500);
    prompt += `Transcript excerpt: ${excerpt}${call.raw_text.length > 500 ? '...' : ''}\n`;
  }

  if (emailLogs.length > 0) {
    prompt += `\n## EMAIL COMMUNICATIONS (${emailLogs.length} emails)\n`;
    
    for (const email of emailLogs.slice(0, 10)) {
      const direction = email.direction === 'outgoing' ? 'SENT' : 'RECEIVED';
      const stakeholder = email.stakeholder_id ? stakeholderMap.get(email.stakeholder_id) : null;
      
      let contact = email.contact_name || '';
      if (stakeholder) {
        contact = `${stakeholder.name}${stakeholder.job_title ? ` (${stakeholder.job_title})` : ''}`;
      }
      
      prompt += `\n[${email.email_date}] ${direction}${contact ? ` - ${contact}` : ''}\n`;
      if (email.subject) prompt += `Subject: ${email.subject}\n`;
      const bodyExcerpt = email.body.substring(0, 500);
      prompt += `${bodyExcerpt}${email.body.length > 500 ? '...' : ''}\n`;
    }
  }

  prompt += `\n## TASK
Analyze ALL the data above and generate comprehensive account insights. Focus on:
1. Understanding their business and situation
2. Identifying ALL pain points mentioned
3. Mapping the decision process
4. Noting any competitors
5. Summarizing recent communication state
6. Identifying opportunities for the rep`;

  return prompt;
}

// Extract V2 aggregated insights from analyses
function extractV2Insights(analyses: Record<string, any>): Partial<AccountInsights> {
  const allCriticalGaps: any[] = [];
  const competitorMap = new Map<string, any>();
  const coachGrades: string[] = [];
  let latestPsychology: any = null;
  let latestHeat: any = null;
  let primaryFocusArea: string | undefined;
  
  for (const analysis of Object.values(analyses)) {
    // Aggregate critical gaps
    if (analysis.analysis_strategy?.critical_gaps?.length) {
      allCriticalGaps.push(...analysis.analysis_strategy.critical_gaps);
    }
    
    // Aggregate competitors (dedupe by name)
    if (analysis.analysis_strategy?.competitive_intel?.competitors?.length) {
      for (const comp of analysis.analysis_strategy.competitive_intel.competitors) {
        if (comp.name && !competitorMap.has(comp.name.toLowerCase())) {
          competitorMap.set(comp.name.toLowerCase(), comp);
        }
      }
    }
    
    // Coach grades
    if (analysis.analysis_coaching?.overall_grade) {
      coachGrades.push(analysis.analysis_coaching.overall_grade);
      if (!primaryFocusArea && analysis.analysis_coaching.primary_focus_area) {
        primaryFocusArea = analysis.analysis_coaching.primary_focus_area;
      }
    }
    
    // Latest psychology
    if (analysis.analysis_psychology && !latestPsychology) {
      latestPsychology = analysis.analysis_psychology;
    }
    
    // Latest heat
    if (analysis.deal_heat_analysis && !latestHeat) {
      latestHeat = analysis.deal_heat_analysis;
    }
  }
  
  const v2Insights: Partial<AccountInsights> = {};
  
  // Dedupe critical gaps by category+description
  const gapSet = new Set<string>();
  v2Insights.critical_gaps_summary = allCriticalGaps
    .filter(g => {
      const key = `${g.category}:${g.description}`;
      if (gapSet.has(key)) return false;
      gapSet.add(key);
      return true;
    })
    .slice(0, 5)
    .map(g => ({
      category: g.category,
      description: g.description,
      suggested_question: g.suggested_question,
    }));
  
  // Competitors summary
  if (competitorMap.size > 0) {
    v2Insights.competitors_summary = Array.from(competitorMap.values()).slice(0, 5).map(c => ({
      name: c.name,
      status: c.status,
      positioning: c.positioning || c.silver_bullet,
    }));
  }
  
  // Prospect persona
  if (latestPsychology) {
    v2Insights.prospect_persona = {
      disc: latestPsychology.disc_profile,
      archetype: latestPsychology.persona_archetype,
      communication_style: latestPsychology.communication_style?.preference,
      dos: latestPsychology.selling_dos,
      donts: latestPsychology.selling_donts,
    };
  }
  
  // Coaching trend
  if (coachGrades.length > 0) {
    v2Insights.coaching_trend = {
      avg_grade: coachGrades[0], // Most recent
      primary_focus_area: primaryFocusArea,
      recent_grades: coachGrades.slice(0, 5),
    };
  }
  
  // Latest heat
  if (latestHeat) {
    v2Insights.latest_heat_analysis = {
      score: latestHeat.heat_score,
      temperature: latestHeat.temperature,
      trend: latestHeat.trend,
      recommended_action: latestHeat.recommended_action,
    };
  }
  
  return v2Insights;
}
