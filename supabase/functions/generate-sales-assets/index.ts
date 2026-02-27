import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getCorsHeaders } from "../_shared/cors.ts";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const MAX_AI_RETRIES = 2;
const AI_RETRY_DELAY_MS = 1000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Input validation schema
const MAX_TRANSCRIPT_LENGTH = 500_000;

function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/\0/g, '').replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '[REMOVED]').trim();
}

const generateCallNotesSchema = z.object({
  call_id: z.string().uuid().optional(),
  transcript: z.string()
    .min(100, "Transcript too short")
    .max(MAX_TRANSCRIPT_LENGTH, `Transcript too long (max ${MAX_TRANSCRIPT_LENGTH} chars)`)
    .transform(sanitizeUserInput),
  strategic_context: z.object({
    strategic_threading: z.object({
      relevance_map: z.array(z.object({
        pain_identified: z.string().max(1000),
        feature_pitched: z.string().max(1500),
        is_relevant: z.boolean(),
        reasoning: z.string().max(1500)
      })).max(50).optional(),
      missed_opportunities: z.array(z.union([
        z.string().max(1000),
        z.object({
          pain: z.string().max(500),
          severity: z.enum(['High', 'Medium']),
          suggested_pitch: z.string().max(500),
          talk_track: z.string().max(1000)
        })
      ])).max(20).optional()
    }).optional(),
    critical_gaps: z.array(z.object({
      category: z.string().max(100),
      description: z.string().max(500),
      impact: z.string().max(100),
      suggested_question: z.string().max(500)
    })).max(20).optional()
  }).optional(),
  account_name: z.string().max(200).transform(sanitizeUserInput).optional(),
  stakeholder_name: z.string().max(200).transform(sanitizeUserInput).optional()
});

const CALL_NOTES_TOOL = {
  type: "function",
  function: {
    name: "generate_call_notes",
    description: "Generate internal CRM notes based on the call transcript and strategic context",
    parameters: {
      type: "object",
      properties: {
        internal_notes_markdown: {
          type: "string",
          description: `CRM-ready internal notes in markdown format. MUST use this exact structure with bold section headers and bullet points:

**Call Summary**
* One-sentence overview of the call purpose and outcome

**Key Discussion Points**
* Bullet 1: Important topic discussed
* Bullet 2: Another key point
* Bullet 3: Additional details

**Next Steps**
* Action item 1 with owner and deadline
* Action item 2 with owner and deadline

**Critical Gaps/Unknowns**
* Information still needed before deal can progress

**Competitor Intel**
* Any competitors mentioned and context (or "None mentioned" if not applicable)

**Deal Health**
* Current deal temperature (Hot/Warm/Cold) and reasoning`
        }
      },
      required: ["internal_notes_markdown"]
    }
  }
};

const CRM_NOTES_SYSTEM_PROMPT = `You are an expert Enterprise Sales professional creating internal CRM notes.

**YOUR TASK:** Create comprehensive, CRM-ready internal notes from the call transcript.

**NOTES STRUCTURE (use exactly):**
Use **bold headers** and bullet points for each section:

**Call Summary**
- One clear sentence on purpose and outcome

**Key Discussion Points**
- What topics were actually discussed
- Pain points mentioned
- Solutions proposed

**Next Steps**
- Specific action items with owners
- Deadlines when mentioned
- Follow-up commitments

**Critical Gaps/Unknowns**
- Information still needed to progress the deal
- Questions that need answers
- Missing stakeholders or approvals

**Competitor Intel**
- Any competitors mentioned by name
- Context of the mention (pricing comparison, feature comparison, etc.)
- Write "None mentioned" if no competitors came up

**Deal Health**
- Temperature: Hot/Warm/Cold
- Brief reasoning based on engagement, timeline, budget signals

**GUIDELINES:**
- Be specific and factual - use details from the call
- Include names, numbers, dates when available
- Focus on information useful for sales progression
- Keep each bullet concise but complete
- Use markdown formatting (bold, bullets)`;

interface CriticalGap {
  category: string;
  description: string;
  impact: string;
  suggested_question: string;
}

interface MissedOpportunityObject {
  pain: string;
  severity: 'High' | 'Medium';
  suggested_pitch: string;
  talk_track: string;
}

interface StrategicContext {
  strategic_threading?: {
    relevance_map?: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities?: Array<string | MissedOpportunityObject>;
  };
  critical_gaps?: CriticalGap[];
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
    const lovableApiKey = Deno.env.get('OPENAI_API_KEY');

    if (!lovableApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const validation = generateCallNotesSchema.safeParse(body);
    if (!validation.success) {
      const errors = validation.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message
      }));
      console.warn('[generate-sales-assets] Validation failed:', errors);
      return new Response(JSON.stringify({ error: 'Validation failed', issues: errors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { call_id, transcript, strategic_context, account_name, stakeholder_name } = validation.data;

    console.log(`[generate-sales-assets] Generating call notes for user ${user.id}${call_id ? `, call ${call_id}` : ''}`);

    // Build the context for the AI
    let contextSection = '';
    
    if (strategic_context) {
      const sc = strategic_context as StrategicContext;
      
      if (sc.strategic_threading?.relevance_map && sc.strategic_threading.relevance_map.length > 0) {
        contextSection += '\n\n**RELEVANCE MAP (Pain-to-Solution Connections):**\n';
        for (const mapping of sc.strategic_threading.relevance_map) {
          contextSection += `- Pain: "${mapping.pain_identified}" → Solution: "${mapping.feature_pitched}" (${mapping.is_relevant ? 'RELEVANT' : 'NOT RELEVANT'}: ${mapping.reasoning})\n`;
        }
      }
      
      if (sc.strategic_threading?.missed_opportunities && sc.strategic_threading.missed_opportunities.length > 0) {
        contextSection += '\n**MISSED OPPORTUNITIES (Pains not addressed):**\n';
        for (const missed of sc.strategic_threading.missed_opportunities) {
          if (typeof missed === 'string') {
            contextSection += `- ${missed}\n`;
          } else {
            contextSection += `- [${missed.severity}] ${missed.pain}\n`;
          }
        }
      }

      if (sc.critical_gaps && sc.critical_gaps.length > 0) {
        contextSection += '\n**CRITICAL GAPS (Information missing from this deal):**\n';
        for (const gap of sc.critical_gaps) {
          contextSection += `- [${gap.impact} Impact] ${gap.category}: ${gap.description}\n`;
        }
      }
    }

    const userPrompt = `Generate comprehensive internal CRM notes for this sales call.

${account_name ? `**Account:** ${account_name}` : ''}
${stakeholder_name ? `**Primary Contact:** ${stakeholder_name}` : ''}
${contextSection}

**CALL TRANSCRIPT:**
${transcript.substring(0, 30000)}`;

    // Retry logic for handling transient AI failures
    let callNotes;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_AI_RETRIES; attempt++) {
      if (attempt > 0) {
        console.warn(`[generate-sales-assets] Retry attempt ${attempt} after malformed response`);
        await delay(AI_RETRY_DELAY_MS);
      }

      const response = await fetch(OPENAI_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-5-mini',
          messages: [
            { role: 'system', content: CRM_NOTES_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt }
          ],
          tools: [CALL_NOTES_TOOL],
          tool_choice: { type: 'function', function: { name: 'generate_call_notes' } },
          max_completion_tokens: 4096,
          temperature: 0.5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[generate-sales-assets] AI Gateway error ${response.status}:`, errorText);
        
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
            status: 429,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const aiResponse = await response.json();
      const finishReason = aiResponse.choices?.[0]?.finish_reason;
      const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

      // Check for truncation due to token limit
      if (finishReason === 'length') {
        console.warn(`[generate-sales-assets] Attempt ${attempt + 1}: Response truncated due to token limit`);
        lastError = new Error(`Response truncated (attempt ${attempt + 1})`);
        continue;
      }

      // Check for malformed function call - retry if this occurs
      if (finishReason === 'MALFORMED_FUNCTION_CALL' || !toolCall) {
        console.warn(`[generate-sales-assets] Attempt ${attempt + 1}: Malformed response, finish_reason=${finishReason}`);
        lastError = new Error(`Malformed AI response (attempt ${attempt + 1})`);
        continue;
      }

      if (toolCall.function?.name !== 'generate_call_notes') {
        console.error('[generate-sales-assets] Unexpected tool call:', toolCall.function?.name);
        lastError = new Error('Unexpected tool call from AI');
        continue;
      }

      // Success - parse and break out of retry loop
      try {
        callNotes = JSON.parse(toolCall.function.arguments);
        break;
      } catch (parseError) {
        console.error('[generate-sales-assets] Failed to parse tool arguments:', parseError);
        lastError = new Error('Failed to parse AI response');
        continue;
      }
    }

    if (!callNotes) {
      throw lastError || new Error('Failed to generate call notes after all retries');
    }

    // Save to database if call_id is provided
    if (call_id) {
      console.log(`[generate-sales-assets] Saving notes to database for call ${call_id}`);
      
      const { error: updateError } = await supabase
        .from('ai_call_analysis')
        .update({
          sales_assets: { internal_notes_markdown: callNotes.internal_notes_markdown },
          sales_assets_generated_at: new Date().toISOString()
        })
        .eq('call_id', call_id);

      if (updateError) {
        console.error('[generate-sales-assets] Failed to save notes to database:', updateError);
        callNotes.save_error = 'Failed to persist notes to database';
      } else {
        console.log('[generate-sales-assets] Notes saved to database successfully');
        callNotes.saved = true;
      }
    }
    
    console.log('[generate-sales-assets] Successfully generated call notes');

    return new Response(JSON.stringify(callNotes), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[generate-sales-assets] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(JSON.stringify({
      error: 'An unexpected error occurred. Please try again.',
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
