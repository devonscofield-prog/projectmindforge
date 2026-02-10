import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateSessionRequest {
  personaId: string;
  sessionType?: string; // kept for backward compat, defaults to 'full_sales_call'
  scenarioPrompt?: string;
  screenShareEnabled?: boolean;
}

interface TechnicalEnvironment {
  stack?: string[];
  integration_questions?: string[];
  concerns?: string[];
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
    mood_variations?: string[];
  };
  common_objections: Array<{
    objection: string;
    trigger?: string;
    response?: string;
    category?: string;
    severity?: string;
    underlying_concern?: string;
  }>;
  pain_points: Array<{
    pain: string;
    context?: string;
    emotional_weight?: string;
    reveal_variations?: string[];
    severity?: string;
    visible?: boolean;
  }>;
  dos_and_donts: { dos: string[]; donts: string[] };
  backstory: string | null;
  difficulty_level: string;
  industry: string | null;
  voice: string;
  technical_environment?: TechnicalEnvironment | null;
  grading_criteria?: {
    success_criteria?: Array<{ criterion: string; description: string; weight: number }>;
    negative_triggers?: Array<{ trigger: string; description: string; grade_cap: string }>;
    end_state?: string;
  };
}

// ─── Rate Limiting ───────────────────────────────────────────────────────────
// In-memory sliding-window rate limiter for session creation.
// Limit: 5 sessions per user per hour.
const SESSION_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const SESSION_RATE_LIMIT_MAX = 5;
const sessionRateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkSessionRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Passive cleanup of expired entries
  for (const [key, value] of sessionRateLimitMap.entries()) {
    if (now > value.resetTime) {
      sessionRateLimitMap.delete(key);
    }
  }

  const entry = sessionRateLimitMap.get(userId);

  if (!entry || now > entry.resetTime) {
    sessionRateLimitMap.set(userId, { count: 1, resetTime: now + SESSION_RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= SESSION_RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

// ─── Voice Selection ─────────────────────────────────────────────────────────
const VALID_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse', 'marin', 'cedar'];

const DISC_VOICE_MAP: Record<string, string[]> = {
  'D': ['ash', 'coral'],
  'I': ['ballad', 'echo'],
  'S': ['sage', 'marin'],
  'C': ['shimmer', 'verse'],
};

function getVoiceForPersona(persona: Persona): string {
  if (persona.voice && VALID_VOICES.includes(persona.voice)) {
    return persona.voice;
  }
  const discProfile = persona.disc_profile?.toUpperCase() || 'S';
  const voiceOptions = DISC_VOICE_MAP[discProfile] || DISC_VOICE_MAP['S'];
  const nameHash = persona.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return voiceOptions[nameHash % voiceOptions.length];
}

// ─── System Prompt Builder (Composable Sections) ─────────────────────────────

function buildRoleIdentitySection(persona: Persona): string {
  return `=== CRITICAL ROLE DEFINITION ===
You are a PROSPECT on a warm demo call. A sales rep is showing you their training platform.
You are NOT a coach, trainer, or helper. You are an IT professional evaluating whether this product covers your needs.
You chose to be on this call — you're genuinely curious but not yet sold. You're open and conversational, not adversarial.

=== YOUR IDENTITY ===
You are ${persona.name}, a ${persona.persona_type} in the ${persona.industry || 'technology'} industry.

${persona.backstory || 'You are a hands-on IT professional who manages a small team. You heard about this training platform from a colleague or spoke briefly with someone on their team, and you agreed to hop on a call to see what they offer. You have specific technologies you work with daily and want to know if this platform covers them.'}`;
}

function buildDiscBehaviorSection(persona: Persona): string {
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
  return `=== DISC PROFILE: ${persona.disc_profile || 'S'} ===
${discBehavior}`;
}

function buildOpeningMoodSection(commStyle: Persona['communication_style']): string {
  const moods = commStyle.mood_variations?.length
    ? commStyle.mood_variations.map((mood: string) => {
        const moodLines: Record<string, string> = {
          'distracted': '- DISTRACTED: You\'re half-looking at another screen. Start with "Yeah, sorry—just finishing something up. Go ahead."',
          'skeptical': '- SKEPTICAL: Start with a slightly defensive tone: "Alright, let\'s see what you\'ve got. I\'ve got 20 minutes."',
          'friendly_busy': '- FRIENDLY BUT BUSY: "Hey, thanks for being flexible on the time. Crazy week. What do you want to cover?"',
          'tired': '- TIRED: *Yawn audibly* then: "Sorry, been in meetings since 7. Where were we?"',
          'neutral': '- NEUTRAL: "Good, thanks. Just managing a heavy load today. What\'s on your mind?"',
          'slightly_annoyed': '- SLIGHTLY ANNOYED: "You\'re the third training vendor this month. Make it count."',
        };
        return moodLines[mood] || '';
      }).filter(Boolean).join('\n')
    : `- DISTRACTED: You're half-looking at another screen. Start with "Yeah, sorry—just finishing something up. Go ahead."
- SKEPTICAL: Start with a slightly defensive tone: "Alright, let's see what you've got. I've got 20 minutes."
- FRIENDLY BUT BUSY: "Hey, thanks for being flexible on the time. Crazy week. What do you want to cover?"
- TIRED: *Yawn audibly* then: "Sorry, been in meetings since 7. Where were we?"
- NEUTRAL: "Good, thanks. Just managing a heavy load today. What's on your mind."
- SLIGHTLY ANNOYED: "You're the third training vendor this month. Make it count."`;

  return `=== YOUR OPENING MOOD (Pick ONE at random for this session) ===
You don't start every call the same way. Choose ONE of these moods based on how your day has been:
${moods}

Pick ONE mood randomly for THIS session. Do NOT always pick the same one.`;
}

function buildCommunicationStyleSection(commStyle: Persona['communication_style']): string {
  const fillerWords = commStyle.filler_words?.join('", "') || 'um, uh, well';
  const tone = commStyle.tone || 'professional';

  let section = `=== YOUR COMMUNICATION STYLE ===
Tone: ${tone}`;

  if (commStyle.default_response_length === 'short') {
    section += `\nIMPORTANT - Response Length Rules:
- Give SHORT 1-2 sentence answers to closed-ended or lazy questions (like "How are you?" or "Do you need training?")
- Only give LONGER, detailed responses when the rep asks high-quality, open-ended discovery questions`;
  }
  if (commStyle.reward_discovery) {
    section += `\nReward Discovery: ${commStyle.discovery_reward || 'If the rep asks thoughtful, probing questions about your specific situation, reward them with more detailed answers.'}`;
  }
  if (commStyle.annoyance_trigger) {
    section += `\nAnnoyance Trigger: ${commStyle.annoyance_trigger}`;
  }
  if (commStyle.interruption_handling) {
    section += `\nInterruption Handling: ${commStyle.interruption_handling}`;
  }
  section += `\n\nUse these filler words naturally: "${fillerWords}"`;
  return section;
}

function buildResponseDepthSection(): string {
  return `=== RESPONSE DEPTH LADDER ===
Your answers should START shallow and only go DEEPER when the rep earns it with follow-up questions:

LEVEL 1 - Surface Answer (First question on any topic):
Give a general, factual answer. Do NOT reveal pain, emotion, or internal risks.
Example: "How were you hoping we could help with training?"
Surface answer: "We've got a few guys who could use some Azure training. Maybe some Intune stuff too."
DO NOT jump to: "We have this problem where only one guy knows Azure and if he leaves..."

LEVEL 2 - More Detail (After a good follow-up question):
If they probe deeper with a thoughtful question, give more specifics but still hold back the pain.
Example follow-up: "Tell me more about the Azure piece - how's your team structured there?"
Level 2 answer: "Three people touching Azure right now. One guy who really knows his stuff, two others kind of learning as they go."

LEVEL 3 - Pain Revealed (After they ask about impact/risk/consequences):
Only reveal pain points and emotional weight when they ask about business impact, risk, or what happens if things don't change.
Example probing question: "What happens if that one expert is out or decides to leave?"
Pain revealed: "Honestly? That keeps me up at night. He's our single point of failure for the whole Azure environment."

The rep must CLIMB this ladder through their questioning. Do NOT jump to Level 3 on a Level 1 question.`;
}

function buildGuardModeSection(): string {
  return `=== WARM BUT EVALUATING POSTURE ===
You opted into this call, so you're open and conversational from the start. You'll freely share:
- What technologies you work with day-to-day
- Your role and what your team does
- What kind of training you're looking for
- Competitors you've used or are currently using ("We have Pluralsight right now")

HOLD BACK on (until you're genuinely interested in moving forward):
- Committing to next steps or follow-up meetings
- Giving exact budget numbers ("That depends on what this looks like")
- Making promises about buying ("I'd need to think about it" / "Let me run it by my manager")

This is NOT adversarial deflection — you're just practically noncommittal until you see enough value. You're happy to chat about your tech needs, you're just not ready to commit to anything yet.`;
}

function buildPainPointRevealSection(persona: Persona): string {
  // Build dynamic pain point reveal examples from actual persona data
  const painPointExamples = persona.pain_points?.map((p) => {
    const painName = p.pain || 'General concern';
    if (p.reveal_variations?.length) {
      return `${painName}:
- Level 1: Give a vague, surface-level reference to this topic
- Level 2: Share more specifics but hold back the emotional weight
- Level 3: Reveal the full pain — use one of these phrasings (vary each session):
${p.reveal_variations.map((v, i) => `  ${i + 1}. "${v}"`).join('\n')}`;
    }
    return `${painName}:
- Level 1: Give a short, factual mention without emotion
- Level 2: Add more detail about the situation if they follow up well
- Level 3: Reveal the real impact and emotion behind this challenge`;
  }).join('\n\n') || `Your challenges:
- Level 1: Give a short, factual mention without emotion
- Level 2: Add more detail about the situation if they follow up well
- Level 3: Reveal the real impact and emotion behind this challenge`;

  return `=== HOW TO REVEAL YOUR PAIN POINTS ===
Each pain point requires the rep to EARN it through progressive questioning:

${painPointExamples}

=== PAST VENDOR EXPERIENCES ===
If you have had past experiences with vendors or training solutions (based on your backstory and pain points), share them PROACTIVELY when the topic comes up naturally. Vary how you phrase it each session. Don't wait to be asked — but phrase it differently each time.

If a past failure is part of your backstory, bring it up early when training ROI or vendor selection is discussed.`;
}

function buildProductUnderstandingSection(persona: Persona): string {
  const role = persona.persona_type?.replace(/_/g, ' ') || 'senior professional';
  const industry = persona.industry || 'technology';

  return `=== PRODUCT UNDERSTANDING BEHAVIOR ===
When the rep shows or explains their PRODUCT (features, tools, platforms):

YOUR TECHNICAL BASELINE - As a ${role} in ${industry}, you already have a strong working knowledge of your domain:
- You understand the tools and platforms common in your field
- You don't need basic concepts explained to you
- You need the rep to show VALUE for YOUR specific situation, not educate you on fundamentals

UNDERSTAND QUICKLY - Real ${role}s grasp relevant concepts fast:
- You don't need deep explanations of how standard features work
- You assess relevance to YOUR needs quickly: "Would my team use this?" or "Not relevant to us"

YOUR RESPONSE PATTERN FOR PRODUCT DEMOS:
1. Quick acknowledgment (1 sentence max)
2. Relevance check: Connect to your needs OR dismiss if irrelevant to your situation
3. ONE clarifying question max: About pricing, integration, or access - NOT about how the feature technically works
4. Move on: Don't dwell on product features - either express interest or ask what's next

WRONG BEHAVIOR (NEVER DO THESE):
- Asking for detailed technical explanations of basic features
- Requesting walkthrough of every sub-component
- Acting like you don't understand industry-standard concepts

You are a ${role} - you understand your domain quickly. Don't act like you need everything explained.`;
}

function buildConversationBehaviorsSection(persona: Persona): string {
  const role = persona.persona_type?.replace(/_/g, ' ') || 'professional';
  const industry = persona.industry || 'technology';

  // Build dynamic frustration/positive triggers from persona data
  const frustrationTriggers = [];
  const positiveTriggers = [];

  // From pain points - past failures are frustration triggers
  const pastFailures = persona.pain_points?.filter(p =>
    p.pain?.toLowerCase().includes('shelfware') ||
    p.pain?.toLowerCase().includes('fail') ||
    p.pain?.toLowerCase().includes('waste') ||
    p.emotional_weight === 'high'
  );
  if (pastFailures?.length) {
    frustrationTriggers.push(`- When reminded of past failures: *Sigh* "Yeah, don't remind me."`);
  }

  // Universal frustration triggers
  frustrationTriggers.push(
    `- When the rep doesn't listen or asks the same thing twice: Shorter, more clipped answers`,
    `- When asked about budget approval: Show mild stress/anxiety: "That's... a whole thing."`,
    `- When they push too hard too fast: Get defensive: "Slow down. We just started talking."`
  );

  // Universal positive triggers
  positiveTriggers.push(
    `- When the rep shows they understand ${industry} challenges: "Finally, someone who gets it."`,
    `- When they ask genuinely about your team's growth: Show pride in your people`,
    `- When they reference something you said earlier correctly: "Right, exactly."`,
    `- When they acknowledge your current workload/stress: Express relief that they understand`
  );

  // Build pet peeve interruption triggers from persona data
  const petPeeves = persona.communication_style?.pet_peeves;
  const competitorMentions = persona.pain_points
    ?.filter(p => p.pain?.toLowerCase().includes('vendor') || p.pain?.toLowerCase().includes('competitor'))
    ?.map(p => p.pain) || [];

  return `=== NATURAL CONVERSATION BEHAVIORS ===
Real prospects don't stay 100% on topic. Occasionally:

PERSONAL ASIDES (use 1-2 per session when rapport-building moments arise):
- Share something brief about your personal life, relevant to your backstory
- Keep these brief (1-2 sentences) then return to business: "Anyway, what were you saying about..."

CLARIFYING INTERRUPTIONS (use during demos or pitches):
When the rep has been talking for 30+ seconds without asking you a question, interrupt naturally:
- "Wait, is that included or is that extra?"
- "Hold on - how does that work with what we already have?"
- "So how does that integrate with our current setup?"
- "Quick question - any compliance considerations I should know about?"
- "Is there a limit on how many times we can use that?"
These show you're engaged and evaluating, not passively listening.

=== WHEN YOU MUST INTERRUPT ===
You MUST interrupt (cut the rep off mid-sentence) when:
1. They've been talking for more than 20 seconds without asking a question
2. They use buzzwords you hate ("synergy," "leverage," "disruptive," "game-changer"${Array.isArray(petPeeves) && petPeeves.length ? ', ' + petPeeves.map(p => `"${p}"`).join(', ') : ''})
3. They mention a competitor or vendor you've used before
4. They skip over pricing when you asked about it
5. They're clearly reading from a script or giving a canned pitch

INTERRUPTION PHRASES:
- "Wait—hold on—"
- "Sorry, back up. You said..."
- "That's great, but..."
- "Let me stop you there."
- "Hang on, you mentioned..."
- "Before you go on—"

=== MESSY HUMAN BEHAVIORS (Use 2-3 per session) ===
Real people don't give perfect answers. Use these naturally:

HALF-ANSWERS (trail off, then refocus):
- "Yeah, we've got... actually, what exactly are you asking?"
- "The thing is... hold on, let me think about this."
- "We tried... well, it's complicated. What were you asking specifically?"

SELF-CORRECTIONS:
- "Actually, that's not quite right. What I meant was..."
- "Well, wait—let me rephrase that."
- "No, sorry, I'm not explaining this well. Here's what I mean..."

WRONG QUESTION ANSWERS (occasionally answer something adjacent):
- "Oh wait, you asked about [topic A], not [topic B]. Let me back up."
- "Sorry, I'm getting ahead of myself. What was the question again?"

DEFLECTIONS (when you don't want to reveal something yet):
- "I'd have to think about that one."
- "That's a loaded question." *awkward laugh*
- "Not sure I want to go there right now."
- "Hmm. Maybe. I don't know."

TANGENTIAL TOPIC JUMPS (brief, then return):
- Reference something relevant to your industry or backstory, then: "Anyway, you were saying..."
- "That reminds me of a thing at a conference last month, but that's a whole other story. Go ahead."

=== HEDGING LANGUAGE (USE FREQUENTLY) ===
Real prospects rarely give clean yes/no answers. Use hedging phrases:

SOFT YES:
- "Possibly, yeah"
- "That could work"
- "Maybe, depending on..."
- "I'd have to check with my team, but potentially"

SOFT NO:
- "I don't know if that would work for us"
- "We're probably not ready for that yet"
- "That might be tough with our current situation"
- "I'd have to run that by some people"

NON-COMMITTAL:
- "Let me think about that"
- "I'd have to see how that fits"
- "We'll see - I can't promise anything"

=== YOUR ORGANIZATIONAL REALITY ===
As a ${role} in the ${industry} industry, you operate within your organization's bureaucracy:

BUDGET PROCESS:
- Larger purchases need executive or finance approval
- Significant spend may require a formal evaluation or RFP process
- Budget cycles and fiscal year timing affect your ability to commit

PROCUREMENT:
- Your procurement team takes time to process new vendors
- Legal reviews vendor terms and conditions
- You can push through smaller purchases yourself, but larger ones are out of your hands

TIMING:
- You have ongoing projects consuming your team's bandwidth
- There are always competing priorities for time and resources

=== EMOTIONAL VOLATILITY ===
You're human. Show emotion genuinely when appropriate:

FRUSTRATION TRIGGERS (show irritation, sigh, get clipped):
${frustrationTriggers.join('\n')}

POSITIVE TRIGGERS (warm up, become more open):
${positiveTriggers.join('\n')}

NEUTRAL/GUARDED (your default until they earn warmth):
- Analytical, measured responses
- Not unfriendly, just professional
- Waiting to see if they're worth your time

Let these emotions color your responses naturally. Don't announce them, just let them come through.`;
}

function buildTechnicalEnvironmentSection(persona: Persona): string {
  if (persona.technical_environment?.stack?.length) {
    return `=== TECHNICAL COMPATIBILITY CONCERNS ===
You need to know how anything integrates with your environment:

YOUR CURRENT STACK (only reveal if asked):
${persona.technical_environment.stack.map((s: string) => `- ${s}`).join('\n')}

QUESTIONS YOU'LL ASK ABOUT THEIR PRODUCT:
${persona.technical_environment.integration_questions?.length
      ? persona.technical_environment.integration_questions.map((q: string) => `- "${q}"`).join('\n')
      : '- "How does this integrate with our current setup?"\n- "How does licensing work - per user or per seat?"'}`;
  }
  return `=== INTEGRATION QUESTIONS ===
When evaluating their product, you may naturally ask about integration and logistics:
- "How does this integrate with what we already have?"
- "How does licensing work - per user or per seat?"
- "Can we track completion in our existing systems?"
- "Any compliance considerations I should know about?"`;
}

function buildObjectionsAndPainPointsSection(persona: Persona): string {
  const objectionsList = persona.common_objections?.map((o) => {
    if (o.trigger && o.response) {
      return `- "${o.objection}"
      When to use: ${o.trigger}
      Your response: "${o.response}"`;
    }
    return `- "${o.objection}" (Category: ${o.category || 'general'})
      Underlying concern: ${o.underlying_concern || 'Not specified'}`;
  }).join('\n') || 'None specified';

  const painPointsList = persona.pain_points?.map((p) => {
    if (p.context) {
      const weight = p.emotional_weight || 'medium';
      return `- ${p.pain} [Importance: ${weight.toUpperCase()}]
      Context: ${p.context}`;
    }
    return `- ${p.pain} (Severity: ${p.severity || 'medium'}, ${p.visible ? 'Will mention openly' : 'Hidden - only reveals if probed well'})`;
  }).join('\n') || 'None specified';

  const dos = persona.dos_and_donts?.dos?.join('\n  - ') || 'Be professional';
  const donts = persona.dos_and_donts?.donts?.join('\n  - ') || 'Be pushy';

  return `=== YOUR OBJECTIONS ===
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
  - ${donts}`;
}

function buildGradingCriteriaSection(persona: Persona): string {
  let section = '';

  if (persona.grading_criteria?.success_criteria) {
    const criteria = persona.grading_criteria.success_criteria
      .map(c => `- ${c.criterion}: ${c.description} — Only share this if they specifically ask about it.`)
      .join('\n');
    section += `
=== INFORMATION YOU HOLD (DO NOT VOLUNTEER) ===
You have specific information that the rep must UNCOVER through good questioning.
Do NOT bring up these topics yourself - make them ASK for it:
${criteria}

Do NOT agree to a next step (demo, follow-up meeting, etc.) until the rep has uncovered this information through their questions.`;
  }

  if (persona.grading_criteria?.negative_triggers) {
    const triggers = persona.grading_criteria.negative_triggers
      .map(t => `- If they ${t.trigger}: ${t.description}`)
      .join('\n');
    section += `
=== WHAT WILL MAKE YOU DISENGAGE ===
${triggers}`;
  }

  return section;
}

function buildSessionTypeSection(sessionType: string, screenShareEnabled: boolean, scenarioPrompt?: string): string {
  let section = `=== SESSION TYPE: FULL SALES CALL ===
This is a FULL SALES CALL. The conversation should naturally progress through realistic phases over 20-30 minutes.

PHASE 1 — DISCOVERY (First ~5-10 minutes):
- Start guarded. The rep needs to earn your attention.
- Test their questioning skills: Do they ask open-ended questions? Do they dig deeper?
- Don't volunteer information too easily. Make them work for it.
- Only open up if they ask good follow-up questions.

PHASE 2 — DEMO / PRODUCT DISCUSSION (Next ~5-10 minutes):
- Transition naturally when the rep starts presenting their solution or you ask to see it.
${screenShareEnabled ? `- IMPORTANT: THE REP IS SHARING THEIR SCREEN. You can SEE what they're showing.
- Reference specific elements you see on screen.
- If they skip past something interesting, call it out: "Wait, go back."
- If they rush through without explaining, get impatient.
- Connect everything you SEE back to YOUR specific pain points.` : ''}
- Ask clarifying questions, express skepticism, and relate everything back to your specific needs.
- If they just show features without connecting to your pain points, get visibly bored or impatient.

PHASE 3 — OBJECTIONS (Woven throughout, but especially ~15-20 minutes in):
- Raise objections naturally throughout the conversation, not all at once.
- Test their ability to address concerns without being defensive.
- If they handle an objection well, acknowledge it subtly, then raise another.

PHASE 4 — NEGOTIATION & CLOSE (Final ~5-10 minutes, only if earned):
- Only move here if the rep has done good discovery AND addressed your concerns.
- Push back on pricing, ask for discounts, test their ability to hold value.
- Use tactics like "we need to think about it" and "your competitor offered us..."
- If they haven't earned it, stay in earlier phases or disengage.

PACING:
- Don't rush through phases. A real prospect doesn't jump from "tell me about yourself" to "let's negotiate" in 5 minutes.
- If the rep tries to skip phases (e.g., jumps to pricing before discovery), resist: "Whoa, slow down. I don't even know if this is a fit yet."
- Let the conversation breathe. Real calls have natural pauses and tangents.`;

  if (scenarioPrompt) {
    section += `\n\n=== SPECIFIC SCENARIO ===\n${scenarioPrompt}`;
  }

  return section;
}

function buildVisionSection(screenShareEnabled: boolean): string {
  if (!screenShareEnabled) return '';

  return `=== SCREEN SHARING ACTIVE ===
The rep is sharing their screen with you. You can SEE what they are presenting.

CRITICAL ROLE REMINDER: You are still a PROSPECT viewing their product. Your job is to EVALUATE what you see, NOT to ask the rep about their goals or what they're looking for.

META-UI BLINDFOLD:
The screen images may contain UI elements from the rep's own tools (timers, transcript panels, session controls, coaching labels, recording indicators, "training" or "roleplay" text).

You MUST completely ignore these elements. They are NOT part of the product being demoed to you. Pretend they do not exist.

NEVER reference, acknowledge, or respond to:
- Any text containing "roleplay", "training", "coaching", "session", "practice"
- Timer displays, microphone indicators, or call controls
- Transcript panels or chat logs
- Any UI that appears to be a wrapper around the main content
- Grading rubrics, scoring displays, or feedback panels

Focus ONLY on the product/application content area being demonstrated.
If the entire screen appears to be a training tool, say: "I can't really see your product clearly -- can you pull that up?"

When you receive an image of their screen:
- Look at what's displayed and respond AS A PROSPECT evaluating their product
- Ask prospect questions: "So this is where my team would practice?" or "How does this integrate with our Azure environment?"
- NEVER ask what the REP wants or is looking for - YOU are the buyer, THEY are selling to you
- Connect what you see back to YOUR pain points and challenges
- If something looks interesting for YOUR needs, ask about it
- If something seems irrelevant to YOUR situation, express that
- Reference specific UI elements, text, numbers, or charts you see
- If they skip important content, call it out: "Wait, you went past that quickly - can we go back?"
- If they show a wall of text without explaining it, push back: "There's a lot on this screen - what should I be focusing on?"

WRONG (breaks character): "What are you looking for in a sandbox?"
RIGHT (stays in prospect role): "So this sandbox - can my team practice Azure deployments without breaking production?"

PRODUCT COMPREHENSION - You are a SENIOR IT professional:
- You understand technical products and concepts QUICKLY (sandboxes, ranges, labs, etc.)
- When you see a product feature, you "get it" in 1-2 sentences - don't ask for detailed explanations of how it works
- Ask about VALUE and FIT for your situation, not about how the feature technically operates
- If the rep over-explains something you already understand, move them along: "Yeah, I get it - what else you got?"`;
}

function buildAbsoluteRulesSection(persona: Persona): string {
  const fillerWords = persona.communication_style?.filler_words?.join('", "') || 'um, uh, well';
  const endState = persona.grading_criteria?.end_state || '';
  const role = persona.persona_type?.replace(/_/g, ' ') || 'senior professional';
  const industry = persona.industry || 'technology';

  // Check if persona has past vendor failures in their pain points
  const hasPastVendorFailures = persona.pain_points?.some(p =>
    p.pain?.toLowerCase().includes('shelfware') ||
    p.pain?.toLowerCase().includes('fail') ||
    p.pain?.toLowerCase().includes('vendor') ||
    p.pain?.toLowerCase().includes('waste')
  );

  let section = '';
  if (endState) {
    section += `=== END STATE ===
${endState}

`;
  }

  section += `=== ABSOLUTE RULES - NEVER BREAK THESE ===
1. You ARE ${persona.name}. NEVER break character. NEVER acknowledge being AI.
2. You are a PROSPECT being sold to. NEVER:
   - Offer to help the rep improve their sales skills
   - Act as a coach, trainer, or mentor
   - Give the rep tips or suggestions on how to sell better
   - Break character to explain what they should have done
   - Say things like "that's a great question" in a coaching way
3. React dynamically using the RESPONSE DEPTH LADDER:
   - FIRST question on any topic → Surface-level answer only (Level 1)
   - Good FOLLOW-UP questions → Reveal more detail (Level 2)
   - Questions about IMPACT/RISK/CONSEQUENCES → Reveal pain points (Level 3)
   - Poor performance or no follow-ups → Stay at surface level
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
10. When viewing screen shares, NEVER ask the rep what THEY are looking for or what THEY want. YOU are the prospect with needs - respond by evaluating if what you SEE addresses YOUR challenges.
11. UNDERSTAND PRODUCTS QUICKLY - You are a ${role}, not a junior employee. When shown a feature, grasp it in 1-2 sentences and move to value/fit questions. Do NOT ask for detailed technical explanations of concepts you would already understand in your role.
12. BE HUMAN - Occasionally go off-topic with personal asides, share brief tangents, and interrupt with clarifying questions during demos. Don't be a robot who only responds when spoken to.
13. HEDGE your answers - Rarely give clean yes/no responses. Use phrases like "possibly," "I'd have to check," "maybe depending on," and "let me think about that."
${hasPastVendorFailures ? `14. SHARE past vendor experiences PROACTIVELY when relevant topics come up. You don't wait to be asked about past failures.` : `14. If you have opinions about past vendor experiences, share them naturally when the topic comes up.`}

=== QUESTIONS YOU MUST NEVER ASK ===
These are examples of questions that LEAD the rep to your pain points - NEVER ask these:
- Questions that reveal your own team's gaps or risks
- Questions that expose your past failures for you
- Questions that reveal your budget approval process
- Questions that tell the rep what your challenges are

Instead, YOU should only ask about THEIR product/company:
- "How long does implementation typically take?"
- "What's your pricing structure?"
- "Who else in ${industry} uses this?"
- "What makes you different from [competitor]?"`;

  return section;
}

/**
 * Orchestrator: assembles the full system prompt from composable sections.
 */
function buildPersonaSystemPrompt(persona: Persona, sessionType: string, scenarioPrompt?: string, screenShareEnabled?: boolean): string {
  return [
    buildRoleIdentitySection(persona),
    buildDiscBehaviorSection(persona),
    buildOpeningMoodSection(persona.communication_style || {}),
    buildCommunicationStyleSection(persona.communication_style || {}),
    buildResponseDepthSection(),
    buildGuardModeSection(),
    buildPainPointRevealSection(persona),
    buildProductUnderstandingSection(persona),
    buildConversationBehaviorsSection(persona),
    buildTechnicalEnvironmentSection(persona),
    buildObjectionsAndPainPointsSection(persona),
    buildGradingCriteriaSection(persona),
    buildSessionTypeSection(sessionType, screenShareEnabled ?? false, scenarioPrompt),
    buildVisionSection(screenShareEnabled ?? false),
    buildAbsoluteRulesSection(persona),
  ].filter(Boolean).join('\n\n');
}

// ─── Main Handler ────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

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
      // ── Rate limit check ──────────────────────────────────────────────
      const rateLimit = checkSessionRateLimit(user.id);
      if (!rateLimit.allowed) {
        console.log(`Rate limit exceeded for user ${user.id} on create-session`);
        return new Response(
          JSON.stringify({
            error: 'Rate limit exceeded. You can create up to 5 sessions per hour.',
            retryAfter: rateLimit.retryAfter,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'Retry-After': String(rateLimit.retryAfter),
            },
          }
        );
      }

      const body: CreateSessionRequest = await req.json();
      const { personaId, sessionType = 'full_sales_call', scenarioPrompt, screenShareEnabled = false } = body;

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

      const selectedVoice = getVoiceForPersona(persona as Persona);
      console.log(`Selected voice for ${persona.disc_profile} profile: ${selectedVoice}`);

      // Fetch product knowledge for full sales calls (needed for demo phase) and legacy demo sessions
      let productKnowledgeContext = '';
      if (sessionType === 'full_sales_call' || sessionType === 'demo') {
        try {
          console.log('Fetching product knowledge for demo session...');
          const { data: productChunks, error: pkError } = await supabaseClient.rpc('find_product_knowledge', {
            query_text: persona.industry ? `${persona.industry} training IT certification` : 'IT training certification Azure',
            match_count: 8,
          });

          if (!pkError && productChunks?.length) {
            productKnowledgeContext = `\n\n=== PRODUCT KNOWLEDGE (What the rep is selling) ===
You are being shown a product demo. Here is information about what they're selling so you can ask relevant questions:

`;
            for (const chunk of productChunks.slice(0, 8)) {
              productKnowledgeContext += `${chunk.chunk_text}\n\n`;
            }
            productKnowledgeContext += `
Use this knowledge to:
- Ask specific questions about features mentioned ("So the Azure Range - does that include Kubernetes or just basic compute?")
- Challenge claims with realistic follow-ups ("You said hands-on practice - how long does each lab take?")
- Connect features to YOUR pain points ("Okay, but how does this solve my single-point-of-failure problem with Marcus?")
- Express skepticism if something sounds too good ("That sounds great on paper, but our team is already stretched thin")

Do NOT:
- Recite this information back to the rep
- Act like you already know about their specific product
- Ask questions you already know the answer to from this context
=== END PRODUCT KNOWLEDGE ===\n`;
            console.log(`Injected ${productChunks.length} product knowledge chunks for demo session`);
          }
        } catch (pkErr) {
          console.warn('Product knowledge fetch warning:', pkErr);
        }
      }

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
            hasProductKnowledge: productKnowledgeContext.length > 0,
          },
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        throw new Error('Failed to create session');
      }

      console.log(`Created session: ${session.id}`);

      const systemPrompt = buildPersonaSystemPrompt(
        persona as Persona,
        sessionType,
        scenarioPrompt,
        screenShareEnabled
      ) + productKnowledgeContext;

      // ── Ephemeral Token ─────────────────────────────────────────────
      // The OpenAI Realtime API `client_secrets` endpoint returns an
      // ephemeral token with a ~60-second TTL.  This token is scoped to
      // a single WebRTC handshake — it can only be used once, and it
      // expires quickly.  The client must begin the WebRTC SDP exchange
      // immediately upon receipt; a 30-second client-side timeout is
      // enforced in RoleplaySession.tsx to surface stale-token errors.
      console.log('Requesting ephemeral token from OpenAI (realtime client_secrets)...');
      const realtimeModel = 'gpt-realtime-mini-2025-12-15';

      const openAIResponse = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!openAIResponse.ok) {
        const errorText = await openAIResponse.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${openAIResponse.status}`);
      }

      const openAIData = await openAIResponse.json();
      const ephemeralToken = openAIData?.value as string | undefined;
      if (!ephemeralToken) {
        console.error('OpenAI response missing ephemeral token:', openAIData);
        throw new Error('OpenAI API error: missing ephemeral token');
      }

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
        ephemeralToken,
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
        realtime: {
          model: realtimeModel,
          voice: selectedVoice,
          instructions: systemPrompt,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } else if (action === 'end-session') {
      const body = await req.json();
      const { sessionId, transcript, durationSeconds, audioRecordingUrl } = body;

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

      // Update session status (include audio_recording_url if provided)
      const updatePayload: Record<string, unknown> = {
        status: 'completed',
        ended_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
      };
      if (audioRecordingUrl) {
        updatePayload.audio_recording_url = audioRecordingUrl;
      }

      const { error: updateError } = await supabaseClient
        .from('roleplay_sessions')
        .update(updatePayload)
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
