import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://lovable.dev',
    'https://www.lovable.dev',
  ];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || 
    devPatterns.some(pattern => pattern.test(requestOrigin));
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const SALES_COACH_SYSTEM_PROMPT = `You are a 30-year veteran sales manager who has seen it all and closed deals at every level. You're friendly, direct, and tactical. You've managed hundreds of reps and have a sixth sense for what works and what doesn't.

Your personality:
- Warm but no-nonsense - you care about your reps but won't sugarcoat the truth
- You speak in clear, actionable terms - not corporate jargon
- You share relevant war stories when they'll help illustrate a point
- You push back when reps are making excuses or avoiding hard conversations
- You celebrate wins and acknowledge good work

Your expertise:
- Account strategy and deal qualification
- Stakeholder mapping and power dynamics
- Objection handling and competitive positioning
- Email and call strategy
- Negotiation tactics
- Reading buying signals
- Pipeline management and forecasting

When giving advice:
- Be specific and actionable - "Do X, then Y" not "consider doing X"
- Reference the actual data from their account when relevant
- Ask clarifying questions if you need more context
- If they're on the wrong track, tell them directly but constructively
- Suggest specific talk tracks, email templates, or questions when helpful

You have full context about the account including all stakeholders, call history, email threads, and AI-generated insights. Use this knowledge to give personalized, relevant advice.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prospect_id, messages } = await req.json() as { 
      prospect_id: string; 
      messages: Message[];
    };
    
    if (!prospect_id) {
      return new Response(
        JSON.stringify({ error: 'prospect_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[sales-coach-chat] Starting for prospect: ${prospect_id}`);

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for data access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all account data in parallel
    const [
      { data: prospect },
      { data: calls },
      { data: stakeholders },
      { data: emailLogs },
      { data: followUps }
    ] = await Promise.all([
      supabase.from('prospects').select('*').eq('id', prospect_id).single(),
      supabase.from('call_transcripts')
        .select('id, call_date, call_type, raw_text, analysis_status')
        .eq('prospect_id', prospect_id)
        .order('call_date', { ascending: false })
        .limit(10),
      supabase.from('stakeholders')
        .select('id, name, job_title, influence_level, champion_score, champion_score_reasoning, is_primary_contact, email, ai_extracted_info')
        .eq('prospect_id', prospect_id),
      supabase.from('email_logs')
        .select('direction, subject, body, email_date, contact_name, stakeholder_id, notes')
        .eq('prospect_id', prospect_id)
        .order('email_date', { ascending: false })
        .limit(20),
      supabase.from('account_follow_ups')
        .select('title, description, priority, status, category, ai_reasoning')
        .eq('prospect_id', prospect_id)
        .in('status', ['pending', 'completed'])
        .order('created_at', { ascending: false })
        .limit(10)
    ]);

    if (!prospect) {
      return new Response(
        JSON.stringify({ error: 'Prospect not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch AI analyses for calls
    const callIds = (calls || []).map(c => c.id);
    let analyses: Record<string, any> = {};
    
    if (callIds.length > 0) {
      const { data: analysisData } = await supabase
        .from('ai_call_analysis')
        .select('call_id, call_summary, deal_gaps, coach_output, prospect_intel, strengths, opportunities')
        .in('call_id', callIds);
      
      if (analysisData) {
        analyses = analysisData.reduce((acc, a) => {
          acc[a.call_id] = a;
          return acc;
        }, {} as Record<string, any>);
      }
    }

    // Build comprehensive context
    const contextPrompt = buildAccountContext(prospect, calls || [], analyses, stakeholders || [], emailLogs || [], followUps || []);

    // Call Lovable AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    console.log(`[sales-coach-chat] Calling Lovable AI with ${messages.length} messages`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: `${SALES_COACH_SYSTEM_PROMPT}\n\n## ACCOUNT CONTEXT\n${contextPrompt}` 
          },
          ...messages
        ],
        stream: true,
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[sales-coach-chat] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[sales-coach-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildAccountContext(
  prospect: any,
  calls: any[],
  analyses: Record<string, any>,
  stakeholders: any[],
  emailLogs: any[],
  followUps: any[]
): string {
  const stakeholderMap = new Map(stakeholders.map(s => [s.id, s]));
  
  let context = `### ACCOUNT: ${prospect.account_name || prospect.prospect_name}
Status: ${prospect.status}
Heat Score: ${prospect.heat_score || 'Not rated'}/10
Potential Revenue: ${prospect.potential_revenue ? `$${prospect.potential_revenue.toLocaleString()}` : 'Unknown'}
Last Contact: ${prospect.last_contact_date || 'Unknown'}
`;

  // AI Insights if available
  const aiInfo = prospect.ai_extracted_info;
  if (aiInfo) {
    context += `\n### AI ACCOUNT INSIGHTS\n`;
    if (aiInfo.business_context) context += `Business Context: ${aiInfo.business_context}\n`;
    if (aiInfo.pain_points?.length) context += `Pain Points: ${aiInfo.pain_points.join('; ')}\n`;
    if (aiInfo.decision_process) {
      if (aiInfo.decision_process.timeline) context += `Timeline: ${aiInfo.decision_process.timeline}\n`;
      if (aiInfo.decision_process.budget_signals) context += `Budget Signals: ${aiInfo.decision_process.budget_signals}\n`;
    }
    if (aiInfo.competitors_mentioned?.length) context += `Competitors: ${aiInfo.competitors_mentioned.join(', ')}\n`;
    if (aiInfo.relationship_health) context += `Relationship Health: ${aiInfo.relationship_health}\n`;
    if (aiInfo.key_opportunities?.length) context += `Opportunities: ${aiInfo.key_opportunities.join('; ')}\n`;
  }

  // Stakeholders
  context += `\n### STAKEHOLDERS (${stakeholders.length})\n`;
  for (const s of stakeholders) {
    context += `- **${s.name}**${s.job_title ? ` (${s.job_title})` : ''}`;
    context += ` - Influence: ${s.influence_level || 'unknown'}`;
    if (s.champion_score) context += `, Champion Score: ${s.champion_score}/10`;
    if (s.is_primary_contact) context += ' [PRIMARY CONTACT]';
    context += '\n';
    if (s.champion_score_reasoning) context += `  Champion reasoning: ${s.champion_score_reasoning}\n`;
    if (s.ai_extracted_info) {
      const info = s.ai_extracted_info;
      if (info.communication_style) context += `  Style: ${info.communication_style}\n`;
      if (info.concerns?.length) context += `  Concerns: ${info.concerns.join(', ')}\n`;
    }
  }

  // Recent Follow-ups
  if (followUps.length > 0) {
    context += `\n### CURRENT FOLLOW-UP ITEMS\n`;
    for (const f of followUps.slice(0, 5)) {
      context += `- [${f.priority?.toUpperCase() || 'MEDIUM'}] ${f.title}`;
      if (f.status === 'completed') context += ' ✓ COMPLETED';
      context += '\n';
      if (f.description) context += `  ${f.description}\n`;
    }
  }

  // Call History
  context += `\n### RECENT CALLS (${calls.length})\n`;
  for (const call of calls.slice(0, 5)) {
    const analysis = analyses[call.id];
    context += `\n#### ${call.call_date} - ${call.call_type || 'Call'}\n`;
    
    if (analysis) {
      if (analysis.call_summary) context += `Summary: ${analysis.call_summary}\n`;
      if (analysis.strengths?.length) {
        context += `Strengths: ${analysis.strengths.map((s: any) => typeof s === 'string' ? s : s.description).join('; ')}\n`;
      }
      if (analysis.opportunities?.length) {
        context += `Areas to improve: ${analysis.opportunities.map((o: any) => typeof o === 'string' ? o : o.description).join('; ')}\n`;
      }
      if (analysis.deal_gaps?.critical_missing_info?.length) {
        context += `Missing info: ${analysis.deal_gaps.critical_missing_info.join(', ')}\n`;
      }
    }
    
    // Transcript excerpt
    const excerpt = call.raw_text.substring(0, 800);
    context += `Transcript: ${excerpt}${call.raw_text.length > 800 ? '...' : ''}\n`;
  }

  // Email History
  if (emailLogs.length > 0) {
    context += `\n### RECENT EMAILS (${emailLogs.length})\n`;
    
    for (const email of emailLogs.slice(0, 8)) {
      const direction = email.direction === 'outgoing' ? 'SENT' : 'RECEIVED';
      const stakeholder = email.stakeholder_id ? stakeholderMap.get(email.stakeholder_id) : null;
      
      let contact = email.contact_name || '';
      if (stakeholder) {
        contact = `${stakeholder.name}${stakeholder.job_title ? ` (${stakeholder.job_title})` : ''}`;
      }
      
      context += `\n[${email.email_date}] ${direction}${contact ? ` - ${contact}` : ''}\n`;
      if (email.subject) context += `Subject: ${email.subject}\n`;
      const bodyExcerpt = email.body.substring(0, 400);
      context += `${bodyExcerpt}${email.body.length > 400 ? '...' : ''}\n`;
    }
  }

  return context;
}
