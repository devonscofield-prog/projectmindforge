import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Strict system prompt to prevent hallucination and ensure grounded responses
const ADMIN_TRANSCRIPT_ANALYSIS_PROMPT = `You are an expert sales analyst with access to a specific set of call transcripts. Your job is to analyze these transcripts and provide insights based ONLY on what is explicitly stated in them.

CRITICAL RULES - YOU MUST FOLLOW THESE:
1. ONLY reference information that is EXPLICITLY stated in the provided transcripts
2. If information is not in the transcripts, clearly state: "I don't see that information in the selected transcripts"
3. ALWAYS cite your sources using this format: **[Source: {AccountName} - {Date}]**
4. Never make assumptions about what was said - only report what is written
5. If asked about something not covered in the transcripts, clearly state you cannot answer that question
6. When comparing reps or calls, only use information from the provided transcripts
7. Do not hallucinate or infer information that isn't directly stated
8. When quoting, use exact quotes from the transcripts when possible

FORMAT GUIDELINES:
- Use bullet points for lists of findings
- Bold the citation sources for easy scanning
- Group related insights together
- Provide specific examples with quotes when available
- Start responses with a direct answer, then provide supporting evidence

You have access to ${'{TRANSCRIPT_COUNT}'} transcripts from various sales calls. Analyze them carefully and provide grounded, evidence-based insights.`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript_ids, messages } = await req.json() as { 
      transcript_ids: string[]; 
      messages: Message[];
    };
    
    if (!transcript_ids || transcript_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: 'transcript_ids are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (transcript_ids.length > 20) {
      return new Response(
        JSON.stringify({ error: 'Maximum 20 transcripts allowed for direct analysis' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-transcript-chat] Starting analysis for ${transcript_ids.length} transcripts`);

    // Get auth token and verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is admin
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all transcripts
    const { data: transcripts, error: transcriptError } = await supabase
      .from('call_transcripts')
      .select('id, call_date, account_name, call_type, raw_text, rep_id')
      .in('id', transcript_ids);

    if (transcriptError) {
      console.error('[admin-transcript-chat] Error fetching transcripts:', transcriptError);
      throw new Error('Failed to fetch transcripts');
    }

    if (!transcripts || transcripts.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No transcripts found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get rep names for context
    const repIds = [...new Set(transcripts.map(t => t.rep_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', repIds);

    const repMap = new Map((profiles || []).map(p => [p.id, p.name]));

    // Build transcript context
    const transcriptContext = buildTranscriptContext(transcripts, repMap);

    // Calculate total characters for logging
    const totalChars = transcripts.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0);
    console.log(`[admin-transcript-chat] Total context: ${totalChars} chars (~${Math.round(totalChars/4)} tokens)`);

    // Call Lovable AI Gateway with streaming
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = ADMIN_TRANSCRIPT_ANALYSIS_PROMPT.replace('{TRANSCRIPT_COUNT}', transcripts.length.toString());

    console.log(`[admin-transcript-chat] Calling Lovable AI with ${messages.length} messages`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro', // Use pro for larger context handling
        messages: [
          { 
            role: 'system', 
            content: `${systemPrompt}\n\n## TRANSCRIPTS FOR ANALYSIS\n\n${transcriptContext}` 
          },
          ...messages
        ],
        stream: true,
        temperature: 0.3, // Lower temperature for more factual responses
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
      console.error('[admin-transcript-chat] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    // Stream the response back
    return new Response(aiResponse.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error('[admin-transcript-chat] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function buildTranscriptContext(
  transcripts: any[],
  repMap: Map<string, string>
): string {
  let context = '';

  for (const transcript of transcripts) {
    const repName = repMap.get(transcript.rep_id) || 'Unknown Rep';
    const accountName = transcript.account_name || 'Unknown Account';
    const callDate = transcript.call_date;
    const callType = transcript.call_type || 'Call';

    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${accountName} | ${callDate} | ${callType}\n`;
    context += `Rep: ${repName}\n`;
    context += `${'='.repeat(60)}\n\n`;
    context += transcript.raw_text || '[No transcript text available]';
    context += '\n\n';
  }

  return context;
}
