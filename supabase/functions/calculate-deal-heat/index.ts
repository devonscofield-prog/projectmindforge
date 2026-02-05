import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Handle backfill batch - processes multiple calls missing deal_heat_analysis
 */
async function handleBackfillBatch(correlationId: string, batchSize: number): Promise<Response> {
  console.log(`[${correlationId}] Backfill mode: processing up to ${batchSize} calls`);
  
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  
  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(
      JSON.stringify({ error: 'Database not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  
  // Find calls with completed analysis but missing deal_heat_analysis
  const { data: callsToProcess, error: fetchError } = await supabaseClient
    .from('ai_call_analysis')
    .select(`
      id,
      call_id,
      analysis_strategy,
      analysis_behavior,
      analysis_metadata,
      call_transcripts!inner (
        id,
        raw_text,
        prospect_id
      )
    `)
    .is('deal_heat_analysis', null)
    .not('analysis_strategy', 'is', null)
    .limit(batchSize);
  
  if (fetchError) {
    console.error(`[${correlationId}] Failed to fetch calls for backfill:`, fetchError);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch calls for backfill' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  // Count total remaining
  const { count: totalRemaining } = await supabaseClient
    .from('ai_call_analysis')
    .select('id', { count: 'exact', head: true })
    .is('deal_heat_analysis', null)
    .not('analysis_strategy', 'is', null);
  
  if (!callsToProcess || callsToProcess.length === 0) {
    return new Response(
      JSON.stringify({ 
        processed: 0, 
        remaining: 0, 
        total: 0,
        errors: 0,
        complete: true 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  console.log(`[${correlationId}] Found ${callsToProcess.length} calls to process, ${totalRemaining} total remaining`);
  
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'AI service not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
  
  let processed = 0;
  let errors = 0;
  
  for (const call of callsToProcess) {
    try {
      // Handle array from join - get first item
      const transcriptData = Array.isArray(call.call_transcripts) 
        ? call.call_transcripts[0] 
        : call.call_transcripts;
      const transcript = transcriptData?.raw_text;
      if (!transcript) {
        console.warn(`[${correlationId}] No transcript for call ${call.call_id}, skipping`);
        errors++;
        continue;
      }
      
      const userPrompt = buildUserPrompt(
        transcript,
        call.analysis_strategy,
        call.analysis_behavior,
        call.analysis_metadata
      );
      
      const response = await fetch(LOVABLE_AI_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash', // Use flash for backfill efficiency
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
      
      if (!response.ok) {
        console.error(`[${correlationId}] AI call failed for ${call.call_id}: ${response.status}`);
        errors++;
        continue;
      }
      
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        console.error(`[${correlationId}] No tool call for ${call.call_id}`);
        errors++;
        continue;
      }
      
      const dealHeat = JSON.parse(toolCall.function.arguments);
      
      // Apply score cap based on critical gaps
      if (call.analysis_strategy?.critical_gaps) {
        const hasBudgetGap = call.analysis_strategy.critical_gaps.some(
          (g: { category: string }) => g.category === 'Budget'
        );
        const hasAuthorityGap = call.analysis_strategy.critical_gaps.some(
          (g: { category: string }) => g.category === 'Authority'
        );
        
        let scoreCap = 100;
        if (hasBudgetGap && hasAuthorityGap) scoreCap = 65;
        else if (hasAuthorityGap) scoreCap = 75;
        else if (hasBudgetGap) scoreCap = 70;
        
        if (dealHeat.heat_score > scoreCap) {
          dealHeat.heat_score = scoreCap;
          if (scoreCap < 75 && dealHeat.temperature === 'Hot') {
            dealHeat.temperature = 'Warm';
          }
        }
      }
      
      // Save deal heat
      await supabaseClient
        .from('ai_call_analysis')
        .update({ deal_heat_analysis: dealHeat })
        .eq('id', call.id);
      
      // Update prospect heat_score if applicable
      const prospectId = transcriptData?.prospect_id;
      if (prospectId) {
        await supabaseClient
          .from('prospects')
          .update({ heat_score: dealHeat.heat_score })
          .eq('id', prospectId);
      }
      
      processed++;
      console.log(`[${correlationId}] Processed ${call.call_id}: ${dealHeat.heat_score} (${dealHeat.temperature})`);
      
    } catch (err) {
      console.error(`[${correlationId}] Error processing ${call.call_id}:`, err);
      errors++;
    }
  }
  
  const remaining = (totalRemaining || 0) - processed;
  
  return new Response(
    JSON.stringify({
      processed,
      remaining: Math.max(0, remaining),
      total: totalRemaining || 0,
      errors,
      complete: remaining <= 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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
        },
        estimated_close_date: {
          type: "string",
          description: "Best guess timeframe (e.g., 'Q1 2024', 'End of Jan', 'Late 2025'). Return 'Unknown' if no evidence."
        },
        close_date_evidence: {
          type: "string",
          description: "The specific quote or logic used to derive this date."
        }
      },
      required: ["heat_score", "temperature", "trend", "key_factors", "winning_probability", "recommended_action", "estimated_close_date", "close_date_evidence"]
    }
  }
};

const ACTUARY_SYSTEM_PROMPT = `You are a Deal Desk Actuary. Your job is to calculate the objective probability of this deal closing based on evidence.

**INPUTS TO ANALYZE:**
1. **The Transcript:** (Raw truth)
2. **Strategy Audit:** (Look at critical_gaps - are they blockers or just unknowns?)
3. **Behavior Score:** (Did we secure a Next Step?)
4. **Participants:** (Did we talk to a Decision Maker?)

**SCORING FRAMEWORK:**

Score the deal on a TRUE 0-100 scale using these weighted factors. ADD UP the scores:

**1. Pain Urgency (30 points max)**
- 25-30: Acute pain with business impact ("We're losing $X/month", "deadline is Y")
- 15-24: Clear pain but latent ("would be nice to fix")
- 5-14: Pain mentioned but vague
- 0-4: No clear pain articulated

**2. Power/Authority (25 points max)**
- 20-25: Decision-maker on call with clear authority
- 12-19: Champion identified with access to decision-maker
- 5-11: Contact is influencer but path to power unclear
- 0-4: No path to economic buyer identified

**3. Timing/Compelling Event (25 points max)**
- 20-25: Hard deadline with consequences ("contract expires Dec 31")
- 12-19: Soft timeline with internal drivers ("budget cycle in Q1")
- 5-11: General interest but no urgency
- 0-4: No timeline discussed

**4. Momentum (20 points max)**
- 16-20: Firm next step with specific date AND action
- 10-15: Next step discussed, tentatively agreed
- 5-9: "Let's talk again soon" type commitment
- 0-4: No next step or prospect going dark

**SCORING RULES:**
- ADD UP the scores from each category to get the raw score (0-100)
- Be HONEST, not conservative. A 75+ deal should have 3+ strong categories
- A deal can be Hot (75+) even without perfect Budget/Authority IF:
  - Pain is acute (25+ points) AND compelling event exists (20+ points) AND strong momentum (16+ points)
- Missing Budget/Authority should reduce the Power category score, NOT automatically cap the total

**TEMPERATURE THRESHOLDS:**
- Hot (75-100): High probability, multiple strong buying signals
- Warm (50-74): Genuine interest, some unknowns to resolve
- Lukewarm (25-49): Early stage or significant blockers
- Cold (0-24): No clear path forward

**TREND:**
- Heating Up: New positive signals emerged in this call
- Cooling Down: Resistance, delays, or concerns surfaced
- Stagnant: No change in deal dynamics

**TIMEFRAME FORENSICS:**
Scrutinize the transcript for timing clues:
- Explicit: "We need to sign by Dec 31st." → "End of Dec"
- Implicit: "Our contract with X expires in April." → "March/April"
- Project-Based: "New class starting in two weeks." → "Within 2 weeks"
- Fiscal: "Need to spend this budget before Q4." → "End of Q3"
- If NO timing clues exist, return "Unknown" for estimated_close_date.

**OUTPUT:**
Generate the heat_score by ADDING category scores. Explain each factor's contribution in key_factors.`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const correlationId = crypto.randomUUID().slice(0, 8);
  console.log(`[${correlationId}] calculate-deal-heat: Starting request`);

  try {
    const body = await req.json();
    const { transcript, strategy_data, behavior_data, metadata, call_id, backfill_batch } = body;

    // BACKFILL MODE: Process batch of calls missing deal_heat_analysis
    if (backfill_batch) {
      const batchSize = body.batch_size || 5;
      return await handleBackfillBatch(correlationId, batchSize);
    }

    // Validate inputs for single call processing
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

    // Apply graduated cap based on critical gaps (less aggressive than before)
    if (strategy_data?.critical_gaps) {
      const hasBudgetGap = strategy_data.critical_gaps.some(
        (g: { category: string }) => g.category === 'Budget'
      );
      const hasAuthorityGap = strategy_data.critical_gaps.some(
        (g: { category: string }) => g.category === 'Authority'
      );
      
      let scoreCap = 100; // Default: no cap
      
      if (hasBudgetGap && hasAuthorityGap) {
        scoreCap = 65; // Both gaps = significant risk, but not a hard block
      } else if (hasAuthorityGap) {
        scoreCap = 75; // Authority alone = can still be warm/hot if verbal buy-in
      } else if (hasBudgetGap) {
        scoreCap = 70; // Budget alone = often solvable
      }
      
      if (dealHeat.heat_score > scoreCap) {
        console.log(`[${correlationId}] Capping score from ${dealHeat.heat_score} to ${scoreCap} due to gaps (Budget: ${hasBudgetGap}, Authority: ${hasAuthorityGap})`);
        dealHeat.heat_score = scoreCap;
        // Adjust temperature based on new capped score
        if (scoreCap < 75 && dealHeat.temperature === 'Hot') {
          dealHeat.temperature = 'Warm';
        }
      }
    }

    console.log(`[${correlationId}] Deal heat calculated: ${dealHeat.heat_score} (${dealHeat.temperature})`);

    // Save to database with robust error handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error(`[${correlationId}] Missing Supabase environment variables - URL: ${!!supabaseUrl}, KEY: ${!!supabaseServiceKey}`);
      // Still return the result even if we can't save
      return new Response(
        JSON.stringify({ deal_heat: dealHeat, saved: false, error: 'Database not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${correlationId}] Attempting to save deal heat for call_id: ${call_id}`);
    
    try {
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      // Use select() to verify rows were updated
      const { data: updateData, error: updateError } = await supabaseClient
        .from('ai_call_analysis')
        .update({ deal_heat_analysis: dealHeat })
        .eq('call_id', call_id)
        .select('call_id, deal_heat_analysis');

      if (updateError) {
        console.error(`[${correlationId}] Database update error:`, JSON.stringify(updateError));
        return new Response(
          JSON.stringify({ deal_heat: dealHeat, saved: false, error: updateError.message }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!updateData || updateData.length === 0) {
        console.error(`[${correlationId}] No rows updated for call_id: ${call_id} - record may not exist`);
        return new Response(
          JSON.stringify({ deal_heat: dealHeat, saved: false, error: 'No matching record found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[${correlationId}] Successfully saved deal heat for ${updateData.length} row(s). Verified heat_score: ${updateData[0]?.deal_heat_analysis?.heat_score}`);

      // Phase 1.1: Also update the prospect's heat_score from the latest deal heat
      // Get the prospect_id from the call transcript
      const { data: callData } = await supabaseClient
        .from('call_transcripts')
        .select('prospect_id')
        .eq('id', call_id)
        .single();

      if (callData?.prospect_id) {
        const { error: prospectError } = await supabaseClient
          .from('prospects')
          .update({ heat_score: dealHeat.heat_score })
          .eq('id', callData.prospect_id);

        if (prospectError) {
          console.warn(`[${correlationId}] Failed to update prospect heat_score:`, prospectError.message);
        } else {
          console.log(`[${correlationId}] Updated prospect ${callData.prospect_id} heat_score to ${dealHeat.heat_score}`);
        }
      }
      
      return new Response(
        JSON.stringify({ deal_heat: dealHeat, saved: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (dbError) {
      console.error(`[${correlationId}] Database operation exception:`, dbError);
      return new Response(
        JSON.stringify({ deal_heat: dealHeat, saved: false, error: dbError instanceof Error ? dbError.message : 'Database error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error(`[${correlationId}] Error:`, error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getStageExpectation(callType: string): string {
  switch (callType?.toLowerCase()) {
    case 'discovery':
    case 'intro':
    case 'introduction':
      return 'Early stage - Pain and Fit are primary focus; Budget/Authority may not be explored yet. Score based on pain clarity and initial interest.';
    case 'demo':
    case 'presentation':
      return 'Mid stage - Should be qualifying Authority and starting Budget discussions. Look for solution fit confirmation.';
    case 'proposal':
    case 'quote':
      return 'Late stage - Budget and Authority should be confirmed. Focus on deal mechanics and timeline.';
    case 'negotiation':
    case 'closing':
      return 'Final stage - Only blockers should be contract terms. High scores expected if still engaged.';
    case 'follow-up':
    case 'check-in':
      return 'Maintenance stage - Score based on continued engagement and pipeline progression.';
    default:
      return 'Unknown stage - Score based on all available evidence without stage-specific expectations.';
  }
}

function buildUserPrompt(
  transcript: string, 
  strategy_data: any, 
  behavior_data: any, 
  metadata: any
): string {
  let prompt = `Analyze this sales call and calculate the Deal Heat score.\n\n`;

  // Add call type context for stage-aware scoring
  const callType = metadata?.call_type || 'unknown';
  prompt += `## CALL CONTEXT:\n`;
  prompt += `- Call Type: ${callType}\n`;
  prompt += `- Stage Expectation: ${getStageExpectation(callType)}\n\n`;

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
      prompt += `- Critical Gaps (note: early-stage calls may legitimately have gaps):\n`;
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

  prompt += `Based on all the above evidence, calculate the deal heat score using the additive scoring framework. Show your reasoning for each category score.`;
  
  return prompt;
}
