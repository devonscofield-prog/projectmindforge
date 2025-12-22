import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GradeRequest {
  sessionId: string;
}

interface RoleplaySession {
  id: string;
  trainee_id: string;
  persona_id: string;
  session_type: string;
  status: string;
  duration_seconds: number | null;
}

interface RoleplayTranscript {
  raw_text: string;
  transcript_json: Array<{ role: string; content: string; timestamp: number }>;
}

interface Persona {
  name: string;
  persona_type: string;
  disc_profile: string | null;
  difficulty_level: string;
  common_objections: Array<{ category: string; example: string }>;
  pain_points: Array<{ description: string; severity: string }>;
}

interface GradingResult {
  scores: {
    overall: number;
    discovery: number;
    objection_handling: number;
    rapport: number;
    closing: number;
    persona_adaptation: number;
  };
  overall_grade: string;
  feedback: {
    strengths: string[];
    improvements: string[];
    missed_opportunities: string[];
    persona_specific: string;
  };
  focus_areas: string[];
  coaching_prescription: string;
}

function buildGradingPrompt(
  transcript: string,
  persona: Persona,
  sessionType: string,
  durationSeconds: number
): string {
  const durationMinutes = Math.round(durationSeconds / 60);
  
  return `You are a sales training evaluator. Analyze this roleplay practice session and provide detailed coaching feedback.

CONTEXT:
- Session Type: ${sessionType}
- Duration: ${durationMinutes} minutes
- Prospect Persona: ${persona.name} (${persona.persona_type})
- DISC Profile: ${persona.disc_profile || 'Unknown'}
- Difficulty Level: ${persona.difficulty_level}

PERSONA'S KNOWN OBJECTIONS:
${persona.common_objections?.map(o => `- ${o.category}: ${o.example}`).join('\n') || 'None specified'}

PERSONA'S PAIN POINTS:
${persona.pain_points?.map(p => `- ${p.description} (${p.severity})`).join('\n') || 'None specified'}

TRANSCRIPT:
${transcript}

Evaluate the sales rep's performance and respond with a JSON object (no markdown, just raw JSON) with this exact structure:
{
  "scores": {
    "overall": <0-100>,
    "discovery": <0-100>,
    "objection_handling": <0-100>,
    "rapport": <0-100>,
    "closing": <0-100>,
    "persona_adaptation": <0-100>
  },
  "overall_grade": "<A+|A|B|C|D|F>",
  "feedback": {
    "strengths": ["<strength 1>", "<strength 2>", ...],
    "improvements": ["<improvement 1>", "<improvement 2>", ...],
    "missed_opportunities": ["<missed opportunity 1>", ...],
    "persona_specific": "<feedback on how well they adapted to this persona's style>"
  },
  "focus_areas": ["<focus area 1>", "<focus area 2>", "<focus area 3>"],
  "coaching_prescription": "<specific drill or practice recommendation>"
}

SCORING GUIDELINES:
- Discovery (0-100): How well did they uncover needs, pain points, and decision criteria?
- Objection Handling (0-100): How effectively did they address concerns using LAER (Listen, Acknowledge, Explore, Respond)?
- Rapport (0-100): Did they build connection? Adapt to communication style? Use active listening?
- Closing (0-100): Did they secure next steps? Create urgency appropriately?
- Persona Adaptation (0-100): How well did they adjust to this specific DISC profile and personality?

GRADING RUBRIC:
- A+ (95-100): Exceptional - would use for training examples
- A (85-94): Excellent - minor polish points only
- B (70-84): Good - solid fundamentals, 1-2 clear improvement areas
- C (55-69): Average - multiple gaps, needs coaching
- D (40-54): Below expectations - significant issues
- F (<40): Poor - fundamental problems`;
}

async function gradeWithAI(
  transcript: string,
  persona: Persona,
  sessionType: string,
  durationSeconds: number
): Promise<GradingResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY') || Deno.env.get('OPENAI_API_KEY');
  
  if (!apiKey) {
    throw new Error('No AI API key configured');
  }

  const prompt = buildGradingPrompt(transcript, persona, sessionType, durationSeconds);
  
  // Use Lovable AI Gateway if available, otherwise OpenAI
  const isLovableAI = !!Deno.env.get('LOVABLE_API_KEY');
  const apiUrl = isLovableAI 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  
  console.log(`Using ${isLovableAI ? 'Lovable AI Gateway' : 'OpenAI'} for grading`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: isLovableAI ? 'google/gemini-2.5-flash' : 'gpt-4o-mini',
      messages: [
        { 
          role: 'system', 
          content: 'You are a sales training evaluator. Respond only with valid JSON, no markdown formatting.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('AI API error:', errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No content in AI response');
  }

  console.log('AI response received, parsing...');
  
  // Parse JSON response (handle potential markdown wrapping)
  let jsonContent = content.trim();
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }
  
  const result = JSON.parse(jsonContent) as GradingResult;
  
  // Validate required fields
  if (!result.scores || typeof result.scores.overall !== 'number') {
    throw new Error('Invalid grading result structure');
  }
  
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify auth (service role for async grading, or user token)
    let userId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader && !authHeader.includes(supabaseServiceKey)) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
      if (userError) {
        console.error('Auth error:', userError);
        throw new Error('Invalid token');
      }
      userId = user?.id || null;
    }

    const body: GradeRequest = await req.json();
    const { sessionId } = body;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }

    console.log(`Grading session: ${sessionId}`);

    // Fetch session with transcript
    const { data: session, error: sessionError } = await supabaseClient
      .from('roleplay_sessions')
      .select('*, roleplay_personas(*)')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Session fetch error:', sessionError);
      throw new Error('Session not found');
    }

    // Verify ownership if user-initiated
    if (userId && session.trainee_id !== userId) {
      throw new Error('Access denied');
    }

    // Check if already graded
    const { data: existingGrade } = await supabaseClient
      .from('roleplay_grades')
      .select('id')
      .eq('session_id', sessionId)
      .eq('grader_type', 'ai')
      .single();

    if (existingGrade) {
      console.log('Session already graded');
      return new Response(JSON.stringify({
        success: true,
        message: 'Session already graded',
        gradeId: existingGrade.id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch transcript
    const { data: transcript, error: transcriptError } = await supabaseClient
      .from('roleplay_transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (transcriptError || !transcript?.raw_text) {
      console.error('Transcript fetch error:', transcriptError);
      throw new Error('Transcript not found');
    }

    const persona = session.roleplay_personas as Persona;
    
    console.log(`Grading session for persona: ${persona.name}`);

    // Run AI grading
    const gradingResult = await gradeWithAI(
      transcript.raw_text,
      persona,
      session.session_type || 'discovery',
      session.duration_seconds || 0
    );

    console.log(`Grading complete. Overall: ${gradingResult.overall_grade} (${gradingResult.scores.overall})`);

    // Save grade
    const { data: grade, error: gradeError } = await supabaseClient
      .from('roleplay_grades')
      .insert({
        session_id: sessionId,
        grader_type: 'ai',
        scores: gradingResult.scores,
        feedback: gradingResult.feedback,
        overall_grade: gradingResult.overall_grade,
        coaching_prescription: gradingResult.coaching_prescription,
        focus_areas: gradingResult.focus_areas,
        graded_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (gradeError) {
      console.error('Grade save error:', gradeError);
      throw new Error('Failed to save grade');
    }

    console.log(`Grade saved: ${grade.id}`);

    return new Response(JSON.stringify({
      success: true,
      gradeId: grade.id,
      result: gradingResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in roleplay-grade-session:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
