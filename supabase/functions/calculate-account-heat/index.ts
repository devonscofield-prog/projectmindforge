import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AccountHeatAnalysis {
  score: number;
  temperature: "Hot" | "Warm" | "Lukewarm" | "Cold";
  trend: "Heating Up" | "Cooling Down" | "Stagnant";
  confidence: "High" | "Medium" | "Low";
  momentum_narrative: string;
  factors: {
    engagement: { score: number; weight: number; signals: string[] };
    relationship: { score: number; weight: number; signals: string[] };
    deal_progress: { score: number; weight: number; signals: string[] };
    call_quality: { score: number; weight: number; signals: string[] };
    timing: { score: number; weight: number; signals: string[] };
  };
  open_critical_gaps: { category: string; evidence: string }[];
  closed_gaps: { category: string; how_resolved: string }[];
  competitors_active: string[];
  recommended_actions: string[];
  risk_factors: string[];
  calculated_at: string;
}

const ACCOUNT_HEAT_TOOL = {
  type: "function",
  function: {
    name: "calculate_account_heat",
    description: "Calculate the account heat score based on comprehensive analysis of all calls and account data",
    parameters: {
      type: "object",
      properties: {
        heat_score: {
          type: "number",
          description: "Overall heat score 0-100. 70-100=Hot (clear path to close), 50-69=Warm (good engagement), 25-49=Lukewarm (needs attention), 0-24=Cold (stalled)"
        },
        temperature: {
          type: "string",
          enum: ["Hot", "Warm", "Lukewarm", "Cold"]
        },
        trend: {
          type: "string",
          enum: ["Heating Up", "Cooling Down", "Stagnant"],
          description: "Based on progression across calls - is deal momentum increasing or decreasing?"
        },
        confidence: {
          type: "string",
          enum: ["High", "Medium", "Low"],
          description: "How confident are you in this assessment based on available data?"
        },
        momentum_narrative: {
          type: "string",
          description: "2-3 sentence summary of deal progression across all calls. What's the story of this deal?"
        },
        engagement_analysis: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-100 engagement score" },
            signals: { type: "array", items: { type: "string" }, description: "Key engagement signals observed" }
          },
          required: ["score", "signals"]
        },
        relationship_analysis: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-100 relationship strength score" },
            signals: { type: "array", items: { type: "string" }, description: "Key relationship signals" }
          },
          required: ["score", "signals"]
        },
        deal_progress_analysis: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-100 deal progress score" },
            signals: { type: "array", items: { type: "string" }, description: "Key deal progress indicators" }
          },
          required: ["score", "signals"]
        },
        call_quality_analysis: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-100 call quality score" },
            signals: { type: "array", items: { type: "string" }, description: "Key call quality observations" }
          },
          required: ["score", "signals"]
        },
        timing_analysis: {
          type: "object",
          properties: {
            score: { type: "number", description: "0-100 timing/urgency score" },
            signals: { type: "array", items: { type: "string" }, description: "Key timing signals" }
          },
          required: ["score", "signals"]
        },
        open_critical_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["Budget", "Authority", "Need", "Timeline", "Competition", "Technical"] },
              evidence: { type: "string", description: "Specific evidence from transcripts showing this gap still exists" }
            },
            required: ["category", "evidence"]
          },
          description: "Critical gaps that are STILL OPEN based on most recent call. Only include if NOT resolved."
        },
        closed_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { type: "string" },
              how_resolved: { type: "string", description: "How/when this gap was addressed in the conversations" }
            },
            required: ["category", "how_resolved"]
          },
          description: "Gaps that were previously open but have been addressed in later calls"
        },
        competitors_active: {
          type: "array",
          items: { type: "string" },
          description: "Competitors mentioned across all calls"
        },
        recommended_actions: {
          type: "array",
          items: { type: "string" },
          description: "3 specific, actionable next steps based on the full conversation history"
        },
        risk_factors: {
          type: "array",
          items: { type: "string" },
          description: "What could kill this deal? Be specific based on conversation content"
        }
      },
      required: [
        "heat_score", "temperature", "trend", "confidence", "momentum_narrative",
        "engagement_analysis", "relationship_analysis", "deal_progress_analysis",
        "call_quality_analysis", "timing_analysis", "open_critical_gaps",
        "closed_gaps", "competitors_active", "recommended_actions", "risk_factors"
      ]
    }
  }
};

const SYSTEM_PROMPT = `You are an expert sales analyst evaluating the health of a B2B sales opportunity. You have access to:
- All raw call transcripts (chronologically ordered, oldest first)
- Account metadata (company info, revenue, status)
- Stakeholder map (who's involved, their influence levels)
- Recent activity history (emails, follow-ups)

Your job is to read through ALL the transcripts and provide a comprehensive Account Heat Score that reflects the TRUE state of this deal.

## Scoring Guidelines

**70-100 (Hot)**: Clear path to close. Budget confirmed or actively discussed. Decision maker engaged. Timeline established. Momentum positive.

**50-69 (Warm)**: Good engagement and interest. Gaps being actively addressed. Rep has access to key stakeholders. Some uncertainty but deal is moving.

**25-49 (Lukewarm)**: Gaps unresolved after multiple touches. Momentum unclear. Missing key stakeholder access. Needs significant attention.

**0-24 (Cold)**: Stalled or dead. No response to outreach. Critical blockers with no resolution path. Competitor has strong position.

## Critical Gap Tracking

IMPORTANT: Track gaps ACROSS calls. A gap mentioned in Call 1 but addressed in Call 3 should be in closed_gaps, NOT open_critical_gaps.
- Only include gaps in open_critical_gaps if they are STILL unresolved after the most recent call
- Include gaps in closed_gaps if they were raised earlier but subsequently addressed

## Factor Scoring

Score each factor 0-100:
- **Engagement**: How responsive is the prospect? Inbound interest? Meeting attendance?
- **Relationship**: Access to power? Champion identified? Multi-threaded?
- **Deal Progress**: Are critical gaps closing? Is scope defined? Moving toward commitment?
- **Call Quality**: Rep performance? Discovery depth? Handling objections well?
- **Timing**: Compelling event? Timeline pressure? Budget cycle alignment?

Be honest and critical. Don't inflate scores to be nice. A deal with unresolved Budget and Authority gaps cannot be "Hot".`;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospect_id } = await req.json();
    
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: 'prospect_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);

    console.log(`[AccountHeat] Calculating for prospect: ${prospect_id}`);

    // Fetch all relevant data in parallel - including raw_text
    const [
      prospectResult,
      callsResult,
      stakeholdersResult,
      activitiesResult,
      emailsResult,
      followUpsResult
    ] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts')
        .select('id, call_date, call_type, account_name, primary_stakeholder_name, raw_text, analysis_status')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .order('call_date', { ascending: true }), // Oldest first for chronological reading
      supabase.from('stakeholders')
        .select('*')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null),
      supabase.from('prospect_activities')
        .select('*')
        .eq('prospect_id', prospect_id)
        .order('activity_date', { ascending: false })
        .limit(20),
      supabase.from('email_logs')
        .select('*')
        .eq('prospect_id', prospect_id)
        .is('deleted_at', null)
        .order('email_date', { ascending: false })
        .limit(20),
      supabase.from('account_follow_ups')
        .select('*')
        .eq('prospect_id', prospect_id)
    ]);

    if (prospectResult.error || !prospectResult.data) {
      console.error('[AccountHeat] Prospect not found:', prospectResult.error);
      return new Response(JSON.stringify({ error: 'Prospect not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const prospect = prospectResult.data;
    const calls = callsResult.data || [];
    const stakeholders = stakeholdersResult.data || [];
    const activities = activitiesResult.data || [];
    const emails = emailsResult.data || [];
    const followUps = followUpsResult.data || [];

    console.log(`[AccountHeat] Found ${calls.length} calls, ${stakeholders.length} stakeholders`);

    // Build comprehensive context for AI
    const contextParts: string[] = [];

    // Account Overview
    contextParts.push(`## ACCOUNT OVERVIEW
- **Company**: ${prospect.prospect_name || prospect.account_name || 'Unknown'}
- **Industry**: ${prospect.industry || 'Not specified'}
- **Status**: ${prospect.status}
- **Active Revenue**: $${(prospect.active_revenue || 0).toLocaleString()}
- **Potential Revenue**: $${(prospect.potential_revenue || 0).toLocaleString()}
- **Last Contact**: ${prospect.last_contact_date || 'Unknown'}
- **Website**: ${prospect.website || 'Not recorded'}`);

    // Opportunity Details
    const oppDetails = prospect.opportunity_details as Record<string, any> | null;
    if (oppDetails) {
      contextParts.push(`## OPPORTUNITY DETAILS
${JSON.stringify(oppDetails, null, 2)}`);
    }

    // Stakeholder Map
    if (stakeholders.length > 0) {
      const stakeholderLines = stakeholders.map(s => {
        const info = [];
        if (s.job_title) info.push(s.job_title);
        if (s.influence_level) info.push(`Influence: ${s.influence_level}`);
        if (s.champion_score) info.push(`Champion Score: ${s.champion_score}/10`);
        if (s.is_primary_contact) info.push('PRIMARY CONTACT');
        return `- **${s.name}**: ${info.join(' | ')}`;
      });
      contextParts.push(`## STAKEHOLDERS (${stakeholders.length} mapped)
${stakeholderLines.join('\n')}`);
    } else {
      contextParts.push(`## STAKEHOLDERS
No stakeholders mapped for this account.`);
    }

    // Activity Summary
    if (activities.length > 0 || emails.length > 0) {
      const activityLines: string[] = [];
      activities.slice(0, 10).forEach(a => {
        activityLines.push(`- ${a.activity_date}: ${a.activity_type} - ${a.description || 'No description'}`);
      });
      emails.slice(0, 10).forEach(e => {
        activityLines.push(`- ${e.email_date}: Email (${e.direction}) - ${e.subject || 'No subject'}`);
      });
      contextParts.push(`## RECENT ACTIVITY (Last 20 items)
${activityLines.join('\n')}`);
    }

    // Follow-ups
    const pendingFollowUps = followUps.filter(f => f.status === 'pending');
    const completedFollowUps = followUps.filter(f => f.status === 'completed');
    if (followUps.length > 0) {
      contextParts.push(`## FOLLOW-UPS
- Pending: ${pendingFollowUps.length}
- Completed: ${completedFollowUps.length}
${pendingFollowUps.slice(0, 5).map(f => `- [PENDING] ${f.title}: ${f.description || ''}`).join('\n')}`);
    }

    // Raw Transcripts - the main content
    if (calls.length > 0) {
      contextParts.push(`\n## CALL TRANSCRIPTS (${calls.length} calls, chronological order - oldest first)\n`);
      
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        contextParts.push(`### CALL ${i + 1} of ${calls.length}
- **Date**: ${call.call_date}
- **Type**: ${call.call_type || 'Unknown'}
- **Primary Contact**: ${call.primary_stakeholder_name || 'Unknown'}
- **Analysis Status**: ${call.analysis_status}

**TRANSCRIPT:**
${call.raw_text}

---END OF CALL ${i + 1}---
`);
      }
    } else {
      contextParts.push(`## CALL TRANSCRIPTS
No calls recorded for this account.`);
    }

    const fullContext = contextParts.join('\n\n');
    console.log(`[AccountHeat] Context size: ${fullContext.length} chars (~${Math.round(fullContext.length / 4)} tokens)`);

    // Call AI with 60-second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    let analysis: AccountHeatAnalysis;

    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-3-pro-preview',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: fullContext }
          ],
          tools: [ACCOUNT_HEAT_TOOL],
          tool_choice: { type: 'function', function: { name: 'calculate_account_heat' } }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('[AccountHeat] AI API error:', aiResponse.status, errorText);
        throw new Error(`AI API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      
      if (!toolCall?.function?.arguments) {
        console.error('[AccountHeat] No tool call in response:', JSON.stringify(aiData));
        throw new Error('No tool call in AI response');
      }

      const result = JSON.parse(toolCall.function.arguments);
      console.log(`[AccountHeat] AI returned score: ${result.heat_score}, temp: ${result.temperature}`);

      // Map AI result to our schema
      analysis = {
        score: Math.round(Math.max(0, Math.min(100, result.heat_score))),
        temperature: result.temperature,
        trend: result.trend,
        confidence: result.confidence,
        momentum_narrative: result.momentum_narrative,
        factors: {
          engagement: { 
            score: result.engagement_analysis?.score || 0, 
            weight: 15, 
            signals: result.engagement_analysis?.signals || [] 
          },
          relationship: { 
            score: result.relationship_analysis?.score || 0, 
            weight: 20, 
            signals: result.relationship_analysis?.signals || [] 
          },
          deal_progress: { 
            score: result.deal_progress_analysis?.score || 0, 
            weight: 25, 
            signals: result.deal_progress_analysis?.signals || [] 
          },
          call_quality: { 
            score: result.call_quality_analysis?.score || 0, 
            weight: 20, 
            signals: result.call_quality_analysis?.signals || [] 
          },
          timing: { 
            score: result.timing_analysis?.score || 0, 
            weight: 20, 
            signals: result.timing_analysis?.signals || [] 
          }
        },
        open_critical_gaps: result.open_critical_gaps || [],
        closed_gaps: result.closed_gaps || [],
        competitors_active: result.competitors_active || [],
        recommended_actions: (result.recommended_actions || []).slice(0, 5),
        risk_factors: (result.risk_factors || []).slice(0, 5),
        calculated_at: new Date().toISOString()
      };

    } catch (aiError) {
      clearTimeout(timeoutId);
      console.error('[AccountHeat] AI analysis failed:', aiError);
      
      // Fallback to simple heuristic if AI fails
      analysis = buildFallbackAnalysis(prospect, calls, stakeholders, activities, emails);
    }

    // Save to database
    const { error: updateError } = await supabase
      .from('prospects')
      .update({
        account_heat_score: analysis.score,
        account_heat_analysis: analysis,
        account_heat_updated_at: new Date().toISOString()
      })
      .eq('id', prospect_id);

    if (updateError) {
      console.error('[AccountHeat] Failed to save:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save analysis' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AccountHeat] Saved score ${analysis.score} for ${prospect_id}`);

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AccountHeat] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Simple fallback if AI fails
function buildFallbackAnalysis(
  prospect: any,
  calls: any[],
  stakeholders: any[],
  activities: any[],
  emails: any[]
): AccountHeatAnalysis {
  console.log('[AccountHeat] Using fallback heuristic analysis');
  
  let score = 25; // Start lukewarm
  const signals: string[] = [];
  
  // Boost for calls
  if (calls.length >= 3) {
    score += 20;
    signals.push(`${calls.length} calls recorded`);
  } else if (calls.length >= 1) {
    score += 10;
    signals.push(`${calls.length} call(s) recorded`);
  }
  
  // Boost for stakeholders
  if (stakeholders.length >= 2) {
    score += 15;
    signals.push(`${stakeholders.length} stakeholders mapped`);
  }
  
  // Boost for activity
  if (activities.length + emails.length >= 5) {
    score += 10;
    signals.push('Active engagement');
  }
  
  // Boost for revenue
  if (prospect.active_revenue && prospect.active_revenue > 0) {
    score += 15;
    signals.push('Active revenue opportunity');
  }
  
  score = Math.min(score, 100);
  
  const temperature = score >= 70 ? "Hot" : score >= 50 ? "Warm" : score >= 25 ? "Lukewarm" : "Cold";
  
  return {
    score,
    temperature,
    trend: "Stagnant",
    confidence: "Low",
    momentum_narrative: "Unable to perform AI analysis. This is a basic heuristic score based on data availability.",
    factors: {
      engagement: { score: Math.min((activities.length + emails.length) * 10, 100), weight: 15, signals: signals.slice(0, 2) },
      relationship: { score: Math.min(stakeholders.length * 25, 100), weight: 20, signals: [] },
      deal_progress: { score: prospect.active_revenue > 0 ? 50 : 20, weight: 25, signals: [] },
      call_quality: { score: calls.length > 0 ? 50 : 0, weight: 20, signals: [] },
      timing: { score: 25, weight: 20, signals: [] }
    },
    open_critical_gaps: [],
    closed_gaps: [],
    competitors_active: [],
    recommended_actions: [
      'Review call transcripts manually',
      'Schedule follow-up with key stakeholder',
      'Clarify budget and timeline'
    ],
    risk_factors: ['AI analysis unavailable - manual review recommended'],
    calculated_at: new Date().toISOString()
  };
}
