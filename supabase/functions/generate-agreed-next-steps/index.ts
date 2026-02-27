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

const requestSchema = z.object({
  prospect_id: z.string().uuid({ message: "Invalid prospect_id UUID format" })
});

const SYSTEM_PROMPT = `You are a senior sales analyst extracting MUTUALLY AGREED next steps from sales call transcripts and email communications.

Your job is to identify what both the sales rep AND the prospect have explicitly agreed to as next steps. This must be a mutual commitment, not just something the rep suggested.

Look for next steps in:
1. **Call Transcripts** (primary source) - verbal commitments made during calls
2. **Email Communications** - often confirms, schedules, or clarifies what was discussed on calls

Types of next steps to identify:
1. **Scheduled Meetings**: Specific dates/times agreed for follow-up calls, demos, or meetings
2. **Pending Actions**: Clear commitments like "I'll discuss with my team and get back to you by Friday"
3. **Awaiting Response**: When prospect said they'll respond/provide something by a certain time

IMPORTANT:
- Only include AGREED commitments - both parties must have acknowledged the next step
- Prioritize the MOST RECENT communication's next steps
- If a meeting date/time is mentioned in an email (like a calendar confirmation), use that
- Include who owns the next action (rep must follow up, or prospect will respond)
- Extract a direct quote from the transcript or email as evidence

If no clear next steps were agreed, indicate that with type="none".`;

interface AgreedNextSteps {
  type: 'scheduled_meeting' | 'pending_action' | 'awaiting_response' | 'none';
  meeting_date?: string;
  meeting_time?: string;
  meeting_agenda?: string;
  summary?: string;
  who_owns_next_action?: 'rep' | 'prospect' | 'both';
  confidence: 'high' | 'medium' | 'low';
  evidence_quote?: string;
  extracted_at: string;
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

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({ path: err.path.join('.'), message: err.message }));
      console.warn('[generate-agreed-next-steps] Validation failed:', errors);
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { prospect_id } = validation.data;
    console.log(`[generate-agreed-next-steps] Starting for prospect: ${prospect_id}`);

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

    // Fetch recent calls and emails in parallel
    const [callsResult, emailsResult] = await Promise.all([
      supabase
        .from('call_transcripts')
        .select('id, call_date, call_type, raw_text, account_name')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .order('call_date', { ascending: false })
        .limit(5),
      supabase
        .from('email_logs')
        .select('id, email_date, direction, subject, body, contact_name')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .order('email_date', { ascending: false })
        .limit(10)
    ]);

    const { data: calls, error: callsError } = callsResult;
    const { data: emails, error: emailsError } = emailsResult;

    if (callsError) {
      console.error('[generate-agreed-next-steps] Failed to fetch calls:', callsError);
      throw new Error('Failed to fetch calls');
    }

    if (emailsError) {
      console.warn('[generate-agreed-next-steps] Failed to fetch emails:', emailsError);
      // Continue without emails - not critical
    }

    const hasData = (calls && calls.length > 0) || (emails && emails.length > 0);
    if (!hasData) {
      console.log('[generate-agreed-next-steps] No calls or emails found');
      const noDataResult: AgreedNextSteps = {
        type: 'none',
        summary: 'No calls or emails recorded yet',
        confidence: 'high',
        extracted_at: new Date().toISOString()
      };
      return new Response(JSON.stringify({ success: true, next_steps: noDataResult }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Build context with transcripts and emails (most recent first)
    let contextPrompt = '';
    
    if (calls && calls.length > 0) {
      contextPrompt += `# RECENT CALLS (most recent first)\n\n`;
      for (const call of calls) {
        contextPrompt += `## ${call.call_date} - ${call.call_type || 'Sales Call'}
Account: ${call.account_name || 'Unknown'}
--- TRANSCRIPT ---
${call.raw_text}
--- END TRANSCRIPT ---

`;
      }
    }

    if (emails && emails.length > 0) {
      contextPrompt += `\n# RECENT EMAILS (most recent first)\n\n`;
      for (const email of emails) {
        const directionLabel = email.direction === 'sent' ? 'SENT to' : 'RECEIVED from';
        contextPrompt += `## ${email.email_date} - ${directionLabel} ${email.contact_name || 'Unknown'}
Subject: ${email.subject || '(no subject)'}
--- EMAIL BODY ---
${email.body}
--- END EMAIL ---

`;
      }
    }

    contextPrompt += `\nBased on these communications (prioritizing the most recent), extract the mutually agreed next steps.`;

    console.log(`[generate-agreed-next-steps] Processing ${calls?.length || 0} calls, ${emails?.length || 0} emails, ~${contextPrompt.length} chars`);

    // Call AI
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    try {
      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: 'gpt-5.2',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: contextPrompt }
          ],
          tools: [{
            type: 'function',
            function: {
              name: 'submit_agreed_next_steps',
              description: 'Submit the extracted agreed next steps',
              parameters: {
                type: 'object',
                properties: {
                  type: { 
                    type: 'string', 
                    enum: ['scheduled_meeting', 'pending_action', 'awaiting_response', 'none'],
                    description: 'Type of next step agreed upon'
                  },
                  meeting_date: { type: 'string', description: 'Date of scheduled meeting (YYYY-MM-DD or natural language like "Friday, January 19")' },
                  meeting_time: { type: 'string', description: 'Time of scheduled meeting (e.g., "10:30 AM")' },
                  meeting_agenda: { type: 'string', description: 'What will be discussed in the meeting' },
                  summary: { type: 'string', description: 'Summary of the agreed next step (e.g., "Prospect will discuss internally and respond by Friday")' },
                  who_owns_next_action: { 
                    type: 'string', 
                    enum: ['rep', 'prospect', 'both'],
                    description: 'Who has the ball - who needs to take the next action'
                  },
                  confidence: { 
                    type: 'string', 
                    enum: ['high', 'medium', 'low'],
                    description: 'Confidence in this extraction'
                  },
                  evidence_quote: { type: 'string', description: 'Direct quote from transcript supporting this next step' }
                },
                required: ['type', 'confidence']
              }
            }
          }],
          tool_choice: { type: 'function', function: { name: 'submit_agreed_next_steps' } }
        })
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[generate-agreed-next-steps] AI Gateway error:', aiResponse.status, errorText);
        throw new Error(`AI Gateway error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      let nextSteps: AgreedNextSteps = {
        type: 'none',
        confidence: 'low',
        extracted_at: new Date().toISOString()
      };

      if (toolCall?.function?.arguments) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          nextSteps = {
            ...parsed,
            extracted_at: new Date().toISOString()
          };
        } catch (e) {
          console.error('[generate-agreed-next-steps] Failed to parse AI response:', e);
        }
      }

      console.log(`[generate-agreed-next-steps] Extracted: type=${nextSteps.type}, confidence=${nextSteps.confidence}`);

      // Save to prospect.ai_extracted_info
      const { data: prospect, error: fetchError } = await supabase
        .from('prospects')
        .select('ai_extracted_info')
        .eq('id', prospect_id)
        .single();

      if (fetchError) {
        console.error('[generate-agreed-next-steps] Failed to fetch prospect:', fetchError);
        throw new Error('Failed to fetch prospect');
      }

      const currentInfo = (prospect?.ai_extracted_info || {}) as Record<string, unknown>;
      const updatedInfo = {
        ...currentInfo,
        agreed_next_steps: nextSteps
      };

      const { error: updateError } = await supabase
        .from('prospects')
        .update({ 
          ai_extracted_info: updatedInfo,
          updated_at: new Date().toISOString()
        })
        .eq('id', prospect_id);

      if (updateError) {
        console.error('[generate-agreed-next-steps] Failed to update prospect:', updateError);
        throw new Error('Failed to save next steps');
      }

      console.log(`[generate-agreed-next-steps] Completed successfully`);
      return new Response(JSON.stringify({ success: true, next_steps: nextSteps }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[generate-agreed-next-steps] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }),
      { status: 500, headers: { ...getCorsHeaders(req.headers.get('Origin')), 'Content-Type': 'application/json' } }
    );
  }
});
