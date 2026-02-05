/**
 * generate-call-follow-up-suggestions Edge Function
 * 
 * "The Advisor" - Generates intelligent follow-up suggestions after call analysis completes.
 * Analyzes the call transcript, analysis results, and account history to recommend
 * specific follow-up actions with timing recommendations.
 */

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface FollowUpSuggestion {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  category: 'discovery' | 'stakeholder' | 'objection' | 'proposal' | 'relationship' | 'competitive';
  suggested_due_days: number | null;
  urgency_signal: string | null;
  ai_reasoning: string;
  related_evidence: string | null;
  status: 'pending' | 'accepted' | 'dismissed';
}

const ADVISOR_SYSTEM_PROMPT = `You are "The Advisor," a 20-year B2B/SaaS sales veteran analyzing a just-completed call to recommend actionable next steps.

Your task is to generate 3-7 SPECIFIC, ACTIONABLE follow-up tasks. Each task should be something the rep can execute within the suggested timeframe.

PRIORITIZATION RULES (in order):
1. Address critical gaps identified in the analysis (missing key stakeholders, unresolved blockers)
2. Follow up on unresolved objections or concerns raised
3. Expand stakeholder coverage if decision maker wasn't on call
4. Capitalize on urgency signals mentioned (deadlines, budget cycles, competitive pressure)
5. Build on momentum if call went well

For each follow-up, you MUST provide:
- title: Action verb + specific outcome (max 60 chars). Examples: "Schedule demo with IT Director", "Send ROI comparison vs. competitor X"
- description: 1-2 sentences explaining WHY this matters NOW
- priority: high/medium/low based on deal impact and urgency
- category: One of: discovery, stakeholder, objection, proposal, relationship, competitive
- suggested_due_days: When this should be done (1=tomorrow, 3=in 3 days, 7=next week, null if no specific timing)
- urgency_signal: Time-sensitive cue from the call (e.g., "Q1 budget deadline mentioned") or null
- ai_reasoning: 2-3 sentences explaining your thinking
- related_evidence: Quote or paraphrase from the call that drove this recommendation, or null

Be specific and actionable. Avoid generic advice like "follow up" or "check in." Instead say exactly WHAT to follow up about and WHO to involve.`;

async function callLovableAI(
  messages: Array<{ role: string; content: string }>,
  tools: unknown[],
  toolChoice: unknown
): Promise<FollowUpSuggestion[] | null> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    console.error('[advisor] LOVABLE_API_KEY not configured');
    return null;
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-pro-preview',
        messages,
        tools,
        tool_choice: toolChoice,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[advisor] AI gateway error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error('[advisor] No tool call in response');
      return null;
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return parsed.suggestions || [];
  } catch (error) {
    console.error('[advisor] Error calling AI:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { call_id, trigger_source } = await req.json();

    if (!call_id) {
      return new Response(
        JSON.stringify({ error: 'call_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[advisor] Generating follow-up suggestions for call ${call_id}, trigger: ${trigger_source || 'direct'}`);

    // Fetch call transcript with analysis - use explicit FK hint to avoid PGRST201 error
    const { data: transcript, error: transcriptError } = await supabaseAdmin
      .from('call_transcripts')
      .select(`
        id, raw_text, account_name, primary_stakeholder_name, call_date, call_type, prospect_id, rep_id,
        ai_call_analysis!ai_call_analysis_call_id_fkey (
          id, call_summary, analysis_strategy, analysis_behavior, analysis_coaching, analysis_metadata, deal_heat_analysis
        )
      `)
      .eq('id', call_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (transcriptError || !transcript) {
      console.error('[advisor] Failed to fetch transcript:', transcriptError);
      return new Response(
        JSON.stringify({ error: 'Call not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const analysis = Array.isArray(transcript.ai_call_analysis) 
      ? transcript.ai_call_analysis[0] 
      : transcript.ai_call_analysis;

    if (!analysis) {
      console.log('[advisor] No analysis found for call, skipping suggestions');
      return new Response(
        JSON.stringify({ error: 'Call analysis not found' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch account history if prospect_id exists
    let accountContext = '';
    if (transcript.prospect_id) {
      // Previous calls
      const { data: previousCalls } = await supabaseAdmin
        .from('call_transcripts')
        .select(`
          call_date, call_type, account_name,
          ai_call_analysis (call_summary, analysis_strategy)
        `)
        .eq('prospect_id', transcript.prospect_id)
        .neq('id', call_id)
        .eq('analysis_status', 'completed')
        .is('deleted_at', null)
        .order('call_date', { ascending: false })
        .limit(5);

      // Stakeholders
      const { data: stakeholders } = await supabaseAdmin
        .from('stakeholders')
        .select('name, title, role_type, champion_score, influence_level')
        .eq('prospect_id', transcript.prospect_id)
        .is('deleted_at', null)
        .limit(10);

      // Email logs
      const { data: recentEmails } = await supabaseAdmin
        .from('email_logs')
        .select('subject, direction, email_date')
        .eq('prospect_id', transcript.prospect_id)
        .is('deleted_at', null)
        .order('email_date', { ascending: false })
        .limit(5);

      // Existing follow-ups
      const { data: existingFollowUps } = await supabaseAdmin
        .from('account_follow_ups')
        .select('title, priority, status, due_date')
        .eq('prospect_id', transcript.prospect_id)
        .eq('status', 'pending')
        .limit(10);

      // Build account context
      if (previousCalls && previousCalls.length > 0) {
        accountContext += '\n\n### Previous Calls with this Account:\n';
        previousCalls.forEach((call, i) => {
          const callAnalysis = Array.isArray(call.ai_call_analysis) 
            ? call.ai_call_analysis[0] 
            : call.ai_call_analysis;
          const strategy = callAnalysis?.analysis_strategy as { critical_gaps?: Array<{ category: string; description: string }> } | null;
          accountContext += `${i + 1}. ${call.call_date} (${call.call_type || 'call'}): ${callAnalysis?.call_summary || 'No summary'}\n`;
          if (strategy?.critical_gaps?.length) {
            accountContext += `   Critical Gaps: ${strategy.critical_gaps.map(g => g.category).join(', ')}\n`;
          }
        });
      }

      if (stakeholders && stakeholders.length > 0) {
        accountContext += '\n\n### Known Stakeholders:\n';
        stakeholders.forEach(s => {
          accountContext += `- ${s.name} (${s.title || 'Unknown title'}): ${s.role_type || 'unknown role'}, Champion Score: ${s.champion_score || 'N/A'}\n`;
        });
      }

      if (recentEmails && recentEmails.length > 0) {
        accountContext += '\n\n### Recent Email Activity:\n';
        recentEmails.forEach(e => {
          accountContext += `- ${e.email_date}: ${e.direction === 'sent' ? 'Sent' : 'Received'} - "${e.subject}"\n`;
        });
      }

      if (existingFollowUps && existingFollowUps.length > 0) {
        accountContext += '\n\n### Existing Pending Follow-ups (avoid duplicates):\n';
        existingFollowUps.forEach(f => {
          accountContext += `- [${f.priority}] ${f.title}${f.due_date ? ` (due: ${f.due_date})` : ''}\n`;
        });
      }
    }

    // Extract key analysis data
    const strategy = analysis.analysis_strategy as {
      critical_gaps?: Array<{ category: string; description: string; impact: string }>;
      objection_handling?: { unresolved_objections?: Array<{ objection: string; status: string }> };
      pain_to_pitch?: Array<{ pain: string; severity: string }>;
    } | null;

    const coaching = analysis.analysis_coaching as {
      overall_grade?: string;
      coaching_prescription?: string;
      immediate_action?: string;
    } | null;

    const dealHeat = analysis.deal_heat_analysis as {
      heat_score?: number;
      key_drivers?: string[];
      risks?: string[];
    } | null;

    // Build the prompt
    const userPrompt = `# Call Analysis for ${transcript.account_name || 'Unknown Account'}

## Call Overview
- Date: ${transcript.call_date}
- Type: ${transcript.call_type || 'Call'}
- Primary Contact: ${transcript.primary_stakeholder_name || 'Unknown'}
- Deal Heat Score: ${dealHeat?.heat_score || 'N/A'}/100

## Call Summary
${analysis.call_summary || 'No summary available'}

## Critical Gaps Identified
${strategy?.critical_gaps?.length 
  ? strategy.critical_gaps.map(g => `- [${g.category}] ${g.description} (Impact: ${g.impact})`).join('\n')
  : 'No critical gaps identified'}

## Unresolved Objections
${strategy?.objection_handling?.unresolved_objections?.length
  ? strategy.objection_handling.unresolved_objections.map(o => `- ${o.objection}`).join('\n')
  : 'No unresolved objections'}

## Deal Risks
${dealHeat?.risks?.length ? dealHeat.risks.map(r => `- ${r}`).join('\n') : 'None identified'}

## Coaching Recommendation
${coaching?.coaching_prescription || 'No coaching prescription'}

## Immediate Action Suggested
${coaching?.immediate_action || 'None'}
${accountContext}

## Full Transcript (for context and evidence)
${transcript.raw_text.substring(0, 15000)}${transcript.raw_text.length > 15000 ? '\n...[truncated]' : ''}

---
Based on this analysis, generate 3-7 specific, actionable follow-up tasks for the sales rep. Prioritize tasks that address critical gaps and unresolved objections. Avoid duplicating existing follow-ups listed above.`;

    // Define the tool for structured output
    const tools = [
      {
        type: 'function',
        function: {
          name: 'generate_follow_up_suggestions',
          description: 'Generate a list of follow-up action items for the sales rep',
          parameters: {
            type: 'object',
            properties: {
              suggestions: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    title: { type: 'string', description: 'Action verb + specific outcome (max 60 chars)' },
                    description: { type: 'string', description: 'Why this matters now (1-2 sentences)' },
                    priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                    category: { type: 'string', enum: ['discovery', 'stakeholder', 'objection', 'proposal', 'relationship', 'competitive'] },
                    suggested_due_days: { type: ['number', 'null'], description: 'Days from now (1=tomorrow, 7=next week, null=no timing)' },
                    urgency_signal: { type: ['string', 'null'], description: 'Time-sensitive cue from the call' },
                    ai_reasoning: { type: 'string', description: 'Why this suggestion (2-3 sentences)' },
                    related_evidence: { type: ['string', 'null'], description: 'Quote from transcript supporting this' },
                  },
                  required: ['title', 'description', 'priority', 'category', 'ai_reasoning'],
                  additionalProperties: false,
                },
                minItems: 3,
                maxItems: 7,
              },
            },
            required: ['suggestions'],
            additionalProperties: false,
          },
        },
      },
    ];

    const suggestions = await callLovableAI(
      [
        { role: 'system', content: ADVISOR_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      tools,
      { type: 'function', function: { name: 'generate_follow_up_suggestions' } }
    );

    if (!suggestions || suggestions.length === 0) {
      console.log('[advisor] No suggestions generated');
      return new Response(
        JSON.stringify({ success: true, suggestions: [], message: 'No suggestions generated' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Add IDs and default status to each suggestion
    const suggestionsWithIds: FollowUpSuggestion[] = suggestions.map((s) => ({
      ...s,
      id: crypto.randomUUID(),
      status: 'pending' as const,
    }));

    console.log(`[advisor] Generated ${suggestionsWithIds.length} suggestions for call ${call_id}`);

    // Save suggestions to ai_call_analysis
    const { error: updateError } = await supabaseAdmin
      .from('ai_call_analysis')
      .update({ follow_up_suggestions: suggestionsWithIds })
      .eq('id', analysis.id);

    if (updateError) {
      console.error('[advisor] Failed to save suggestions:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save suggestions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[advisor] ✅ Saved ${suggestionsWithIds.length} suggestions for call ${call_id}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        suggestions: suggestionsWithIds,
        count: suggestionsWithIds.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[advisor] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
