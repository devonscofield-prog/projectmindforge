import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { checkRateLimit } from "../_shared/rateLimiter.ts";

function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [
    /^https?:\/\/localhost(:\d+)?$/,
    /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/,
    /^https:\/\/[a-z0-9-]+\.lovable\.app$/,
  ];
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    const cleanDomain = customDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '').trim();
    if (cleanDomain) {
      allowedOrigins.push(`https://${cleanDomain}`);
      allowedOrigins.push(`https://www.${cleanDomain}`);
    }
  }
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(p => p.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(50000)
});

const requestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50)
});

const SDR_MANAGER_SYSTEM_PROMPT = `You are an AI coaching assistant for an SDR (Sales Development Rep) Manager. You have complete visibility into the manager's team performance, call grades, and transcripts.

Your Role:
- Identify coaching opportunities across the team
- Compare rep performance and spot patterns
- Surface reps who need the most attention
- Analyze grade trends and improvement areas
- Help plan 1:1 coaching sessions with data-backed insights

Your Personality:
- Strategic and coaching-focused
- Data-driven — reference specific reps, grades, and metrics
- Actionable — every insight should lead to a coaching action
- Supportive — frame feedback constructively

Communication:
- Jump into substance quickly. Reference specifics, not generic phrases.
- Ask clarifying questions rather than assuming. Give 1-2 actionable suggestions, not lists.
- When asked about team-wide issues, provide aggregate insights before drilling into individuals.

Confidentiality:
- Do not share individual rep details across reps. Each rep's performance data is private to them and their manager.
- When a manager asks about a specific rep, only share that rep's data — never compare by revealing another rep's private details to them.

Escalation Awareness:
- If a rep has a consistent declining trend (3+ calls trending downward, or average score dropping over time), proactively suggest specific intervention strategies — not just "coach them more," but concrete actions like ride-alongs, script reviews, or role-play sessions.
- Flag reps at risk of burnout or disengagement based on call volume drops or score patterns.

When Responding:
- Reference specific team members by name
- Highlight performance gaps with data
- Suggest specific coaching interventions
- Compare reps objectively
- Be concise but thorough`;

const SDR_REP_SYSTEM_PROMPT = `You are an AI coaching assistant for an SDR (Sales Development Rep). You have access to their call history, grades, and performance data.

Your Role:
- Help the SDR improve their cold calling skills
- Review their recent call grades and identify patterns
- Provide specific, actionable coaching advice
- Celebrate improvements and highlight strengths
- Help them prepare for calls

Personality:
- Match tone to the moment — direct for clarity, supportive when struggling, energized with momentum.
- Encouraging but honest. Collaborative ("Let's look at this..."), conversational.
- Growth-oriented — focus on improvement trajectories.

Communication:
- Jump into substance quickly. Reference their actual data and grades, not generic phrases.
- Vary your openings — sometimes a question, sometimes a suggestion, sometimes an observation from their data.
- Ask clarifying questions rather than assuming. Give 1-2 actionable suggestions, not lists.
- Tough truths: acknowledge what's hard → give honest feedback → follow with encouragement.
- Use "What if you tried..." not "You should..."

When Responding:
- Reference their specific grades and scores
- Point out both strengths and areas for improvement
- Give concrete examples of what to say or do differently
- Be concise and actionable
- Help them feel confident, not criticized`;

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
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const validation = requestSchema.safeParse(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Validation failed', issues: validation.error.errors }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { messages } = validation.data;

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

    const rateLimit = await checkRateLimit(supabase, user.id, 'sdr-assistant-chat', 20, 60);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfter || 60) }
      });
    }

    // Determine user role
    const { data: userRole } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
    const isManager = userRole?.role === 'sdr_manager';

    let contextPrompt: string;
    let systemPrompt: string;

    if (isManager) {
      systemPrompt = SDR_MANAGER_SYSTEM_PROMPT;
      contextPrompt = await buildManagerContext(supabase, user.id);
    } else {
      systemPrompt = SDR_REP_SYSTEM_PROMPT;
      contextPrompt = await buildSDRContext(supabase, user.id);
    }

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');

    console.log(`[sdr-assistant-chat] Calling OpenAI (${isManager ? 'manager' : 'sdr'}) with ${messages.length} messages`);

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('SDR_GPT_MODEL') || 'gpt-5.2',
        messages: [
          { role: 'system', content: `${systemPrompt}\n\n## CONTEXT DATA\n${contextPrompt}` },
          ...messages.slice(-20)
        ],
        stream: true,
        max_completion_tokens: 8192,
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      const errorText = await aiResponse.text();
      console.error('[sdr-assistant-chat] AI error:', aiResponse.status, errorText);
      throw new Error(`AI error: ${aiResponse.status}`);
    }

    return new Response(aiResponse.body, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' } });

  } catch (error) {
    console.error('[sdr-assistant-chat] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

async function buildManagerContext(supabase: any, managerId: string): Promise<string> {
  // Get manager's teams and members
  const { data: teams } = await supabase.from('sdr_teams').select('id, name').eq('manager_id', managerId);
  if (!teams || teams.length === 0) return 'No SDR team found for this manager.';

  const teamIds = teams.map((t: any) => t.id);
  const { data: members } = await supabase.from('sdr_team_members').select('user_id, team_id').in('team_id', teamIds);
  if (!members || members.length === 0) return 'No team members found.';

  const memberIds = members.map((m: any) => m.user_id);

  // Fetch profiles, calls, and grades in parallel
  const [
    { data: profiles },
    { data: calls },
    _unused1,
    { data: _transcripts }
  ] = await Promise.all([
    supabase.from('profiles').select('id, name, email').in('id', memberIds),
    supabase.from('sdr_calls').select('id, sdr_id, call_index, is_meaningful, prospect_name, prospect_company, call_type, created_at').in('sdr_id', memberIds).order('created_at', { ascending: false }).limit(200),
    supabase.from('sdr_call_grades').select('call_id, overall_grade, overall_score, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, call_summary, strengths, improvements, coaching_notes, meeting_scheduled').in('call_id', ([] as string[])),  // Will be filled after calls
    supabase.from('sdr_daily_transcripts').select('id, sdr_id, transcript_date, total_calls_detected, meaningful_calls_count, processing_status').in('sdr_id', memberIds).order('transcript_date', { ascending: false }).limit(50)
  ]);

  // Now fetch grades for the calls we have
  const callIds = (calls || []).map((c: any) => c.id);
  let gradeMap: Record<string, any> = {};
  if (callIds.length > 0) {
    const { data: gradeData } = await supabase.from('sdr_call_grades').select('call_id, overall_grade, overall_score, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, call_summary, strengths, improvements, coaching_notes, meeting_scheduled').in('call_id', callIds);
    if (gradeData) {
      for (const g of gradeData) gradeMap[g.call_id] = g;
    }
  }

  const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

  // Build per-rep stats
  const repStats: Record<string, { name: string; totalCalls: number; meaningfulCalls: number; gradedCalls: number; grades: Record<string, number>; totalScore: number; meetings: number; recentGradedCalls: any[] }> = {};
  
  for (const mid of memberIds) {
    const profile = profileMap.get(mid);
    repStats[mid] = { name: profile?.name || 'Unknown', totalCalls: 0, meaningfulCalls: 0, gradedCalls: 0, grades: {}, totalScore: 0, meetings: 0, recentGradedCalls: [] };
  }

  for (const call of (calls || [])) {
    const stat = repStats[call.sdr_id];
    if (!stat) continue;
    stat.totalCalls++;
    if (call.is_meaningful) stat.meaningfulCalls++;
    
    const grade = gradeMap[call.id];
    if (grade) {
      stat.gradedCalls++;
      stat.grades[grade.overall_grade] = (stat.grades[grade.overall_grade] || 0) + 1;
      if (grade.overall_score) stat.totalScore += grade.overall_score;
      if (grade.meeting_scheduled) stat.meetings++;
      if (stat.recentGradedCalls.length < 5) {
        stat.recentGradedCalls.push({ ...grade, prospect_name: call.prospect_name, prospect_company: call.prospect_company });
      }
    }
  }

  // Build context string
  let context = `### TEAM OVERVIEW\n`;
  for (const team of teams) {
    const teamMembers = members.filter((m: any) => m.team_id === team.id);
    context += `Team: ${team.name} (${teamMembers.length} members)\n`;
  }

  context += `\n### PER-REP PERFORMANCE\n`;
  const sortedReps = Object.entries(repStats).sort((a, b) => {
    const avgA = a[1].gradedCalls > 0 ? a[1].totalScore / a[1].gradedCalls : 0;
    const avgB = b[1].gradedCalls > 0 ? b[1].totalScore / b[1].gradedCalls : 0;
    return avgA - avgB; // Lowest first for coaching priority
  });

  for (const [_repId, stat] of sortedReps) {
    const avg = stat.gradedCalls > 0 ? Math.round((stat.totalScore / stat.gradedCalls) * 10) / 10 : null;
    const gradeStr = Object.entries(stat.grades).map(([g, c]) => `${g}:${c}`).join(', ');
    context += `\n**${stat.name}**\n`;
    context += `  Calls: ${stat.totalCalls} total, ${stat.meaningfulCalls} meaningful, ${stat.gradedCalls} graded\n`;
    if (avg !== null) context += `  Avg Score: ${avg} | Grades: ${gradeStr}\n`;
    if (stat.meetings > 0) context += `  Meetings Set: ${stat.meetings}\n`;
  }

  // Coaching priorities
  const lowPerformers = sortedReps.filter(([_, s]) => s.gradedCalls >= 3 && (s.totalScore / s.gradedCalls) < 60);
  if (lowPerformers.length > 0) {
    context += `\n### COACHING PRIORITIES (Avg Score < 60)\n`;
    for (const [_, stat] of lowPerformers) {
      const avg = Math.round((stat.totalScore / stat.gradedCalls) * 10) / 10;
      context += `- ${stat.name}: Avg ${avg} across ${stat.gradedCalls} calls\n`;
    }
  }

  // Recent graded calls with details
  context += `\n### RECENT GRADED CALLS (Per Rep, Last 5 Each)\n`;
  for (const [_, stat] of sortedReps) {
    if (stat.recentGradedCalls.length === 0) continue;
    context += `\n**${stat.name}:**\n`;
    for (const call of stat.recentGradedCalls) {
      context += `- Grade: ${call.overall_grade} (${call.overall_score}) | ${call.prospect_name || 'Unknown'}`;
      if (call.meeting_scheduled) context += ' ✅ Meeting';
      context += '\n';
      if (call.call_summary) context += `  Summary: ${call.call_summary.substring(0, 150)}\n`;
      if (call.coaching_notes) context += `  Coaching: ${call.coaching_notes.substring(0, 150)}\n`;
    }
  }

  return context;
}

async function buildSDRContext(supabase: any, sdrId: string): Promise<string> {
  // Fetch SDR's calls and grades
  const [
    { data: calls },
    { data: transcripts },
    { data: profile }
  ] = await Promise.all([
    supabase.from('sdr_calls').select('id, call_index, is_meaningful, prospect_name, prospect_company, call_type, created_at, daily_transcript_id').eq('sdr_id', sdrId).eq('is_meaningful', true).order('created_at', { ascending: false }).limit(100),
    supabase.from('sdr_daily_transcripts').select('id, transcript_date, total_calls_detected, meaningful_calls_count, processing_status').eq('sdr_id', sdrId).order('transcript_date', { ascending: false }).limit(20),
    supabase.from('profiles').select('name').eq('id', sdrId).single()
  ]);

  const callIds = (calls || []).map((c: any) => c.id);
  let gradeMap: Record<string, any> = {};
  if (callIds.length > 0) {
    const { data: gradeData } = await supabase.from('sdr_call_grades').select('call_id, overall_grade, overall_score, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, call_summary, strengths, improvements, coaching_notes, meeting_scheduled').in('call_id', callIds);
    if (gradeData) {
      for (const g of gradeData) gradeMap[g.call_id] = g;
    }
  }

  const gradedCalls = (calls || []).filter((c: any) => gradeMap[c.id]).map((c: any) => ({ ...c, grade: gradeMap[c.id] }));

  // Stats
  const totalTranscripts = (transcripts || []).length;
  const totalCalls = (transcripts || []).reduce((sum: number, t: any) => sum + (t.total_calls_detected || 0), 0);
  const meaningfulCalls = (transcripts || []).reduce((sum: number, t: any) => sum + (t.meaningful_calls_count || 0), 0);
  const meetings = gradedCalls.filter((c: any) => c.grade.meeting_scheduled).length;

  // Grade distribution
  const gradeDistribution: Record<string, number> = {};
  let totalScore = 0;
  let scoreCount = 0;
  const categoryScores: Record<string, { total: number; count: number }> = {
    opener: { total: 0, count: 0 },
    engagement: { total: 0, count: 0 },
    objection_handling: { total: 0, count: 0 },
    appointment_setting: { total: 0, count: 0 },
    professionalism: { total: 0, count: 0 },
  };

  for (const call of gradedCalls) {
    const g = call.grade;
    gradeDistribution[g.overall_grade] = (gradeDistribution[g.overall_grade] || 0) + 1;
    if (g.overall_score) { totalScore += g.overall_score; scoreCount++; }
    if (g.opener_score) { categoryScores.opener.total += g.opener_score; categoryScores.opener.count++; }
    if (g.engagement_score) { categoryScores.engagement.total += g.engagement_score; categoryScores.engagement.count++; }
    if (g.objection_handling_score) { categoryScores.objection_handling.total += g.objection_handling_score; categoryScores.objection_handling.count++; }
    if (g.appointment_setting_score) { categoryScores.appointment_setting.total += g.appointment_setting_score; categoryScores.appointment_setting.count++; }
    if (g.professionalism_score) { categoryScores.professionalism.total += g.professionalism_score; categoryScores.professionalism.count++; }
  }

  const avgScore = scoreCount > 0 ? Math.round((totalScore / scoreCount) * 10) / 10 : null;

  let context = `### PERFORMANCE SUMMARY\n`;
  context += `Name: ${profile?.name || 'Unknown'}\n`;
  context += `Transcripts Uploaded: ${totalTranscripts}\n`;
  context += `Total Calls Detected: ${totalCalls}\n`;
  context += `Meaningful Conversations: ${meaningfulCalls}\n`;
  context += `Graded Calls: ${gradedCalls.length}\n`;
  context += `Meetings Scheduled: ${meetings}\n`;
  if (avgScore) context += `Average Score: ${avgScore}\n`;

  if (Object.keys(gradeDistribution).length > 0) {
    context += `\nGrade Distribution: ${Object.entries(gradeDistribution).map(([g, c]) => `${g}:${c}`).join(', ')}\n`;
  }

  // Category averages
  context += `\n### CATEGORY AVERAGES\n`;
  for (const [cat, data] of Object.entries(categoryScores)) {
    if (data.count > 0) {
      const avg = Math.round((data.total / data.count) * 10) / 10;
      context += `- ${cat.replace(/_/g, ' ')}: ${avg}\n`;
    }
  }

  // Recent graded calls
  context += `\n### RECENT GRADED CALLS (Last 20)\n`;
  for (const call of gradedCalls.slice(0, 20)) {
    const g = call.grade;
    context += `\n- **${call.prospect_name || `Call #${call.call_index}`}** | Grade: ${g.overall_grade} (${g.overall_score})`;
    if (g.meeting_scheduled) context += ' ✅ Meeting';
    context += '\n';
    if (g.call_summary) context += `  Summary: ${g.call_summary.substring(0, 200)}\n`;
    if (g.strengths) context += `  Strengths: ${JSON.stringify(g.strengths).substring(0, 200)}\n`;
    if (g.improvements) context += `  Improvements: ${JSON.stringify(g.improvements).substring(0, 200)}\n`;
    if (g.coaching_notes) context += `  Coaching: ${g.coaching_notes.substring(0, 200)}\n`;
  }

  // Identify improvement trends
  const improvementCounts: Record<string, number> = {};
  for (const call of gradedCalls) {
    const improvements = call.grade.improvements;
    if (Array.isArray(improvements)) {
      for (const imp of improvements) {
        const text = typeof imp === 'string' ? imp : imp?.text || imp?.area || '';
        if (text) improvementCounts[text] = (improvementCounts[text] || 0) + 1;
      }
    }
  }
  const topImprovements = Object.entries(improvementCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (topImprovements.length > 0) {
    context += `\n### MOST COMMON IMPROVEMENT AREAS\n`;
    for (const [area, count] of topImprovements) {
      context += `- ${area} (${count}x)\n`;
    }
  }

  return context;
}
