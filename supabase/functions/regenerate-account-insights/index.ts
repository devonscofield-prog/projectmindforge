import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

// Rate limiting
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function cleanupRateLimitEntries(): void {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
      cleaned++;
      if (cleaned >= 10) break;
    }
  }
}

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  cleanupRateLimitEntries();
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

import { getCorsHeaders } from "../_shared/cors.ts";

const regenerateInsightsSchema = z.object({
  prospect_id: z.string().uuid({ message: "Invalid prospect_id UUID format" })
});

// AI-native system prompt - reads ALL raw data directly
const INSIGHTS_SYSTEM_PROMPT = `You are a senior B2B sales analyst reading complete raw call transcripts and emails to extract comprehensive account insights.

You will receive the COMPLETE RAW TRANSCRIPTS of all calls with this account, plus full email bodies. Read them carefully to understand:
- The company's business, industry, and current situation
- Specific pain points and challenges mentioned
- The decision process, stakeholders, and buying signals
- Objections raised and how they were handled
- Competitive mentions and positioning
- Relationship trajectory and engagement patterns
- Deal blockers and stall signals
- Champion signals and internal advocacy evidence

Extract and synthesize:

1. **business_context**: 2-3 sentences summarizing the company, industry, and current situation based on all communications.

2. **pain_points**: Array of SPECIFIC pain points from the transcripts (not generic - quote or paraphrase actual statements).

3. **decision_process**: 
   - stakeholders: Key people involved (from call mentions and email threads)
   - timeline: Any timeline or urgency signals
   - budget_signals: Budget/pricing discussions

4. **competitors_mentioned**: Array of competitor names from any communication.

5. **communication_summary**: 2-3 sentences on recent communication patterns and relationship health.

6. **key_opportunities**: 2-3 specific opportunities based on pain-solution alignment.

7. **relationship_health**: Assessment of overall relationship trajectory.

8. **industry**: Best guess (education, local_government, state_government, federal_government, healthcare, msp, technology, finance, manufacturing, retail, nonprofit, other).

9. **deal_blockers**: Array of specific obstacles identified from conversations (e.g., "CFO hasn't approved budget", "Legal review pending").

10. **champion_signals**: Evidence of internal advocacy from conversations (e.g., "Sarah mentioned she's been pitching this internally").

11. **buying_signals**: Positive indicators toward close (e.g., "Asked about implementation timeline", "Requested pricing for 500 users").

12. **stall_signals**: Negative indicators or ghosting patterns (e.g., "No response to last 3 emails", "Keeps postponing demo").

13. **relationship_trajectory**: "improving" | "stable" | "declining" | "stalled"

14. **next_best_action**: Single most important thing to do to advance this deal.

Base everything on actual data. Quote or reference specific conversations when relevant.`;

interface AccountInsights {
  business_context?: string;
  pain_points?: string[];
  decision_process?: { stakeholders?: string[]; timeline?: string; budget_signals?: string };
  competitors_mentioned?: string[];
  communication_summary?: string;
  key_opportunities?: string[];
  relationship_health?: string;
  industry?: string;
  last_analyzed_at?: string;
  deal_blockers?: string[];
  champion_signals?: string[];
  buying_signals?: string[];
  stall_signals?: string[];
  relationship_trajectory?: 'improving' | 'stable' | 'declining' | 'stalled';
  next_best_action?: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      const errors = validation.error.errors.map(err => ({ path: err.path.join('.'), message: err.message }));
      console.warn('[regenerate-account-insights] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prospect_id } = validation.data;
    console.log(`[regenerate-account-insights] Starting AI-native analysis for prospect: ${prospect_id}`);

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfter || 60) } }
      );
    }

    // Fetch all data in parallel
    const [prospectResult, callsResult, stakeholdersResult, emailsResult] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts').select('id, call_date, call_type, raw_text, account_name').eq('prospect_id', prospect_id).is('deleted_at', null).order('call_date', { ascending: true }),
      supabase.from('stakeholders').select('id, name, job_title, influence_level, champion_score, is_primary_contact, email').eq('prospect_id', prospect_id),
      supabase.from('email_logs').select('direction, subject, body, email_date, contact_name, notes').eq('prospect_id', prospect_id).order('email_date', { ascending: true })
    ]);

    if (prospectResult.error || !prospectResult.data) {
      console.error('[regenerate-account-insights] Prospect not found:', prospectResult.error);
      return new Response(JSON.stringify({ error: 'Prospect not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prospect = prospectResult.data;
    const calls = callsResult.data || [];
    const stakeholders = stakeholdersResult.data || [];
    const emailLogs = emailsResult.data || [];

    // If no data, return success with message
    if (calls.length === 0 && emailLogs.length === 0) {
      console.log('[regenerate-account-insights] No data to analyze');
      return new Response(JSON.stringify({ success: true, message: 'No data to analyze' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build comprehensive context with ALL raw transcripts
    const contextPrompt = buildInsightsPrompt(prospect, calls, stakeholders, emailLogs);
    
    console.log(`[regenerate-account-insights] Context built: ${calls.length} calls, ${emailLogs.length} emails, ~${contextPrompt.length} chars`);

    // Call AI with 60-second timeout
    const LOVABLE_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'google/gemini-3-pro-preview',
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
                  business_context: { type: 'string' },
                  pain_points: { type: 'array', items: { type: 'string' } },
                  decision_process: {
                    type: 'object',
                    properties: {
                      stakeholders: { type: 'array', items: { type: 'string' } },
                      timeline: { type: 'string' },
                      budget_signals: { type: 'string' }
                    }
                  },
                  competitors_mentioned: { type: 'array', items: { type: 'string' } },
                  communication_summary: { type: 'string' },
                  key_opportunities: { type: 'array', items: { type: 'string' } },
                  relationship_health: { type: 'string' },
                  industry: { type: 'string', enum: ['education', 'local_government', 'state_government', 'federal_government', 'healthcare', 'msp', 'technology', 'finance', 'manufacturing', 'retail', 'nonprofit', 'other'] },
                  deal_blockers: { type: 'array', items: { type: 'string' }, description: 'Specific obstacles identified' },
                  champion_signals: { type: 'array', items: { type: 'string' }, description: 'Evidence of internal advocacy' },
                  buying_signals: { type: 'array', items: { type: 'string' }, description: 'Positive indicators toward close' },
                  stall_signals: { type: 'array', items: { type: 'string' }, description: 'Negative indicators or ghosting' },
                  relationship_trajectory: { type: 'string', enum: ['improving', 'stable', 'declining', 'stalled'] },
                  next_best_action: { type: 'string', description: 'Single most important action' }
                },
                required: ['business_context']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'submit_account_insights' } }
        })
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[regenerate-account-insights] AI Gateway error:', aiResponse.status, errorText);
        throw new Error(`AI Gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      let insights: AccountInsights = {};
      if (toolCall?.function?.arguments) {
        try {
          insights = JSON.parse(toolCall.function.arguments);
          insights.last_analyzed_at = new Date().toISOString();
        } catch (e) {
          console.error('[regenerate-account-insights] Failed to parse AI response:', e);
        }
      }

      console.log(`[regenerate-account-insights] AI extracted insights with ${Object.keys(insights).length} fields`);

      // Update prospect with insights
      const updateData: Record<string, unknown> = {
        ai_extracted_info: insights,
        updated_at: new Date().toISOString()
      };
      
      // Auto-populate industry if not set
      if (insights.industry && !prospect.industry) {
        updateData.industry = insights.industry;
        console.log(`[regenerate-account-insights] Auto-setting industry: ${insights.industry}`);
      }
      
      const { error: updateError } = await supabase.from('prospects').update(updateData).eq('id', prospect_id);

      if (updateError) {
        console.error('[regenerate-account-insights] Failed to update prospect:', updateError);
        throw new Error('Failed to save insights');
      }

      console.log(`[regenerate-account-insights] Completed successfully`);
      return new Response(JSON.stringify({ success: true, insights }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[regenerate-account-insights] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' } }
    );
  }
});

function buildInsightsPrompt(
  prospect: any,
  calls: any[],
  stakeholders: any[],
  emailLogs: any[]
): string {
  let prompt = `# ACCOUNT: ${prospect.account_name || prospect.prospect_name}
Status: ${prospect.status}
Heat Score: ${prospect.account_heat_score || prospect.heat_score || 'Unknown'}/100
Potential Revenue: ${prospect.potential_revenue ? `$${prospect.potential_revenue.toLocaleString()}` : 'Unknown'}
Active Revenue: ${prospect.active_revenue ? `$${prospect.active_revenue.toLocaleString()}` : 'None'}

## STAKEHOLDERS (${stakeholders.length})
`;

  for (const s of stakeholders) {
    prompt += `- ${s.name}${s.job_title ? ` (${s.job_title})` : ''} - ${s.influence_level || 'unknown'}${s.champion_score ? `, Champion: ${s.champion_score}/10` : ''}${s.is_primary_contact ? ' [PRIMARY]' : ''}\n`;
  }

  prompt += `\n## RAW CALL TRANSCRIPTS (${calls.length} calls, oldest to newest)\n`;
  prompt += `Read each transcript carefully to extract insights.\n\n`;
  
  for (const call of calls) {
    prompt += `### CALL: ${call.call_date} - ${call.call_type || 'Sales Call'}
Account: ${call.account_name || 'Unknown'}
--- TRANSCRIPT START ---
${call.raw_text}
--- TRANSCRIPT END ---

`;
  }

  prompt += `## EMAIL COMMUNICATIONS (${emailLogs.length} emails, oldest to newest)\n`;
  for (const email of emailLogs) {
    const direction = email.direction === 'outbound' ? '→ SENT' : '← RECEIVED';
    prompt += `### ${email.email_date} ${direction}${email.contact_name ? ` (${email.contact_name})` : ''}
Subject: ${email.subject || '(no subject)'}
${email.body}
${email.notes ? `Rep Notes: ${email.notes}` : ''}

`;
  }

  prompt += `\n---\nBased on ALL the above raw data, extract comprehensive account insights. Quote or reference specific conversations when relevant.`;
  
  return prompt;
}
