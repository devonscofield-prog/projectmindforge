import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sales veteran system prompt for generating follow-up steps
const FOLLOW_UP_SYSTEM_PROMPT = `You are a 20-year B2B/SaaS sales veteran and strategic account coach. You've closed hundreds of enterprise deals ranging from $50K to $5M ARR. You understand exactly what separates good follow-up from great follow-up that actually advances deals.

Your task is to analyze ALL call data for an account and generate 3-7 specific, actionable follow-up STEPS (not questions). Each step should be something the rep can execute TODAY to move the deal forward measurably.

GUIDELINES FOR GREAT FOLLOW-UP STEPS:
1. Be SPECIFIC - not "follow up with stakeholder" but "Schedule 30-min call with IT Director John to address security concerns raised in last call"
2. Be ACTIONABLE - concrete actions, not vague suggestions
3. Address GAPS - fill in missing BANT info, address unresolved objections, expand stakeholder coverage
4. Consider TIMING - prioritize based on deal stage and urgency signals
5. Think MULTI-THREADING - always look for ways to engage more stakeholders

CATEGORIES:
- discovery: Uncover more info about pain, budget, timeline, decision process
- stakeholder: Expand multi-threading, engage decision makers, build champions
- objection: Address unresolved concerns with proof points, ROI data, references
- proposal: Advance toward commercial discussions, pricing, contracts
- relationship: Build champion strength, strengthen rapport, add value
- competitive: Counter competitive threats, differentiate, establish unique value

For each follow-up step, provide:
- title: Action verb + specific outcome (max 60 chars)
- description: 1-2 sentences with context on WHY this matters
- priority: high/medium/low based on deal impact and urgency
- category: one of the above
- ai_reasoning: 2-3 sentences explaining your veteran thinking - why this specific action, what it addresses, and what outcome to expect

Be direct. Be specific. Think like someone whose commission depends on this deal closing.`;

interface CallData {
  id: string;
  call_date: string;
  call_type: string | null;
  raw_text: string;
  analysis?: {
    call_summary?: string;
    deal_gaps?: { critical_missing_info?: string[]; unresolved_objections?: string[] };
    coach_output?: {
      critical_info_missing?: string[];
      recommended_follow_up_questions?: string[];
      heat_signature?: { score: number; explanation: string };
    };
    strengths?: Array<{ area: string; example: string }>;
    opportunities?: Array<{ area: string; example: string }>;
  };
}

interface FollowUpSuggestion {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  ai_reasoning: string;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    
    if (!prospect_id) {
      return new Response(
        JSON.stringify({ error: 'prospect_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[generate-account-follow-ups] Starting for prospect: ${prospect_id}`);

    // Create Supabase client with service role for backend operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update prospect status to processing
    await supabase
      .from('prospects')
      .update({ follow_ups_generation_status: 'processing' })
      .eq('id', prospect_id);

    // Fetch prospect details
    const { data: prospect, error: prospectError } = await supabase
      .from('prospects')
      .select('*')
      .eq('id', prospect_id)
      .single();

    if (prospectError || !prospect) {
      console.error('[generate-account-follow-ups] Prospect not found:', prospectError);
      return new Response(
        JSON.stringify({ error: 'Prospect not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all call transcripts for this prospect
    const { data: calls, error: callsError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, call_type, raw_text')
      .eq('prospect_id', prospect_id)
      .order('call_date', { ascending: false });

    if (callsError) {
      console.error('[generate-account-follow-ups] Error fetching calls:', callsError);
      throw new Error('Failed to fetch call transcripts');
    }

    // Fetch analyses for all calls
    const callIds = (calls || []).map(c => c.id);
    let analyses: Record<string, any> = {};
    
    if (callIds.length > 0) {
      const { data: analysisData } = await supabase
        .from('ai_call_analysis')
        .select('call_id, call_summary, deal_gaps, coach_output, strengths, opportunities')
        .in('call_id', callIds);
      
      if (analysisData) {
        analyses = analysisData.reduce((acc, a) => {
          acc[a.call_id] = a;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Fetch stakeholders
    const { data: stakeholders } = await supabase
      .from('stakeholders')
      .select('name, job_title, influence_level, champion_score, is_primary_contact')
      .eq('prospect_id', prospect_id);

    // Fetch existing pending follow-ups to avoid duplicates
    const { data: existingFollowUps } = await supabase
      .from('account_follow_ups')
      .select('title, description')
      .eq('prospect_id', prospect_id)
      .eq('status', 'pending');

    // Build context for AI
    const callsWithAnalysis: CallData[] = (calls || []).map(call => ({
      ...call,
      analysis: analyses[call.id]
    }));

    // If no calls, generate basic follow-ups
    if (callsWithAnalysis.length === 0) {
      console.log('[generate-account-follow-ups] No calls found, generating basic follow-ups');
      
      const basicFollowUps: FollowUpSuggestion[] = [
        {
          title: 'Schedule initial discovery call',
          description: 'No calls recorded yet. Reach out to establish first contact and understand their current situation.',
          priority: 'high',
          category: 'discovery',
          ai_reasoning: 'Without any call data, the first priority is establishing contact. A discovery call will reveal pain points, timeline, and budget - the foundation for any deal.'
        }
      ];

      // Save follow-ups
      for (const followUp of basicFollowUps) {
        await supabase.from('account_follow_ups').insert({
          prospect_id,
          rep_id: prospect.rep_id,
          title: followUp.title,
          description: followUp.description,
          priority: followUp.priority,
          category: followUp.category,
          ai_reasoning: followUp.ai_reasoning,
          generated_from_call_ids: [],
          status: 'pending'
        });
      }

      // Update prospect status
      await supabase
        .from('prospects')
        .update({ 
          follow_ups_generation_status: 'completed',
          follow_ups_last_generated_at: new Date().toISOString()
        })
        .eq('id', prospect_id);

      return new Response(
        JSON.stringify({ success: true, count: basicFollowUps.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build comprehensive context
    const contextPrompt = buildContextPrompt(prospect, callsWithAnalysis, stakeholders || [], existingFollowUps || []);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log('[generate-account-follow-ups] Calling Lovable AI for analysis...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
          { role: 'user', content: contextPrompt }
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'submit_follow_up_steps',
            description: 'Submit the generated follow-up steps for this account',
            parameters: {
              type: 'object',
              properties: {
                follow_ups: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      title: { type: 'string', description: 'Short action title (max 60 chars)' },
                      description: { type: 'string', description: '1-2 sentences with context' },
                      priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      category: { type: 'string', enum: ['discovery', 'stakeholder', 'objection', 'proposal', 'relationship', 'competitive'] },
                      ai_reasoning: { type: 'string', description: '2-3 sentences explaining the reasoning' }
                    },
                    required: ['title', 'description', 'priority', 'category', 'ai_reasoning']
                  },
                  minItems: 3,
                  maxItems: 7
                }
              },
              required: ['follow_ups']
            }
          }
        }],
        tool_choice: { type: 'function', function: { name: 'submit_follow_up_steps' } }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[generate-account-follow-ups] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[generate-account-follow-ups] AI response received');

    // Extract follow-ups from tool call
    let followUps: FollowUpSuggestion[] = [];
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        followUps = args.follow_ups || [];
      } catch (e) {
        console.error('[generate-account-follow-ups] Failed to parse tool arguments:', e);
      }
    }

    if (followUps.length === 0) {
      console.warn('[generate-account-follow-ups] No follow-ups generated');
      await supabase
        .from('prospects')
        .update({ 
          follow_ups_generation_status: 'completed',
          follow_ups_last_generated_at: new Date().toISOString()
        })
        .eq('id', prospect_id);

      return new Response(
        JSON.stringify({ success: true, count: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter out duplicates (simple title similarity check)
    const existingTitles = new Set((existingFollowUps || []).map(f => f.title.toLowerCase()));
    const newFollowUps = followUps.filter(f => !existingTitles.has(f.title.toLowerCase()));

    console.log(`[generate-account-follow-ups] Saving ${newFollowUps.length} new follow-ups (filtered ${followUps.length - newFollowUps.length} duplicates)`);

    // Save new follow-ups
    for (const followUp of newFollowUps) {
      await supabase.from('account_follow_ups').insert({
        prospect_id,
        rep_id: prospect.rep_id,
        title: followUp.title,
        description: followUp.description,
        priority: followUp.priority,
        category: followUp.category,
        ai_reasoning: followUp.ai_reasoning,
        generated_from_call_ids: callIds,
        status: 'pending'
      });
    }

    // Update prospect status
    await supabase
      .from('prospects')
      .update({ 
        follow_ups_generation_status: 'completed',
        follow_ups_last_generated_at: new Date().toISOString()
      })
      .eq('id', prospect_id);

    console.log(`[generate-account-follow-ups] Completed successfully for prospect: ${prospect_id}`);

    return new Response(
      JSON.stringify({ success: true, count: newFollowUps.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-account-follow-ups] Error:', error);
    
    // Try to update status to error if we have prospect_id
    try {
      const { prospect_id } = await req.clone().json();
      if (prospect_id) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from('prospects')
          .update({ follow_ups_generation_status: 'error' })
          .eq('id', prospect_id);
      }
    } catch (e) {
      // Ignore
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildContextPrompt(
  prospect: any,
  calls: CallData[],
  stakeholders: any[],
  existingFollowUps: any[]
): string {
  let prompt = `## ACCOUNT OVERVIEW
Account Name: ${prospect.account_name || prospect.prospect_name}
Status: ${prospect.status}
Heat Score: ${prospect.heat_score || 'Not rated'}/10
Potential Revenue: ${prospect.potential_revenue ? `$${prospect.potential_revenue.toLocaleString()}` : 'Unknown'}

## STAKEHOLDERS (${stakeholders.length} total)
`;

  if (stakeholders.length > 0) {
    for (const s of stakeholders) {
      prompt += `- ${s.name}${s.job_title ? ` (${s.job_title})` : ''} - ${s.influence_level || 'unknown influence'}${s.champion_score ? `, Champion Score: ${s.champion_score}/10` : ''}${s.is_primary_contact ? ' [PRIMARY]' : ''}\n`;
    }
  } else {
    prompt += `- No stakeholders mapped yet\n`;
  }

  prompt += `\n## CALL HISTORY (${calls.length} calls, most recent first)\n`;

  for (const call of calls.slice(0, 5)) { // Limit to last 5 calls for context
    prompt += `\n### Call: ${call.call_date} (${call.call_type || 'Unknown type'})\n`;
    
    if (call.analysis) {
      if (call.analysis.call_summary) {
        prompt += `Summary: ${call.analysis.call_summary}\n`;
      }
      if (call.analysis.deal_gaps?.critical_missing_info?.length) {
        prompt += `Missing Info: ${call.analysis.deal_gaps.critical_missing_info.join(', ')}\n`;
      }
      if (call.analysis.deal_gaps?.unresolved_objections?.length) {
        prompt += `Unresolved Objections: ${call.analysis.deal_gaps.unresolved_objections.join(', ')}\n`;
      }
      if (call.analysis.coach_output?.heat_signature) {
        prompt += `Heat: ${call.analysis.coach_output.heat_signature.score}/10 - ${call.analysis.coach_output.heat_signature.explanation}\n`;
      }
      if (call.analysis.opportunities?.length) {
        prompt += `Improvement Areas: ${call.analysis.opportunities.map(o => o.area).join(', ')}\n`;
      }
    }
    
    // Include abbreviated transcript for context
    const transcriptPreview = call.raw_text.substring(0, 1500);
    prompt += `Transcript excerpt: ${transcriptPreview}${call.raw_text.length > 1500 ? '...' : ''}\n`;
  }

  if (existingFollowUps.length > 0) {
    prompt += `\n## EXISTING PENDING FOLLOW-UPS (avoid duplicating these)\n`;
    for (const f of existingFollowUps) {
      prompt += `- ${f.title}\n`;
    }
  }

  prompt += `\n## YOUR TASK
Based on ALL the above context, generate 3-7 specific, actionable follow-up steps that will advance this deal. Think like your commission depends on it. Be specific, be strategic, prioritize what matters most RIGHT NOW.`;

  return prompt;
}
