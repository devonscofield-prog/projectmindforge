import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Rate limiting: 10 requests per minute per user
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

async function updateJobStatus(
  supabase: SupabaseClient,
  jobId: string | null,
  status: 'processing' | 'completed' | 'failed',
  error?: string
): Promise<void> {
  if (!jobId) return;
  
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (error) updates.error = error;
  if (status === 'processing') updates.started_at = new Date().toISOString();
  if (status === 'completed' || status === 'failed') updates.completed_at = new Date().toISOString();
  
  await supabase.from('background_jobs').update(updates).eq('id', jobId);
}

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`, `https://www.${customDomain}`);
  }
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`, `https://www.${stormwindDomain}`);
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const generateFollowUpsSchema = z.object({
  prospect_id: z.string().uuid({ message: "Invalid prospect_id UUID format" }),
  job_id: z.string().uuid().optional()
});

// AI-native system prompt - reads ALL raw transcripts directly
const FOLLOW_UP_SYSTEM_PROMPT = `You are a 20-year B2B/SaaS sales veteran analyzing raw call transcripts and emails to generate actionable follow-up steps. You've closed hundreds of enterprise deals from $50K to $5M ARR.

You will receive the COMPLETE RAW TRANSCRIPTS of all calls with this account, plus full email bodies. Read them carefully to understand:
- What pains were discussed and their severity
- What solutions were pitched and how well they connected to pains
- What objections were raised and whether they were resolved
- What gaps exist in qualification (budget, authority, timeline, need)
- What the relationship trajectory looks like
- Any time-sensitive signals or urgency cues

GENERATE 3-7 SPECIFIC, ACTIONABLE FOLLOW-UP STEPS. Each should be something the rep can execute TODAY.

CATEGORIES:
- discovery: Uncover more info about pain, budget, timeline, decision process
- stakeholder: Expand multi-threading, engage decision makers, build champions
- objection: Address unresolved concerns with proof points, ROI data, references
- proposal: Advance toward commercial discussions, pricing, contracts
- relationship: Build champion strength, strengthen rapport, add value
- competitive: Counter competitive threats, differentiate, establish unique value

For each follow-up, provide:
- title: Action verb + specific outcome (max 60 chars)
- description: 1-2 sentences with context on WHY this matters
- priority: high/medium/low based on deal impact and urgency
- category: one of the above
- ai_reasoning: 2-3 sentences explaining your thinking
- urgency_signal: If there's a time-sensitive cue from the conversations, describe it. Otherwise null.
- related_evidence: Quote or paraphrase the specific conversation excerpt that drove this suggestion

Be direct. Be specific. Think like someone whose commission depends on this deal closing.`;

interface FollowUpSuggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  ai_reasoning: string;
  urgency_signal?: string | null;
  related_evidence?: string | null;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validation = generateFollowUpsSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({ path: err.path.join('.'), message: err.message }));
      console.warn('[generate-account-follow-ups] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prospect_id, job_id } = validation.data;
    console.log(`[generate-account-follow-ups] Starting AI-native analysis for prospect: ${prospect_id}`);
    
    await updateJobStatus(supabase, job_id || null, 'processing');

    // Auth check
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const isInternalServiceCall = token === supabaseServiceKey;

    if (!isInternalServiceCall) {
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const { data: { user }, error: authError } = await supabase.auth.getUser(token!);
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
    }

    // Update status
    await supabase.from('prospects').update({ follow_ups_generation_status: 'processing' }).eq('id', prospect_id);

    // Fetch all data in parallel
    const [prospectResult, callsResult, stakeholdersResult, emailsResult, existingFollowUpsResult] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts').select('id, call_date, call_type, raw_text, account_name').eq('prospect_id', prospect_id).is('deleted_at', null).order('call_date', { ascending: true }),
      supabase.from('stakeholders').select('id, name, job_title, influence_level, champion_score, is_primary_contact, email').eq('prospect_id', prospect_id),
      supabase.from('email_logs').select('direction, subject, body, email_date, contact_name, notes').eq('prospect_id', prospect_id).order('email_date', { ascending: true }),
      supabase.from('account_follow_ups').select('title, description').eq('prospect_id', prospect_id).eq('status', 'pending')
    ]);

    if (prospectResult.error || !prospectResult.data) {
      console.error('[generate-account-follow-ups] Prospect not found:', prospectResult.error);
      return new Response(JSON.stringify({ error: 'Prospect not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const prospect = prospectResult.data;
    const calls = callsResult.data || [];
    const stakeholders = stakeholdersResult.data || [];
    const emailLogs = emailsResult.data || [];
    const existingFollowUps = existingFollowUpsResult.data || [];

    // If no data, generate basic follow-up
    if (calls.length === 0 && emailLogs.length === 0) {
      console.log('[generate-account-follow-ups] No data, generating basic follow-up');
      
      await supabase.from('account_follow_ups').insert({
        prospect_id,
        rep_id: prospect.rep_id,
        title: 'Schedule initial discovery call',
        description: 'No calls recorded yet. Reach out to establish first contact and understand their current situation.',
        priority: 'high',
        category: 'discovery',
        ai_reasoning: 'Without any call data, the first priority is establishing contact. A discovery call will reveal pain points, timeline, and budget.',
        generated_from_call_ids: [],
        status: 'pending'
      });

      await supabase.from('prospects').update({ 
        follow_ups_generation_status: 'completed',
        follow_ups_last_generated_at: new Date().toISOString()
      }).eq('id', prospect_id);

      await updateJobStatus(supabase, job_id || null, 'completed');
      return new Response(JSON.stringify({ success: true, count: 1 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build comprehensive context with ALL raw transcripts
    const contextPrompt = buildContextPrompt(prospect, calls, stakeholders, emailLogs, existingFollowUps);
    
    console.log(`[generate-account-follow-ups] Context built: ${calls.length} calls, ${emailLogs.length} emails, ~${contextPrompt.length} chars`);

    // Call AI with 60-second timeout
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

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
            { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
            { role: 'user', content: contextPrompt }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'submit_follow_up_steps',
              description: 'Submit the generated follow-up steps',
              parameters: {
                type: 'object',
                properties: {
                  follow_ups: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                        category: { type: 'string', enum: ['discovery', 'stakeholder', 'objection', 'proposal', 'relationship', 'competitive'] },
                        ai_reasoning: { type: 'string' },
                        urgency_signal: { type: 'string', description: 'Time-sensitive cue from conversations, or null' },
                        related_evidence: { type: 'string', description: 'Quote or paraphrase from conversation that drove this suggestion' }
                      },
                      required: ['title', 'description', 'priority', 'category', 'ai_reasoning']
                    }
                  }
                },
                required: ['follow_ups']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'submit_follow_up_steps' } }
        })
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[generate-account-follow-ups] AI Gateway error:', aiResponse.status, errorText);
        throw new Error(`AI Gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      let followUps: FollowUpSuggestion[] = [];
      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          followUps = parsed.follow_ups || [];
        } catch (e) {
          console.error('[generate-account-follow-ups] Failed to parse AI response:', e);
        }
      }

      console.log(`[generate-account-follow-ups] AI generated ${followUps.length} follow-ups`);

      // Filter duplicates
      const existingTitles = new Set(existingFollowUps.map(f => f.title?.toLowerCase().trim()));
      const uniqueFollowUps = followUps.filter(f => !existingTitles.has(f.title?.toLowerCase().trim()));

      // Save to database
      const callIds = calls.map(c => c.id);
      for (const followUp of uniqueFollowUps) {
        await supabase.from('account_follow_ups').insert({
          prospect_id,
          rep_id: prospect.rep_id,
          title: followUp.title,
          description: followUp.description,
          priority: followUp.priority,
          category: followUp.category,
          ai_reasoning: followUp.ai_reasoning + (followUp.related_evidence ? `\n\n📝 Evidence: "${followUp.related_evidence}"` : '') + (followUp.urgency_signal ? `\n\n⏰ Urgency: ${followUp.urgency_signal}` : ''),
          generated_from_call_ids: callIds,
          status: 'pending'
        });
      }

      await supabase.from('prospects').update({ 
        follow_ups_generation_status: 'completed',
        follow_ups_last_generated_at: new Date().toISOString()
      }).eq('id', prospect_id);

      await updateJobStatus(supabase, job_id || null, 'completed');

      console.log(`[generate-account-follow-ups] Saved ${uniqueFollowUps.length} new follow-ups`);
      return new Response(JSON.stringify({ success: true, count: uniqueFollowUps.length }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    console.error('[generate-account-follow-ups] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' } }
    );
  }
});

function buildContextPrompt(
  prospect: any,
  calls: any[],
  stakeholders: any[],
  emailLogs: any[],
  existingFollowUps: any[]
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

  prompt += `\n## EXISTING PENDING FOLLOW-UPS (avoid duplicates)\n`;
  for (const f of existingFollowUps) {
    prompt += `- ${f.title}\n`;
  }

  prompt += `\n## RAW CALL TRANSCRIPTS (${calls.length} calls, oldest to newest)\n`;
  prompt += `Read each transcript carefully to understand pains, solutions pitched, objections, and gaps.\n\n`;
  
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

  prompt += `\n---\nBased on ALL the above data, generate 3-7 specific, actionable follow-up steps. Reference specific conversations when explaining your reasoning.`;
  
  return prompt;
}
