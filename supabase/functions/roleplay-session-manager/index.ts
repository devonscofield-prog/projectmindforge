import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  personaId: string;
  sessionType?: 'discovery' | 'demo' | 'objection_handling' | 'negotiation';
  scenarioPrompt?: string;
}

interface Persona {
  id: string;
  name: string;
  persona_type: string;
  disc_profile: string | null;
  communication_style: Record<string, unknown>;
  common_objections: Array<{ category: string; example: string }>;
  pain_points: Array<{ description: string; severity: string }>;
  dos_and_donts: { do: string[]; dont: string[] };
  backstory: string | null;
  difficulty_level: string;
  industry: string | null;
  voice: string;
}

function buildPersonaSystemPrompt(persona: Persona, sessionType: string, scenarioPrompt?: string): string {
  const objectionsList = persona.common_objections?.map(
    (o) => `- ${o.category}: "${o.example}"`
  ).join('\n') || 'None specified';

  const painPointsList = persona.pain_points?.map(
    (p) => `- ${p.description} (Severity: ${p.severity})`
  ).join('\n') || 'None specified';

  const dos = persona.dos_and_donts?.do?.join(', ') || 'Be professional';
  const donts = persona.dos_and_donts?.dont?.join(', ') || 'Be pushy';

  const communicationTone = persona.communication_style?.tone || 'professional';
  const communicationPreference = persona.communication_style?.preference || 'direct';

  const sessionTypeInstructions = {
    discovery: `This is a DISCOVERY call. The rep is trying to understand your needs, challenges, and goals. 
    Start somewhat guarded but open up if they ask good questions. Don't volunteer information too easily.`,
    demo: `This is a PRODUCT DEMO. You've agreed to see their solution. 
    Ask clarifying questions, express skepticism about certain features, and relate everything back to your specific needs.`,
    objection_handling: `This is an OBJECTION HANDLING practice session. 
    Raise multiple objections throughout the conversation. Test their ability to address concerns without being defensive.`,
    negotiation: `This is a NEGOTIATION session. You're interested but need to get the best deal. 
    Push back on pricing, ask for discounts, and test their ability to hold value while being flexible.`,
  };

  return `You are ${persona.name}, a ${persona.persona_type} at a mid-market company.

PERSONALITY (DISC Profile: ${persona.disc_profile || 'Unknown'}):
${persona.backstory || 'You are a busy professional who values your time.'}

COMMUNICATION STYLE:
- Tone: ${communicationTone}
- Preference: ${communicationPreference}
- Difficulty Level: ${persona.difficulty_level}

INDUSTRY CONTEXT: ${persona.industry || 'General business'}

COMMON OBJECTIONS YOU RAISE:
${objectionsList}

PAIN POINTS YOU EXPERIENCE:
${painPointsList}

WHAT WORKS WITH YOU (DOs for the rep): ${dos}
WHAT DOESN'T WORK (DON'Ts for the rep): ${donts}

SESSION TYPE: ${sessionType.toUpperCase()}
${sessionTypeInstructions[sessionType as keyof typeof sessionTypeInstructions] || sessionTypeInstructions.discovery}

${scenarioPrompt ? `SPECIFIC SCENARIO: ${scenarioPrompt}` : ''}

IMPORTANT BEHAVIOR RULES:
1. Stay in character at all times. You are NOT an AI assistant - you ARE ${persona.name}.
2. React naturally based on your DISC profile:
   - D (Dominant): Be direct, results-focused, may interrupt, value time
   - I (Influential): Be enthusiastic, talkative, relationship-focused
   - S (Steady): Be patient, seek stability, avoid conflict, need reassurance
   - C (Conscientious): Be analytical, detail-oriented, ask technical questions
3. If the rep handles objections well, gradually become more open and engaged.
4. If they push too hard, miss cues, or seem unprepared, become more resistant.
5. Express genuine emotions - frustration, interest, skepticism, excitement as appropriate.
6. Ask questions back to the rep to test their knowledge.
7. Reference your specific pain points and industry challenges naturally.
8. If the rep says something that resonates, acknowledge it authentically.
9. Keep responses conversational - this is a phone/video call, not a formal presentation.
10. Use filler words occasionally ("um", "well", "you know") to sound natural.`;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify the user's JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      throw new Error('Invalid or expired token');
    }

    const url = new URL(req.url);
    const action = url.pathname.split('/').pop();

    console.log(`Roleplay session manager - Action: ${action}, User: ${user.id}`);

    if (action === 'create-session') {
      // Create a new roleplay session and get ephemeral token
      const body: CreateSessionRequest = await req.json();
      const { personaId, sessionType = 'discovery', scenarioPrompt } = body;

      console.log(`Creating session for persona: ${personaId}, type: ${sessionType}`);

      // Fetch the persona
      const { data: persona, error: personaError } = await supabaseClient
        .from('roleplay_personas')
        .select('*')
        .eq('id', personaId)
        .eq('is_active', true)
        .single();

      if (personaError || !persona) {
        console.error('Persona fetch error:', personaError);
        throw new Error('Persona not found or inactive');
      }

      console.log(`Found persona: ${persona.name}`);

      // Create the session record
      const { data: session, error: sessionError } = await supabaseClient
        .from('roleplay_sessions')
        .insert({
          trainee_id: user.id,
          persona_id: personaId,
          session_type: sessionType,
          scenario_prompt: scenarioPrompt,
          status: 'pending',
          session_config: {
            difficulty: persona.difficulty_level,
            voice: persona.voice,
          },
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        throw new Error('Failed to create session');
      }

      console.log(`Created session: ${session.id}`);

      // Build the system prompt
      const systemPrompt = buildPersonaSystemPrompt(
        persona as Persona,
        sessionType,
        scenarioPrompt
      );

      // Request ephemeral token from OpenAI Realtime API
      console.log('Requesting ephemeral token from OpenAI...');
      const openAIResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview-2024-12-17',
          voice: persona.voice || 'alloy',
          instructions: systemPrompt,
        }),
      });

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${openAIResponse.status}`);
      }

      const openAIData = await openAIResponse.json();
      console.log('Ephemeral token received successfully');

      // Update session to in_progress
      await supabaseClient
        .from('roleplay_sessions')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      return new Response(JSON.stringify({
        sessionId: session.id,
        ephemeralToken: openAIData.client_secret?.value,
        persona: {
          id: persona.id,
          name: persona.name,
          persona_type: persona.persona_type,
          voice: persona.voice,
        },
        sessionConfig: {
          type: sessionType,
          difficulty: persona.difficulty_level,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'end-session') {
      // End a roleplay session and save transcript
      const body = await req.json();
      const { sessionId, transcript, durationSeconds } = body;

      console.log(`Ending session: ${sessionId}`);

      // Verify ownership
      const { data: session, error: sessionFetchError } = await supabaseClient
        .from('roleplay_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('trainee_id', user.id)
        .single();

      if (sessionFetchError || !session) {
        console.error('Session fetch error:', sessionFetchError);
        throw new Error('Session not found or access denied');
      }

      // Save transcript
      if (transcript && transcript.length > 0) {
        const rawText = transcript.map((t: { role: string; content: string }) => 
          `${t.role === 'user' ? 'REP' : 'PROSPECT'}: ${t.content}`
        ).join('\n\n');

        const { error: transcriptError } = await supabaseClient
          .from('roleplay_transcripts')
          .insert({
            session_id: sessionId,
            transcript_json: transcript,
            raw_text: rawText,
            duration_seconds: durationSeconds,
          });

        if (transcriptError) {
          console.error('Transcript save error:', transcriptError);
        }
      }

      // Update session status
      const { error: updateError } = await supabaseClient
        .from('roleplay_sessions')
        .update({
          status: 'completed',
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Session update error:', updateError);
        throw new Error('Failed to update session');
      }

      console.log(`Session ${sessionId} ended successfully`);

      return new Response(JSON.stringify({
        success: true,
        sessionId,
        message: 'Session ended successfully',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'abandon-session') {
      // Mark session as abandoned
      const body = await req.json();
      const { sessionId } = body;

      console.log(`Abandoning session: ${sessionId}`);

      const { error: updateError } = await supabaseClient
        .from('roleplay_sessions')
        .update({
          status: 'abandoned',
          ended_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .eq('trainee_id', user.id);

      if (updateError) {
        console.error('Session abandon error:', updateError);
        throw new Error('Failed to abandon session');
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'Session abandoned',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    console.error('Error in roleplay-session-manager:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
