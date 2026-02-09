import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

interface ScoringCategory {
  name: string;
  weight: number;
  description: string;
  key: string;
}

interface NegativeTrigger {
  trigger: string;
  max_grade: string;
  explanation: string;
}

interface GradingCriteria {
  role_description?: string;
  scoring_categories?: ScoringCategory[];
  negative_triggers?: NegativeTrigger[];
  hide_feedback_below_grade?: string;
}

interface Persona {
  name: string;
  persona_type: string;
  disc_profile: string | null;
  difficulty_level: string;
  industry: string | null;
  communication_style: Record<string, unknown>;
  common_objections: Array<{ objection: string; category: string; severity: string; underlying_concern: string }>;
  pain_points: Array<{ pain: string; severity: string; visible: boolean }>;
  dos_and_donts: { dos: string[]; donts: string[]; unlock_criteria?: string };
  grading_criteria?: GradingCriteria;
}

interface GradingResult {
  scores: Record<string, number>;
  overall_grade: string;
  feedback: {
    strengths: string[];
    improvements: string[];
    missed_opportunities: string[];
    persona_specific: string;
    key_moments: Array<{ moment: string; assessment: string; suggestion: string }>;
  };
  focus_areas: string[];
  coaching_prescription: string;
  feedback_visibility: 'full' | 'restricted';
}

// Grade hierarchy for comparison
const GRADE_ORDER = ['F', 'D', 'C', 'B', 'A', 'A+'];

function isGradeLowerOrEqual(grade: string, threshold: string): boolean {
  const gradeIndex = GRADE_ORDER.indexOf(grade.toUpperCase());
  const thresholdIndex = GRADE_ORDER.indexOf(threshold.toUpperCase());
  return gradeIndex >= 0 && thresholdIndex >= 0 && gradeIndex <= thresholdIndex;
}

// Session type category weights for more accurate grading
const SESSION_TYPE_WEIGHTS: Record<string, Record<string, number>> = {
  discovery: {
    discovery: 0.35,
    objection_handling: 0.15,
    rapport: 0.25,
    closing: 0.10,
    persona_adaptation: 0.15,
  },
  demo: {
    discovery: 0.15,
    objection_handling: 0.25,
    rapport: 0.20,
    closing: 0.20,
    persona_adaptation: 0.20,
  },
  objection_handling: {
    discovery: 0.10,
    objection_handling: 0.45,
    rapport: 0.15,
    closing: 0.10,
    persona_adaptation: 0.20,
  },
  negotiation: {
    discovery: 0.10,
    objection_handling: 0.25,
    rapport: 0.15,
    closing: 0.30,
    persona_adaptation: 0.20,
  },
};

// DISC-specific success criteria
const DISC_SUCCESS_CRITERIA: Record<string, string[]> = {
  'D': [
    'Got to the point quickly without excessive small talk',
    'Showed confidence and competence',
    'Respected their time and kept things moving',
    'Provided concrete results and ROI data',
    'Was direct when handling objections',
  ],
  'I': [
    'Built personal rapport and connection',
    'Showed enthusiasm and positive energy',
    'Let them tell stories and validated their ideas',
    'Made the conversation engaging and dynamic',
    'Used collaborative language',
  ],
  'S': [
    'Provided reassurance and stability',
    'Took time to build trust before pushing',
    'Addressed change management concerns',
    'Was patient and non-threatening',
    'Offered support and hand-holding',
  ],
  'C': [
    'Provided detailed data and documentation references',
    'Answered technical questions thoroughly',
    'Backed up claims with specifics',
    'Showed process and methodology',
    'Was accurate and precise in statements',
  ],
};

function buildPersonaSpecificGradingPrompt(
  transcript: string,
  persona: Persona,
  sessionType: string,
  durationSeconds: number,
  gradingCriteria: GradingCriteria
): string {
  const durationMinutes = Math.round(durationSeconds / 60);

  // Build scoring categories section
  const categoriesSection = gradingCriteria.scoring_categories?.map(cat =>
    `- **${cat.name}** (${cat.weight}%): ${cat.description}`
  ).join('\n') || '';

  // Build negative triggers section
  const triggersSection = gradingCriteria.negative_triggers?.map(trigger =>
    `- NEGATIVE TRIGGER: If "${trigger.trigger}", the maximum grade is ${trigger.max_grade}. Reason: ${trigger.explanation}`
  ).join('\n') || '';

  // Build expected scores keys from categories
  const scoreKeys = gradingCriteria.scoring_categories?.map(cat =>
    `"${cat.key}": <0-100>`
  ).join(',\n    ') || '';

  return `${gradingCriteria.role_description || 'You are an expert sales coach evaluating a roleplay practice session.'}

=== SESSION CONTEXT ===
- Session Type: ${sessionType.toUpperCase()}
- Duration: ${durationMinutes} minutes
- Prospect Persona: ${persona.name} (${persona.persona_type}, ${persona.industry || 'General'} industry)
- DISC Profile: ${persona.disc_profile || 'Unknown'}
- Difficulty Level: ${persona.difficulty_level}

=== PERSONA-SPECIFIC EVALUATION CRITERIA ===
${categoriesSection}

=== CRITICAL RULES ===
${triggersSection}

=== PERSONA'S PAIN POINTS (Check if rep uncovered these) ===
${persona.pain_points?.map(p => `- ${p.pain} (${p.severity}, ${p.visible ? 'openly expressed' : 'hidden - requires good discovery'})`).join('\n') || 'None specified'}

=== TRANSCRIPT ===
${transcript}

=== YOUR TASK ===
Analyze the transcript according to the PERSONA-SPECIFIC EVALUATION CRITERIA above. 

**IMPORTANT**: Check for NEGATIVE TRIGGERS first. If any trigger condition is met, cap the overall grade accordingly.

Respond with a JSON object (no markdown, just raw JSON) with this structure:

{
  "scores": {
    "overall": <0-100, calculated using category weights>,
    ${scoreKeys}
  },
  "overall_grade": "<A+|A|B|C|D|F>",
  "negative_trigger_hit": <true|false>,
  "negative_trigger_reason": "<null or explanation of which trigger was hit>",
  "feedback": {
    "strengths": ["<specific thing they did well with example from transcript>", ...],
    "improvements": ["<specific improvement with how to do it better>", ...],
    "missed_opportunities": ["<specific moment they missed with what they should have done>", ...],
    "persona_specific": "<detailed feedback on how well they adapted to ${persona.name}>",
    "key_moments": [
      {
        "moment": "<quote or paraphrase from transcript>",
        "assessment": "<what they did well or poorly>",
        "suggestion": "<what they should do differently or continue doing>"
      }
    ]
  },
  "focus_areas": ["<top priority skill to practice>", "<second priority>", "<third priority>"],
  "coaching_prescription": "<specific drill or exercise recommendation>"
}

=== GRADING RUBRIC ===
- A+ (95-100): Exceptional - would use for training examples
- A (85-94): Excellent - minor polish points only
- B (70-84): Good - solid fundamentals, 1-2 clear improvement areas
- C (55-69): Average - multiple gaps, needs focused coaching
- D (40-54): Below expectations - significant skill gaps
- F (<40): Poor - fundamental issues, needs intensive training

=== IMPORTANT ===
- Be specific! Reference exact moments from the transcript.
- Apply the category weights to calculate the overall score.
- If a NEGATIVE TRIGGER is hit, the grade CANNOT exceed the max_grade specified.`;
}

function buildDefaultGradingPrompt(
  transcript: string,
  persona: Persona,
  sessionType: string,
  durationSeconds: number
): string {
  const durationMinutes = Math.round(durationSeconds / 60);
  const weights = SESSION_TYPE_WEIGHTS[sessionType] || SESSION_TYPE_WEIGHTS.discovery;
  const discCriteria = DISC_SUCCESS_CRITERIA[persona.disc_profile?.toUpperCase() || 'S'] || DISC_SUCCESS_CRITERIA['S'];

  // Format objections for grading context
  const objectionsList = persona.common_objections?.map(
    o => `- "${o.objection}" (${o.category}, ${o.severity} priority) → Underlying concern: ${o.underlying_concern}`
  ).join('\n') || 'None specified';

  // Format pain points
  const painPointsList = persona.pain_points?.map(
    p => `- ${p.pain} (${p.severity}, ${p.visible ? 'openly expressed' : 'hidden - requires good discovery'})`
  ).join('\n') || 'None specified';

  // Format dos and donts
  const dos = persona.dos_and_donts?.dos?.join('\n  - ') || 'Be professional';
  const donts = persona.dos_and_donts?.donts?.join('\n  - ') || 'Be pushy';

  // Communication style details
  const petPeeves = Array.isArray(persona.communication_style?.pet_peeves) 
    ? persona.communication_style.pet_peeves.join(', ') 
    : 'None specified';

  return `You are an expert sales coach evaluating a roleplay practice session. Provide detailed, actionable coaching feedback.

=== SESSION CONTEXT ===
- Session Type: ${sessionType.toUpperCase()}
- Duration: ${durationMinutes} minutes
- Prospect Persona: ${persona.name} (${persona.persona_type}, ${persona.industry || 'General'} industry)
- DISC Profile: ${persona.disc_profile || 'Unknown'}
- Difficulty Level: ${persona.difficulty_level}

=== SCORING WEIGHTS FOR THIS SESSION TYPE ===
This is a ${sessionType.toUpperCase()} session, so weight your scoring accordingly:
- Discovery: ${Math.round(weights.discovery * 100)}%
- Objection Handling: ${Math.round(weights.objection_handling * 100)}%
- Rapport: ${Math.round(weights.rapport * 100)}%
- Closing: ${Math.round(weights.closing * 100)}%
- Persona Adaptation: ${Math.round(weights.persona_adaptation * 100)}%

=== PERSONA-SPECIFIC SUCCESS CRITERIA ===
For a ${persona.disc_profile || 'S'}-profile prospect, the rep SHOULD have:
${discCriteria.map(c => `- ${c}`).join('\n')}

=== WHAT WORKS WITH THIS PERSONA ===
  - ${dos}

=== WHAT IRRITATES THIS PERSONA ===
  - ${donts}
Pet peeves: ${petPeeves}

=== PERSONA'S OBJECTIONS (Check if rep encountered and handled these) ===
${objectionsList}

=== PERSONA'S PAIN POINTS (Check if rep uncovered these) ===
${painPointsList}

=== TRANSCRIPT ===
${transcript}

=== YOUR TASK ===
Analyze the transcript and provide a comprehensive evaluation. Respond with a JSON object (no markdown, just raw JSON) with this exact structure:

{
  "scores": {
    "overall": <0-100, calculated using session type weights>,
    "discovery": <0-100>,
    "objection_handling": <0-100>,
    "rapport": <0-100>,
    "closing": <0-100>,
    "persona_adaptation": <0-100>
  },
  "overall_grade": "<A+|A|B|C|D|F>",
  "feedback": {
    "strengths": ["<specific thing they did well with example from transcript>", ...],
    "improvements": ["<specific improvement with how to do it better>", ...],
    "missed_opportunities": ["<specific moment they missed with what they should have done>", ...],
    "persona_specific": "<detailed feedback on how well they adapted to this ${persona.disc_profile || 'S'}-profile ${persona.persona_type}>",
    "key_moments": [
      {
        "moment": "<quote or paraphrase from transcript>",
        "assessment": "<what they did well or poorly>",
        "suggestion": "<what they should do differently or continue doing>"
      }
    ]
  },
  "focus_areas": ["<top priority skill to practice>", "<second priority>", "<third priority>"],
  "coaching_prescription": "<specific drill or exercise recommendation, e.g., 'Practice SPIN questioning for 5 calls focusing on implication questions' or 'Record yourself handling price objections and review for defensive language'>"
}

=== SCORING GUIDELINES ===
- Discovery (0-100): Did they ask open-ended questions? Uncover needs beyond the obvious? Use SPIN or similar methodology?
- Objection Handling (0-100): Did they use LAER (Listen, Acknowledge, Explore, Respond)? Address root concerns? Not get defensive?
- Rapport (0-100): Did they match communication style? Build genuine connection? Use active listening?
- Closing (0-100): Did they secure clear next steps? Create appropriate urgency? Confirm commitment?
- Persona Adaptation (0-100): Did they adjust to DISC style? Avoid pet peeves? Leverage what works with this persona?

=== GRADING RUBRIC ===
- A+ (95-100): Exceptional - would use for training examples
- A (85-94): Excellent - minor polish points only
- B (70-84): Good - solid fundamentals, 1-2 clear improvement areas
- C (55-69): Average - multiple gaps, needs focused coaching
- D (40-54): Below expectations - significant skill gaps
- F (<40): Poor - fundamental issues, needs intensive training

=== IMPORTANT ===
- Be specific! Reference exact moments from the transcript.
- The "key_moments" array should include 2-4 specific transcript moments with coaching.
- The "coaching_prescription" should be a concrete, actionable exercise they can do this week.
- Consider the difficulty level: a ${persona.difficulty_level} persona should be judged accordingly.`;
}

async function gradeWithAI(
  transcript: string,
  persona: Persona,
  sessionType: string,
  durationSeconds: number
): Promise<GradingResult> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const openaiKey = Deno.env.get('OPENAI_API_KEY');
  
  if (!lovableKey && !openaiKey) {
    throw new Error('No AI API key configured');
  }

  // Check if persona has custom grading criteria
  const hasCustomCriteria = persona.grading_criteria && 
    persona.grading_criteria.scoring_categories && 
    persona.grading_criteria.scoring_categories.length > 0;

  const prompt = hasCustomCriteria
    ? buildPersonaSpecificGradingPrompt(transcript, persona, sessionType, durationSeconds, persona.grading_criteria!)
    : buildDefaultGradingPrompt(transcript, persona, sessionType, durationSeconds);
  
  console.log(`Using ${hasCustomCriteria ? 'persona-specific' : 'default'} grading criteria for ${persona.name}`);
  
  // Use Lovable AI Gateway with upgraded model, or fall back to OpenAI with gpt-4o
  const isLovableAI = !!lovableKey;
  const apiUrl = isLovableAI 
    ? 'https://ai.gateway.lovable.dev/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const apiKey = isLovableAI ? lovableKey : openaiKey;
  
  // Use more powerful models for better grading quality
  const model = isLovableAI ? 'google/gemini-3-pro-preview' : 'gpt-4o';
  
  console.log(`Using ${isLovableAI ? 'Lovable AI Gateway' : 'OpenAI'} (${model}) for grading`);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert sales coach and training evaluator. Analyze roleplay transcripts and provide detailed, actionable feedback. Respond only with valid JSON, no markdown formatting or code blocks.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3, // Lower temperature for more consistent grading
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

  console.log('AI grading response received, parsing...');
  
  // Parse JSON response (handle potential markdown wrapping)
  let jsonContent = content.trim();
  if (jsonContent.startsWith('```')) {
    jsonContent = jsonContent.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }
  
  const rawResult = JSON.parse(jsonContent);
  
  // Validate required fields
  if (!rawResult.scores || typeof rawResult.scores.overall !== 'number') {
    throw new Error('Invalid grading result structure');
  }
  
  // Ensure key_moments exists (may not be in older format responses)
  if (!rawResult.feedback.key_moments) {
    rawResult.feedback.key_moments = [];
  }
  
  // Determine feedback visibility based on grade and persona criteria
  let feedbackVisibility: 'full' | 'restricted' = 'full';
  
  if (hasCustomCriteria && persona.grading_criteria?.hide_feedback_below_grade) {
    const hideThreshold = persona.grading_criteria.hide_feedback_below_grade;
    if (isGradeLowerOrEqual(rawResult.overall_grade, hideThreshold)) {
      feedbackVisibility = 'restricted';
      console.log(`Grade ${rawResult.overall_grade} is <= ${hideThreshold}, setting feedback_visibility to restricted`);
    }
  }
  
  const result: GradingResult = {
    scores: rawResult.scores,
    overall_grade: rawResult.overall_grade,
    feedback: rawResult.feedback,
    focus_areas: rawResult.focus_areas,
    coaching_prescription: rawResult.coaching_prescription,
    feedback_visibility: feedbackVisibility,
  };
  
  return result;
}

Deno.serve(async (req) => {
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
    
    if (authHeader && authHeader !== `Bearer ${supabaseServiceKey}`) {
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

    // Fetch session with transcript and grading_criteria
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
    
    console.log(`Grading session for persona: ${persona.name} (${persona.disc_profile}), type: ${session.session_type}`);
    console.log(`Persona has custom grading criteria: ${!!persona.grading_criteria?.scoring_categories?.length}`);

    // Run AI grading with enhanced prompt
    const gradingResult = await gradeWithAI(
      transcript.raw_text,
      persona,
      session.session_type || 'discovery',
      session.duration_seconds || 0
    );

    console.log(`Grading complete. Overall: ${gradingResult.overall_grade} (${gradingResult.scores.overall}), visibility: ${gradingResult.feedback_visibility}`);

    // Save grade with feedback_visibility
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
        feedback_visibility: gradingResult.feedback_visibility,
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
