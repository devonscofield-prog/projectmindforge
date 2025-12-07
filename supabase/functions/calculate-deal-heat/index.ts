import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const DEAL_HEAT_TOOL = {
  type: "function",
  function: {
    name: "calculate_deal_heat",
    description: "Calculate the objective probability of this deal closing based on evidence",
    parameters: {
      type: "object",
      properties: {
        heat_score: { 
          type: "number", 
          minimum: 0, 
          maximum: 100, 
          description: "Overall deal heat score 0-100" 
        },
        temperature: { 
          type: "string", 
          enum: ["Hot", "Warm", "Lukewarm", "Cold"],
          description: "Deal temperature category"
        },
        trend: { 
          type: "string", 
          enum: ["Heating Up", "Cooling Down", "Stagnant"],
          description: "Direction the deal is trending"
        },
        key_factors: {
          type: "array",
          items: {
            type: "object",
            properties: {
              factor: { type: "string", description: "The factor influencing deal heat (e.g., 'Urgency', 'Authority', 'Budget')" },
              impact: { type: "string", enum: ["Positive", "Negative"], description: "Whether this factor helps or hurts the deal" },
              reasoning: { type: "string", description: "Brief explanation of why this factor has this impact" }
            },
            required: ["factor", "impact", "reasoning"]
          },
          description: "Key factors influencing the deal temperature"
        },
        winning_probability: { 
          type: "string", 
          description: "Estimated probability of winning (e.g., 'Low (20%)', 'Medium (50%)', 'High (75%)')" 
        },
        recommended_action: { 
          type: "string", 
          description: "The single most important action to take next" 
        }
      },
      required: ["heat_score", "temperature", "trend", "key_factors", "winning_probability", "recommended_action"]
    }
  }
};

const ACTUARY_SYSTEM_PROMPT = `You are a Deal Desk Actuary. Your job is to calculate the objective probability of this deal closing based on the evidence provided.

**INPUTS TO ANALYZE:**
1. **The Transcript:** (Raw truth)
2. **Strategy Audit:** (Look at \`critical_gaps\` - are they deal-killers?)
3. **Behavior Score:** (Did we secure a Next Step?)
4. **Participants:** (Did we talk to a Decision Maker?)

**SCORING ALGORITHM (Mental Weights):**
- **Pain (30%):** Is the 'Relevance Map' strong? Is the pain acute or latent?
- **Power (25%):** Did we speak to a Decision Maker (check metadata)?
- **Timing (25%):** Is there a specific timeline/compelling event?
- **Momentum (20%):** Is there a firm Next Step on the calendar?

**OUTPUT:**
Generate a 0-100 \`heat_score\` and explain the \`key_factors\`.
- Be Conservative. A "Warm" conversation is not a "Hot" deal.
- If \`critical_gaps\` contains "Budget" or "Authority", cap the score at 60.
- Temperature thresholds: Hot >= 75, Warm >= 50, Lukewarm >= 25, Cold < 25
- Trend: Based on whether momentum indicators are strengthening or weakening`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 8);
  console.log(`[${correlationId}] calculate-deal-heat: Starting request`);

  try {
    const { transcript, strategy_data, behavior_data, metadata, call_id } = await req.json();

    // Validate inputs
    if (!transcript) {
      console.error(`[${correlationId}] Missing transcript`);
      return new Response(
        JSON.stringify({ error: 'transcript is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!call_id) {
      console.error(`[${correlationId}] Missing call_id`);
      return new Response(
        JSON.stringify({ error: 'call_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error(`[${correlationId}] LOVABLE_API_KEY not configured`);
      return new Response(
        JSON.stringify({ error: 'AI service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the user prompt with all available context
    const userPrompt = buildUserPrompt(transcript, strategy_data, behavior_data, metadata);
    console.log(`[${correlationId}] Calling Lovable AI (gemini-2.5-pro)`);

    const startTime = Date.now();
    const response = await fetch(LOVABLE_AI_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { role: 'system', content: ACTUARY_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        tools: [DEAL_HEAT_TOOL],
        tool_choice: { type: 'function', function: { name: 'calculate_deal_heat' } },
        max_tokens: 4096,
        temperature: 0.2,
      }),
    });

    const duration = Date.now() - startTime;
    console.log(`[${correlationId}] AI response received in ${duration}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[${correlationId}] AI Gateway error ${response.status}:`, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please add funds.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      return new Response(
        JSON.stringify({ error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error(`[${correlationId}] No tool call in response`);
      return new Response(
        JSON.stringify({ error: 'AI did not return structured data' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let dealHeat;
    try {
      dealHeat = JSON.parse(toolCall.function.arguments);
    } catch (parseError) {
      console.error(`[${correlationId}] Failed to parse tool arguments:`, parseError);
      return new Response(
        JSON.stringify({ error: 'Failed to parse AI response' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Apply the Budget/Authority cap rule
    if (strategy_data?.critical_gaps) {
      const hasBudgetGap = strategy_data.critical_gaps.some(
        (g: { category: string }) => g.category === 'Budget'
      );
      const hasAuthorityGap = strategy_data.critical_gaps.some(
        (g: { category: string }) => g.category === 'Authority'
      );
      
      if ((hasBudgetGap || hasAuthorityGap) && dealHeat.heat_score > 60) {
        console.log(`[${correlationId}] Capping score from ${dealHeat.heat_score} to 60 due to Budget/Authority gap`);
        dealHeat.heat_score = 60;
        // Adjust temperature if needed
        if (dealHeat.temperature === 'Hot') {
          dealHeat.temperature = 'Warm';
        }
      }
    }

    console.log(`[${correlationId}] Deal heat calculated: ${dealHeat.heat_score} (${dealHeat.temperature})`);

    // Save to database
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { error: updateError } = await supabaseClient
      .from('ai_call_analysis')
      .update({ deal_heat_analysis: dealHeat })
      .eq('call_id', call_id);

    if (updateError) {
      console.error(`[${correlationId}] Failed to save deal heat to database:`, updateError);
      // Still return the result even if save fails
    } else {
      console.log(`[${correlationId}] Deal heat saved to database for call ${call_id}`);
    }

    return new Response(
      JSON.stringify({ deal_heat: dealHeat }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildUserPrompt(
  transcript: string, 
  strategy_data: any, 
  behavior_data: any, 
  metadata: any
): string {
  let prompt = `Analyze this sales call and calculate the Deal Heat score.\n\n`;

  // Add transcript (truncate if very long)
  const maxTranscriptLength = 30000;
  const truncatedTranscript = transcript.length > maxTranscriptLength 
    ? transcript.slice(0, maxTranscriptLength) + '\n\n[...truncated for length...]'
    : transcript;
  prompt += `## TRANSCRIPT:\n${truncatedTranscript}\n\n`;

  // Add strategy audit context
  if (strategy_data) {
    prompt += `## STRATEGY AUDIT:\n`;
    
    if (strategy_data.strategic_threading) {
      prompt += `- Strategic Threading Score: ${strategy_data.strategic_threading.score}/100 (${strategy_data.strategic_threading.grade})\n`;
      
      if (strategy_data.strategic_threading.relevance_map?.length > 0) {
        prompt += `- Relevance Map:\n`;
        strategy_data.strategic_threading.relevance_map.forEach((item: any) => {
          prompt += `  • Pain: "${item.pain_identified}" → Feature: "${item.feature_pitched}" [${item.is_relevant ? 'RELEVANT' : 'GENERIC'}]\n`;
        });
      }
      
      if (strategy_data.strategic_threading.missed_opportunities?.length > 0) {
        prompt += `- Missed Opportunities: ${strategy_data.strategic_threading.missed_opportunities.join(', ')}\n`;
      }
    }
    
    if (strategy_data.critical_gaps?.length > 0) {
      prompt += `- Critical Gaps:\n`;
      strategy_data.critical_gaps.forEach((gap: any) => {
        prompt += `  • [${gap.category}] ${gap.description} (Impact: ${gap.impact})\n`;
      });
    }
    prompt += `\n`;
  }

  // Add behavior score context
  if (behavior_data) {
    prompt += `## BEHAVIOR ANALYSIS:\n`;
    prompt += `- Overall Score: ${behavior_data.overall_score}/100 (${behavior_data.grade})\n`;
    
    if (behavior_data.metrics?.next_steps) {
      prompt += `- Next Steps Secured: ${behavior_data.metrics.next_steps.secured ? 'YES' : 'NO'}\n`;
      prompt += `- Next Steps Details: ${behavior_data.metrics.next_steps.details}\n`;
    }
    prompt += `\n`;
  }

  // Add participant metadata
  if (metadata?.participants?.length > 0) {
    prompt += `## PARTICIPANTS:\n`;
    metadata.participants.forEach((p: any) => {
      prompt += `- ${p.name} (${p.role}) - Decision Maker: ${p.is_decision_maker ? 'YES' : 'NO'}, Sentiment: ${p.sentiment}\n`;
    });
    prompt += `\n`;
  }

  prompt += `Based on all the above evidence, calculate the deal heat score and provide your analysis.`;
  
  return prompt;
}
