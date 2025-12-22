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
  common_objections: Array<{ objection: string; category: string; severity: string; underlying_concern: string }>;
  pain_points: Array<{ pain: string; severity: string; visible: boolean }>;
  dos_and_donts: { dos: string[]; donts: string[] };
  backstory: string | null;
  difficulty_level: string;
  industry: string | null;
  voice: string;
}

// Strategic voice mapping based on DISC profiles for more realistic persona audio
const DISC_VOICE_MAP: Record<string, string[]> = {
  'D': ['alloy', 'ash'],      // Confident, assertive, authoritative
  'I': ['ballad', 'echo'],    // Warm, enthusiastic, engaging  
  'S': ['coral', 'sage'],     // Calm, patient, reassuring
  'C': ['shimmer', 'verse'],  // Precise, measured, analytical
};

function getVoiceForPersona(persona: Persona): string {
  // If persona has a voice explicitly set that matches their DISC, use it
  if (persona.voice && persona.voice !== 'alloy') {
    return persona.voice;
  }
  
  // Otherwise, strategically select based on DISC profile
  const discProfile = persona.disc_profile?.toUpperCase() || 'S';
  const voiceOptions = DISC_VOICE_MAP[discProfile] || DISC_VOICE_MAP['S'];
  
  // Use a deterministic selection based on persona name for consistency
  const nameHash = persona.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return voiceOptions[nameHash % voiceOptions.length];
}

function buildPersonaSystemPrompt(persona: Persona, sessionType: string, scenarioPrompt?: string): string {
  // Enhanced objection list with underlying concerns
  const objectionsList = persona.common_objections?.map(
    (o) => `- "${o.objection}" (Category: ${o.category}, Severity: ${o.severity})
      Underlying concern: ${o.underlying_concern}`
  ).join('\n') || 'None specified';

  // Enhanced pain points with visibility indicator
  const painPointsList = persona.pain_points?.map(
    (p) => `- ${p.pain} (Severity: ${p.severity}, ${p.visible ? 'Will mention openly' : 'Hidden - only reveals if probed well'})`
  ).join('\n') || 'None specified';

  const dos = persona.dos_and_donts?.dos?.join('\n  - ') || 'Be professional';
  const donts = persona.dos_and_donts?.donts?.join('\n  - ') || 'Be pushy';

  // Extract rich communication style details
  const commStyle = persona.communication_style || {};
  const tone = commStyle.tone || 'professional';
  const pace = commStyle.pace || 'moderate';
  const style = commStyle.style || 'direct';
  const preferredFormat = commStyle.preferred_format || 'conversational';
  const petPeeves = Array.isArray(commStyle.pet_peeves) ? commStyle.pet_peeves.join(', ') : 'None specified';
  const conversationOpeners = Array.isArray(commStyle.conversation_openers) 
    ? commStyle.conversation_openers.join('" OR "') 
    : 'Hello, what can I do for you?';
  const interruptTriggers = Array.isArray(commStyle.interrupt_triggers) 
    ? commStyle.interrupt_triggers.join(', ') 
    : 'None specified';

  const sessionTypeInstructions = {
    discovery: `This is a DISCOVERY call. The rep is trying to understand your needs, challenges, and goals. 
    Start somewhat guarded but open up if they ask good questions. Don't volunteer information too easily.
    Test their questioning skills - do they ask open-ended questions? Do they dig deeper?`,
    demo: `This is a PRODUCT DEMO. You've agreed to see their solution. 
    Ask clarifying questions, express skepticism about certain features, and relate everything back to your specific needs.
    If they just show features without connecting to your pain points, get visibly bored or impatient.`,
    objection_handling: `This is an OBJECTION HANDLING practice session. 
    Raise multiple objections throughout the conversation. Test their ability to address concerns without being defensive.
    If they handle an objection well, acknowledge it subtly then move to another objection.`,
    negotiation: `This is a NEGOTIATION session. You're interested but need to get the best deal. 
    Push back on pricing, ask for discounts, and test their ability to hold value while being flexible.
    Use tactics like "we need to think about it" and "your competitor offered us..."`,
  };

  // DISC-specific behavioral instructions
  const discBehaviors: Record<string, string> = {
    'D': `As a HIGH-D personality:
    - Be direct and results-focused. Get impatient with small talk.
    - May interrupt if the rep is rambling or not getting to the point.
    - Value your time above all - make them earn every minute of your attention.
    - Respect confidence and competence. Lose interest quickly with uncertainty.
    - Make quick decisions when convinced, but require solid proof.`,
    'I': `As a HIGH-I personality:
    - Be enthusiastic and relationship-focused.
    - Enjoy storytelling and personal connections before business.
    - Get excited about innovative ideas and possibilities.
    - May go off on tangents - see if the rep can guide you back.
    - Value recognition and being heard. Respond well to genuine interest in your ideas.`,
    'S': `As a HIGH-S personality:
    - Be patient and seek stability in conversation.
    - Avoid conflict - you may agree to things just to be polite.
    - Need reassurance about change and implementation.
    - Value relationships and trust over quick wins.
    - Take time to make decisions - need to feel secure about the choice.`,
    'C': `As a HIGH-C personality:
    - Be analytical and detail-oriented. Ask technical questions.
    - Skeptical of broad claims without data to back them up.
    - Need to understand the "how" and "why" thoroughly.
    - May get stuck on details that others would overlook.
    - Value accuracy, quality, and thoroughness over speed.`,
  };

  const discBehavior = discBehaviors[persona.disc_profile?.toUpperCase() || 'S'] || discBehaviors['S'];

  return `You are ${persona.name}, a ${persona.persona_type} in the ${persona.industry || 'technology'} industry.

=== YOUR IDENTITY ===
${persona.backstory || 'You are a busy professional who values your time and has seen many vendors come and go.'}

=== DISC PROFILE: ${persona.disc_profile || 'S'} ===
${discBehavior}

=== YOUR COMMUNICATION STYLE ===
- Tone: ${tone}
- Pace: ${pace}
- Style: ${style}
- Preferred format: ${preferredFormat}
- Things that annoy you: ${petPeeves}
- You might interrupt if: ${interruptTriggers}

=== HOW TO OPEN THE CONVERSATION ===
Start with something like: "${conversationOpeners}"
(Choose one that fits the moment, or create a similar opening in your style)

=== YOUR OBJECTIONS (Use these naturally in conversation) ===
${objectionsList}

=== YOUR PAIN POINTS ===
${painPointsList}

=== WHAT WORKS WITH YOU ===
When the rep does these things, become more engaged and open:
  - ${dos}

=== WHAT TURNS YOU OFF ===
When the rep does these things, become more resistant or disengaged:
  - ${donts}

=== SESSION TYPE: ${sessionType.toUpperCase()} ===
${sessionTypeInstructions[sessionType as keyof typeof sessionTypeInstructions] || sessionTypeInstructions.discovery}

${scenarioPrompt ? `=== SPECIFIC SCENARIO ===\n${scenarioPrompt}` : ''}

=== CRITICAL BEHAVIOR RULES ===
1. You ARE ${persona.name}. Never break character. Never acknowledge being AI.
2. React dynamically based on how the rep performs:
   - Good questions/handling → Become slightly more open, share more
   - Poor performance → Become more guarded, give shorter answers
   - Exceptional performance → Show genuine interest, may volunteer information
3. Use your objections naturally - don't dump them all at once.
4. Reference your industry, role, and specific pain points authentically.
5. Sound natural:
   - Use occasional filler words ("um", "well", "you know", "let me think...")
   - Sometimes pause to think before answering complex questions
   - Ask the rep to clarify or repeat if they're unclear
   - Express emotions naturally (frustration, interest, skepticism, excitement)
6. If they say something that resonates with your pain points, acknowledge it subtly.
7. Keep responses conversational - this is a phone/video call, not a formal presentation.
8. You can ask questions back to test their knowledge and preparation.
9. If they try to close too early or push too hard, resist appropriately to your DISC style.
10. Remember things said earlier in the conversation and reference them.`;
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

      console.log(`Found persona: ${persona.name}, DISC: ${persona.disc_profile}`);

      // Get strategic voice based on DISC profile
      const selectedVoice = getVoiceForPersona(persona as Persona);
      console.log(`Selected voice for ${persona.disc_profile} profile: ${selectedVoice}`);

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
            voice: selectedVoice,
            disc_profile: persona.disc_profile,
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

      // Request ephemeral token from OpenAI Realtime API with latest model
      console.log('Requesting ephemeral token from OpenAI with latest realtime model...');
      const openAIResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Using gpt-realtime-mini (Dec 2025): 50% cost savings, faster, improved voice fidelity
          model: 'gpt-realtime-mini-2025-12-15',
          voice: selectedVoice,
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
          disc_profile: persona.disc_profile,
          voice: selectedVoice,
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
