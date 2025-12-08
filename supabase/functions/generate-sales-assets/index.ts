import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const SALES_ASSETS_TOOL = {
  type: "function",
  function: {
    name: "generate_sales_assets",
    description: "Generate a follow-up recap email and internal CRM notes based on the call transcript and strategic context",
    parameters: {
      type: "object",
      properties: {
        recap_email: {
          type: "object",
          properties: {
            subject_line: { type: "string", description: "Professional email subject line" },
            body_html: { type: "string", description: "HTML formatted email body with proper paragraphs and formatting" }
          },
          required: ["subject_line", "body_html"]
        },
        internal_notes_markdown: {
          type: "string",
          description: "CRM-ready internal notes in markdown format with key points, next steps, and action items"
        }
      },
      required: ["recap_email", "internal_notes_markdown"]
    }
  }
};

const COPYWRITER_SYSTEM_PROMPT = `You are an expert Sales Copywriter. Write a follow-up email and CRM notes.

**CRITICAL:** Use the provided 'strategic_context' (specifically the 'relevance_map' and 'critical_gaps').
- In the email, do NOT list generic features.
- Use explicit format: 'Because you mentioned [Pain Identified], I recommend [Feature Pitched]...'
- Keep the tone professional but conversational.

**COMMUNICATION STYLE ADAPTATION:**
If a 'prospect_psychology' profile is provided, adapt your writing style:
- **High D (Dominance):** Be brief, direct, bottom-line focused. Skip small talk. Use bullet points.
- **High I (Influence):** Be enthusiastic, warm, storytelling. Use emojis sparingly. Keep energy high.
- **High S (Steadiness):** Be calm, reassuring, process-oriented. Emphasize stability and support.
- **High C (Compliance):** Be detailed, data-driven, precise. Include specifics and avoid vague claims.

**EMAIL STRUCTURE:**
1. Warm opening thanking them for their time
2. Brief recap of what was discussed
3. For each relevant pain-to-solution mapping, write: "Because you mentioned [pain], I'd like to highlight how [feature] can help..."
4. Clear next steps
5. Professional sign-off

**INTERNAL NOTES STRUCTURE (Markdown):**
## Call Summary
[Brief overview]

## Key Pain Points Discussed
- [List each pain point]

## Solutions Pitched
- [List solutions and their relevance]

## Actionable Gaps
Use the 'critical_gaps' to populate this section. For each gap:
- **[Category]**: [Description]
  - *Ask this:* "[suggested_question]"

## Stakeholder Notes
- [Key observations about participants]

## Next Steps
- [Specific action items with owners]

## Follow-up Required
- [Items needing attention based on gaps identified]`;

interface CriticalGap {
  category: string;
  description: string;
  impact: string;
  suggested_question: string;
}

interface PsychologyContext {
  prospect_persona?: string;
  disc_profile?: string;
  communication_style?: {
    tone?: string;
    preference?: string;
  };
  dos_and_donts?: {
    do?: string[];
    dont?: string[];
  };
}

interface StrategicContext {
  strategic_threading?: {
    relevance_map?: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities?: string[];
  };
  critical_gaps?: CriticalGap[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY is not configured');
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

    const { transcript, strategic_context, psychology_context, account_name, stakeholder_name } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return new Response(JSON.stringify({ error: 'transcript is required and must be a string' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[generate-sales-assets] Generating assets for user ${user.id}`);

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
          contextSection += `- ${missed}\n`;
        }
      }

      if (sc.critical_gaps && sc.critical_gaps.length > 0) {
        contextSection += '\n**CRITICAL GAPS (Information missing from this deal):**\n';
        for (const gap of sc.critical_gaps) {
          contextSection += `- [${gap.impact} Impact] ${gap.category}: ${gap.description}\n`;
          contextSection += `  → Suggested question: "${gap.suggested_question}"\n`;
        }
      }
    }

    // Add psychology context if available
    let psychologySection = '';
    if (psychology_context) {
      const pc = psychology_context as PsychologyContext;
      psychologySection = `\n\n**PROSPECT PSYCHOLOGY:**
- **Persona:** ${pc.prospect_persona || 'Unknown'}
- **DISC Profile:** ${pc.disc_profile || 'Unknown'}
- **Preferred Tone:** ${pc.communication_style?.tone || 'Unknown'}
- **Communication Preference:** ${pc.communication_style?.preference || 'Unknown'}
- **DO:** ${pc.dos_and_donts?.do?.join('; ') || 'No specific guidance'}
- **DON'T:** ${pc.dos_and_donts?.dont?.join('; ') || 'No specific guidance'}`;
    }

    const userPrompt = `Generate a professional follow-up email and internal CRM notes for this sales call.

${account_name ? `**Account:** ${account_name}` : ''}
${stakeholder_name ? `**Primary Contact:** ${stakeholder_name}` : ''}
${contextSection}
${psychologySection}

**CALL TRANSCRIPT:**
${transcript.substring(0, 30000)}`;

    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: COPYWRITER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [SALES_ASSETS_TOOL],
        tool_choice: { type: 'function', function: { name: 'generate_sales_assets' } },
        max_tokens: 4096,
        temperature: 0.7,
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
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall || toolCall.function?.name !== 'generate_sales_assets') {
      console.error('[generate-sales-assets] No valid tool call in response:', aiResponse);
      throw new Error('Failed to generate sales assets - invalid AI response');
    }

    const salesAssets = JSON.parse(toolCall.function.arguments);
    console.log('[generate-sales-assets] Successfully generated sales assets');

    return new Response(JSON.stringify(salesAssets), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[generate-sales-assets] Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
