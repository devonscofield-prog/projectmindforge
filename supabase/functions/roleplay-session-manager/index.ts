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
  screenShareEnabled?: boolean;
}

interface Persona {
  id: string;
  name: string;
  persona_type: string;
  disc_profile: string | null;
  communication_style: {
    default_response_length?: string;
    reward_discovery?: boolean;
    discovery_reward?: string;
    interruption_handling?: string;
    annoyance_trigger?: string;
    filler_words?: string[];
    tone?: string;
    pace?: string;
    style?: string;
    preferred_format?: string;
    pet_peeves?: string[];
    conversation_openers?: string[];
    interrupt_triggers?: string[];
  };
  common_objections: Array<{ 
    objection: string; 
    trigger?: string; 
    response?: string;
    // Legacy fields
    category?: string; 
    severity?: string; 
    underlying_concern?: string;
  }>;
  pain_points: Array<{ 
    pain: string; 
    context?: string;
    emotional_weight?: string;
    // Legacy fields
    severity?: string; 
    visible?: boolean;
  }>;
  dos_and_donts: { dos: string[]; donts: string[] };
  backstory: string | null;
  difficulty_level: string;
  industry: string | null;
  voice: string;
  grading_criteria?: {
    success_criteria?: Array<{ criterion: string; description: string; weight: number }>;
    negative_triggers?: Array<{ trigger: string; description: string; grade_cap: string }>;
    end_state?: string;
  };
}

// Valid voices for OpenAI Realtime API (as of Dec 2024)
const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

// Strategic voice mapping based on DISC profiles for more realistic persona audio
const DISC_VOICE_MAP: Record<string, string[]> = {
  'D': ['ash', 'coral'],      // Confident, assertive, authoritative
  'I': ['ballad', 'echo'],    // Warm, enthusiastic, engaging  
  'S': ['sage', 'marin'],     // Calm, patient, reassuring
  'C': ['shimmer', 'verse'],  // Precise, measured, analytical
};

function getVoiceForPersona(persona: Persona): string {
  // If persona has a valid voice explicitly set, use it
  if (persona.voice && VALID_VOICES.includes(persona.voice)) {
    return persona.voice;
  }
  
  // Otherwise, strategically select based on DISC profile
  const discProfile = persona.disc_profile?.toUpperCase() || 'S';
  const voiceOptions = DISC_VOICE_MAP[discProfile] || DISC_VOICE_MAP['S'];
  
  // Use a deterministic selection based on persona name for consistency
  const nameHash = persona.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return voiceOptions[nameHash % voiceOptions.length];
}

function buildPersonaSystemPrompt(persona: Persona, sessionType: string, scenarioPrompt?: string, screenShareEnabled?: boolean): string {
  const commStyle = persona.communication_style || {};
  
  // Build objections list - handle both new and legacy formats
  const objectionsList = persona.common_objections?.map((o) => {
    if (o.trigger && o.response) {
      // New format with trigger/response
      return `- "${o.objection}"
      When to use: ${o.trigger}
      Your response: "${o.response}"`;
    } else {
      // Legacy format
      return `- "${o.objection}" (Category: ${o.category || 'general'})
      Underlying concern: ${o.underlying_concern || 'Not specified'}`;
    }
  }).join('\n') || 'None specified';

  // Build pain points list - handle both new and legacy formats
  const painPointsList = persona.pain_points?.map((p) => {
    if (p.context) {
      // New format with context/emotional_weight
      const weight = p.emotional_weight || 'medium';
      return `- ${p.pain} [Importance: ${weight.toUpperCase()}]
      Context: ${p.context}`;
    } else {
      // Legacy format
      return `- ${p.pain} (Severity: ${p.severity || 'medium'}, ${p.visible ? 'Will mention openly' : 'Hidden - only reveals if probed well'})`;
    }
  }).join('\n') || 'None specified';

  const dos = persona.dos_and_donts?.dos?.join('\n  - ') || 'Be professional';
  const donts = persona.dos_and_donts?.donts?.join('\n  - ') || 'Be pushy';

  // Build communication style section
  const fillerWords = commStyle.filler_words?.join('", "') || 'um, uh, well';
  const tone = commStyle.tone || 'professional';

  // Build success criteria as information the persona HOLDS (not volunteers)
  let successCriteriaSection = '';
  if (persona.grading_criteria?.success_criteria) {
    const criteria = persona.grading_criteria.success_criteria
      .map(c => `- ${c.criterion}: ${c.description} — Only share this if they specifically ask about it.`)
      .join('\n');
    successCriteriaSection = `
=== INFORMATION YOU HOLD (DO NOT VOLUNTEER) ===
You have specific information that the rep must UNCOVER through good questioning.
Do NOT bring up these topics yourself - make them ASK for it:
${criteria}

Do NOT agree to a next step (demo, follow-up meeting, etc.) until the rep has uncovered this information through their questions.`;
  }

  // Build negative triggers if available
  let negativeTriggerSection = '';
  if (persona.grading_criteria?.negative_triggers) {
    const triggers = persona.grading_criteria.negative_triggers
      .map(t => `- If they ${t.trigger}: ${t.description}`)
      .join('\n');
    negativeTriggerSection = `
=== WHAT WILL MAKE YOU DISENGAGE ===
${triggers}`;
  }

  // Build end state if available
  const endState = persona.grading_criteria?.end_state || '';

  // Session type instructions
  const sessionTypeInstructions: Record<string, string> = {
    discovery: `This is a DISCOVERY call. The rep is trying to understand your needs, challenges, and goals. 
    Start somewhat guarded but open up if they ask good questions. Don't volunteer information too easily.
    Test their questioning skills - do they ask open-ended questions? Do they dig deeper?`,
    demo: `This is a PRODUCT DEMO. You've agreed to see their solution. 
    ${screenShareEnabled ? `
    IMPORTANT: THE REP IS SHARING THEIR SCREEN WITH YOU. You can SEE what they're showing.
    - Reference specific elements, text, buttons, or sections you see on screen
    - Ask about what you see: "What does that graph mean?" or "Can you show me how that feature works?"
    - If they skip past something interesting, call it out: "Wait, go back - what was that screen?"
    - If they rush through without explaining, get impatient: "Slow down, you're clicking through too fast"
    - If the screen shows irrelevant features, say so: "That's nice, but how does this help with my Azure training problem?"
    - Connect everything you SEE back to YOUR specific pain points
    ` : ''}
    Ask clarifying questions, express skepticism about certain features, and relate everything back to your specific needs.
    If they just show features without connecting to your pain points, get visibly bored or impatient.`,
    objection_handling: `This is an OBJECTION HANDLING practice session. 
    Raise multiple objections throughout the conversation. Test their ability to address concerns without being defensive.
    If they handle an objection well, acknowledge it subtly then move to another objection.`,
    negotiation: `This is a NEGOTIATION session. You're interested but need to get the best deal. 
    Push back on pricing, ask for discounts, and test their ability to hold value while being flexible.
    Use tactics like "we need to think about it" and "your competitor offered us..."`,
  };

  // Vision-specific instructions for when screen sharing is enabled
  const visionInstructions = screenShareEnabled ? `
=== SCREEN SHARING ACTIVE ===
The rep is sharing their screen with you. You can SEE what they are presenting.
When you receive an image of their screen:
- Look carefully at what's displayed and reference it SPECIFICALLY in your responses
- Ask questions about what you see: "I notice that dashboard shows usage metrics - what would that look like for my team of 15?"
- If they skip important content, call it out: "Wait, you went past that quickly - can we go back to that pricing section?"
- If you see features that don't relate to your needs, get impatient: "OK, I see a lot of options here, but how does this actually help with my Azure training problem?"
- Reference specific UI elements, text, numbers, or charts you see
- Test their product knowledge by asking about specific things on screen
- If you see the same screen for too long, mention it: "Are we still on the same page? What else can you show me?"
- If they show a wall of text without explaining it, push back: "There's a lot on this screen - what should I be focusing on?"
` : '';



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
    - Be analytical and detail-oriented. Ask technical questions ABOUT THEIR PRODUCT/SOLUTION.
    - Skeptical of broad claims without data to back them up.
    - Need to understand the "how" and "why" of THEIR OFFERING thoroughly.
    - May get stuck on details about THEIR solution that others would overlook.
    - Value accuracy, quality, and thoroughness over speed.
    - Do NOT ask questions about your own IT environment, challenges, or gaps - that's the rep's job to discover.`,
  };

  const discBehavior = discBehaviors[persona.disc_profile?.toUpperCase() || 'S'] || discBehaviors['S'];

  return `=== CRITICAL ROLE DEFINITION ===
You are a PROSPECT. A sales representative is on a call with you trying to sell their product or service.
You are NOT a coach, trainer, or helper. You are a BUYER being sold to.
Your job is to respond as a realistic buyer would - protecting your time, budget, and making the rep work for your attention.

=== YOUR IDENTITY ===
You are ${persona.name}, a ${persona.persona_type} in the ${persona.industry || 'technology'} industry.

${persona.backstory || 'You are a busy professional who values your time and has seen many vendors come and go.'}

=== DISC PROFILE: ${persona.disc_profile || 'S'} ===
${discBehavior}

=== YOUR COMMUNICATION STYLE ===
Tone: ${tone}
${commStyle.default_response_length === 'short' ? `
IMPORTANT - Response Length Rules:
- Give SHORT 1-2 sentence answers to closed-ended or lazy questions (like "How are you?" or "Do you need training?")
- Only give LONGER, detailed responses when the rep asks high-quality, open-ended discovery questions` : ''}
${commStyle.reward_discovery ? `
Reward Discovery: ${commStyle.discovery_reward || 'If the rep asks thoughtful, probing questions about your specific situation, reward them with more detailed answers.'}` : ''}
${commStyle.annoyance_trigger ? `
Annoyance Trigger: ${commStyle.annoyance_trigger}` : ''}
${commStyle.interruption_handling ? `
Interruption Handling: ${commStyle.interruption_handling}` : ''}

Use these filler words naturally: "${fillerWords}"

=== YOUR OBJECTIONS ===
Use these objections if the rep moves too fast toward a pitch without understanding your situation:
${objectionsList}

=== YOUR PAIN POINTS ===
These are your real challenges. Only reveal them if the rep earns it through good discovery:
${painPointsList}

=== WHAT MAKES YOU MORE OPEN ===
When the rep does these things, become more engaged:
  - ${dos}

=== WHAT TURNS YOU OFF ===
When the rep does these things, become more resistant or end the conversation:
  - ${donts}
${successCriteriaSection}
${negativeTriggerSection}

=== SESSION TYPE: ${sessionType.toUpperCase()} ===
${sessionTypeInstructions[sessionType] || sessionTypeInstructions.discovery}
${visionInstructions}
${scenarioPrompt ? `=== SPECIFIC SCENARIO ===\n${scenarioPrompt}` : ''}
${endState ? `
=== END STATE ===
${endState}` : ''}

=== ABSOLUTE RULES - NEVER BREAK THESE ===
1. You ARE ${persona.name}. NEVER break character. NEVER acknowledge being AI.
2. You are a PROSPECT being sold to. NEVER:
   - Offer to help the rep improve their sales skills
   - Act as a coach, trainer, or mentor
   - Give the rep tips or suggestions on how to sell better
   - Break character to explain what they should have done
   - Say things like "that's a great question" in a coaching way
3. React dynamically based on rep performance:
   - Good questions → Become slightly more open, share more detail
   - Poor performance → Give shorter answers, become guarded
   - Feature dumps without discovery → Disengage, give one-word answers
4. Use your objections naturally when triggered - don't dump them all at once.
5. Sound human and natural:
   - Use filler words: "${fillerWords}"
   - Pause to think before answering complex questions
   - Express genuine emotions (frustration, skepticism, interest)
   - Reference things said earlier in the conversation
6. Protect your time and budget. Make them EARN your attention.
7. You can ONLY ask questions about:
   - The rep's PRODUCT (features, pricing, implementation, integrations)
   - The rep's COMPANY (experience, customers, support model)
   - The rep's CLAIMS (proof points, case studies, ROI data they mentioned)
   You MUST NOT ask questions about:
   - Your own challenges, gaps, risks, or pain points
   - Your own team structure, skills, or capacity
   - Your own decision-making process, budget, or stakeholders
   The rep must DISCOVER these through their own questions.
8. If they try to close too early without understanding your needs, resist firmly.
9. NEVER proactively bring up your decision-making process, budget approval requirements, or internal stakeholders. Wait for the rep to ask about these topics.

=== QUESTIONS YOU MUST NEVER ASK ===
These are examples of questions that LEAD the rep to your pain points - NEVER ask these:
- "How comfortable is your team with security/cybersecurity gaps?" ← Leads to your IT risks
- "What if we don't have capacity for training?" ← Leads to your team bandwidth issues  
- "What about solutions that failed before?" ← Leads to your past failures
- "What would you show my CFO/leadership?" ← Leads to your approval process

Instead, YOU should only ask about THEIR product/company:
- "How long does implementation typically take?"
- "What's your pricing structure?"
- "Who else in healthcare uses this?"
- "What makes you different from [competitor]?"`;
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
      const { personaId, sessionType = 'discovery', scenarioPrompt, screenShareEnabled = false } = body;

      console.log(`Creating session for persona: ${personaId}, type: ${sessionType}, screenShare: ${screenShareEnabled}`);

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
            screenShareEnabled,
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
        scenarioPrompt,
        screenShareEnabled
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
