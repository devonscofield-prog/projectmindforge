import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ============================================================
// Retry helper with exponential backoff
// ============================================================

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  { maxRetries = 3, baseDelayMs = 1000, agentName = 'unknown' } = {},
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) return response;

      const errorText = await response.text();

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`${agentName} API error (attempt ${attempt}/${maxRetries}): ${response.status} - ${errorText}`);
        console.warn(`[sdr-grade-call] ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      } else {
        throw new Error(`${agentName} API error: ${response.status} - ${errorText}`);
      }
    } catch (error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError' || error.message?.includes('fetch failed')) {
        lastError = new Error(`${agentName} timeout/network error (attempt ${attempt}/${maxRetries}): ${error.message}`);
        console.warn(`[sdr-grade-call] ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
      } else if (lastError === null) {
        throw error;
      }
    }
  }

  throw lastError || new Error(`${agentName}: All ${maxRetries} attempts failed`);
}

// ============================================================
// Main handler
// ============================================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { call_id, call_ids } = body;

    const idsToGrade: string[] = call_ids || (call_id ? [call_id] : []);
    if (idsToGrade.length === 0) {
      return new Response(JSON.stringify({ error: 'Must provide call_id or call_ids' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch calls
    const { data: calls, error: fetchError } = await supabase
      .from('sdr_calls')
      .select('id, raw_text, sdr_id, is_meaningful')
      .in('id', idsToGrade);

    if (fetchError) throw fetchError;
    if (!calls || calls.length === 0) {
      return new Response(JSON.stringify({ error: 'No calls found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const meaningfulCalls = calls.filter((c: any) => c.is_meaningful);

    // Load custom prompts
    const sdrId = meaningfulCalls[0]?.sdr_id;
    let customGraderPrompt: string | undefined;
    if (sdrId) {
      const { data: membership } = await supabase
        .from('sdr_team_members')
        .select('team_id')
        .eq('user_id', sdrId)
        .maybeSingle();

      if (membership?.team_id) {
        const { data: prompts } = await supabase
          .from('sdr_coaching_prompts')
          .select('system_prompt')
          .eq('team_id', membership.team_id)
          .eq('agent_key', 'grader')
          .eq('is_active', true)
          .maybeSingle();
        customGraderPrompt = prompts?.system_prompt;
      }
    }

    const results: any[] = [];

    for (const call of meaningfulCalls) {
      try {
        await supabase.from('sdr_calls').update({ analysis_status: 'processing' }).eq('id', call.id);

        const grade = await gradeCall(openaiApiKey, call.raw_text, customGraderPrompt);

        // Delete existing grade if re-grading
        await supabase.from('sdr_call_grades').delete().eq('call_id', call.id);

        await supabase.from('sdr_call_grades').insert({
          call_id: call.id,
          sdr_id: call.sdr_id,
          overall_grade: grade.overall_grade,
          opener_score: grade.opener_score,
          engagement_score: grade.engagement_score,
          objection_handling_score: grade.objection_handling_score,
          appointment_setting_score: grade.appointment_setting_score,
          professionalism_score: grade.professionalism_score,
          call_summary: grade.call_summary,
          strengths: grade.strengths,
          improvements: grade.improvements,
          key_moments: grade.key_moments,
          coaching_notes: grade.coaching_notes,
          model_name: 'gpt-5.2-2025-12-11',
          raw_json: grade,
        });

        await supabase.from('sdr_calls').update({ analysis_status: 'completed' }).eq('id', call.id);
        results.push({ call_id: call.id, status: 'completed', grade: grade.overall_grade });
      } catch (error) {
        console.error(`[sdr-grade-call] Failed to grade ${call.id} after retries:`, error);
        await supabase.from('sdr_calls').update({ analysis_status: 'failed' }).eq('id', call.id);
        results.push({ call_id: call.id, status: 'failed', error: error.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[sdr-grade-call] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

const DEFAULT_GRADER_PROMPT = `You are an expert SDR cold call coach. You grade individual cold calls on specific skills.

You will receive the transcript of a single SDR cold call. Grade it on these 5 dimensions (each scored 1-10):

### 1. Opener Score (opener_score)
- Did the SDR introduce themselves clearly?
- Did they reference a prior connection or reason for calling?
- Did they create enough curiosity to keep the prospect on the line?

### 2. Engagement Score (engagement_score)
- Did the SDR ask questions about the prospect's needs/situation?
- Did they listen and respond to what the prospect said?
- Did they build rapport?

### 3. Objection Handling Score (objection_handling_score)
- How well did the SDR handle pushback?
- Did they offer low-commitment alternatives?
- Score 5 if no objections occurred

### 4. Appointment Setting Score (appointment_setting_score)
- Did the SDR attempt to book a meeting/demo?
- Did they suggest specific times and confirm details?
- Did they get a firm commitment?

### 5. Professionalism Score (professionalism_score)
- Was the SDR courteous and professional throughout?
- Good pace, clear next steps, friendly close?

## Overall Grade: A+ (9.5-10), A (8.5-9.4), B (7-8.4), C (5.5-6.9), D (4-5.4), F (below 4)

Return JSON:
{
  "overall_grade": "A/B/C/D/F/A+",
  "opener_score": 1-10,
  "engagement_score": 1-10,
  "objection_handling_score": 1-10,
  "appointment_setting_score": 1-10,
  "professionalism_score": 1-10,
  "call_summary": "2-3 sentence summary",
  "strengths": ["..."],
  "improvements": ["..."],
  "key_moments": [{"timestamp": "MM:SS", "description": "...", "sentiment": "positive/negative/neutral"}],
  "coaching_notes": "Actionable coaching advice"
}

Return ONLY valid JSON.`;

async function gradeCall(openaiApiKey: string, callText: string, customPrompt?: string): Promise<any> {
  const systemPrompt = customPrompt || DEFAULT_GRADER_PROMPT;

  const response = await fetchWithRetry(
    'https://api.openai.com/v1/chat/completions',
    {
      method: 'POST',
      signal: AbortSignal.timeout(55000),
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5.2-2025-12-11',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Grade this SDR cold call:\n\n${callText}` },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    },
    { maxRetries: 3, baseDelayMs: 2000, agentName: 'Grader' },
  );

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Grader returned empty response');

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`Grader returned invalid JSON: ${content.slice(0, 200)}`);
  }
}
