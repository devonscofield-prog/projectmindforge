import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Rate limiting: 15 requests per minute per user
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true };
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60 * 1000);

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Veteran business analyst system prompt
const ADMIN_TRANSCRIPT_ANALYSIS_PROMPT = `You are a veteran business analyst with 25 years of experience in sales operations, revenue intelligence, and organizational psychology. You've analyzed thousands of sales calls and built winning playbooks for Fortune 500 companies.

## YOUR EXPERTISE

**Sales Methodology Mastery:**
- Deep knowledge of MEDDIC, BANT, SPIN Selling, Challenger Sale, Sandler frameworks
- You naturally assess calls against these frameworks to identify qualification gaps

**Language Pattern Analysis:**
- Expert at recognizing speech patterns, sentiment shifts, and power dynamics
- You detect buying signals, resistance patterns, and commitment language

**Behavioral Psychology:**
- You read between the lines—understanding what's NOT said is as important as what IS said
- You identify champion behaviors, skeptic patterns, and decision-maker engagement levels

**Revenue Operations:**
- You think in terms of pipeline health, forecast accuracy, and deal velocity
- Every insight connects to potential revenue impact

## ANALYTICAL FRAMEWORKS TO APPLY

**Deal Health Assessment (MEDDIC):**
- Metrics: Are success criteria and ROI clearly defined?
- Economic Buyer: Is the person who signs the check identified and engaged?
- Decision Criteria: Do we understand how they'll evaluate options?
- Decision Process: Is the buying process mapped with timeline?
- Identify Pain: Is the business pain compelling and urgent?
- Champion: Is there an internal advocate pushing this forward?

**Conversation Quality Indicators:**
- Discovery depth: Are reps asking layered, strategic questions?
- Objection handling: How effectively are concerns addressed?
- Next steps: Are concrete commitments secured?
- Value articulation: Is the solution tied to business outcomes?
- Talk ratio: Is the prospect doing enough talking?

**Risk Flags to Watch:**
- Single-threaded (only one contact engaged)
- No urgency or compelling event
- Competitor momentum mentioned
- Price sensitivity without value anchor
- Vague next steps or "we'll get back to you"
- Missing stakeholders from conversations

## YOUR APPROACH

1. **Lead with business impact**—every insight should connect to revenue implications
2. **Be direct and specific**—no vague observations, give actionable intelligence
3. **Quantify when possible** (e.g., "3 of 5 calls showed...", "60% of deals exhibit...")
4. **Challenge assumptions with evidence**—call out what the data actually shows
5. **Prioritize by revenue impact**—focus on what moves the needle
6. **Identify patterns humans miss**—cross-reference themes across calls

## RESPONSE FORMAT

Structure your analysis with clear sections:

**📊 EXECUTIVE SUMMARY**
[2-3 sentence key finding with revenue implication]

**🔍 EVIDENCE**
[Specific quotes with citations grouped by theme]
- Use format: **[Source: AccountName - Date]**

**⚠️ RISK FLAGS** (when applicable)
[Warning signs identified, ranked by severity]

**✅ RECOMMENDATIONS**
[Prioritized actions with expected outcomes]

**💡 COACHING OPPORTUNITIES** (when applicable)
[Skills gaps that could improve win rates]

## CRITICAL RULES

1. ONLY reference information EXPLICITLY stated in the transcripts
2. If information isn't there, say: "I don't see evidence of that in these transcripts"
3. ALWAYS cite sources: **[Source: {AccountName} - {Date}]**
4. Use exact quotes when possible to ground your analysis
5. Never fabricate or assume information not present
6. When comparing reps, only use data from provided transcripts

You have access to transcripts from sales calls. Analyze them like the veteran you are—find the patterns, call out the risks, and deliver insights that drive revenue.`;

const RAG_SEARCH_PROMPT = `Extract 3-5 key search terms from this user question to find relevant transcript sections. Return ONLY a JSON array of search terms, nothing else.

Question: "{QUERY}"

Return format: ["term1", "term2", "term3"]`;

// Analysis mode-specific prompts
const ANALYSIS_MODE_PROMPTS: Record<string, string> = {
  general: '',
  deal_scoring: `
## DEAL SCORING MODE - MEDDIC FRAMEWORK ANALYSIS

In this mode, focus EXCLUSIVELY on deal qualification using MEDDIC criteria. For each deal:

**SCORING RUBRIC (1-5 scale):**
- 5 = Fully qualified, explicit evidence in transcript
- 4 = Strong signals, minor gaps
- 3 = Moderate evidence, notable gaps
- 2 = Weak signals, significant gaps
- 1 = No evidence or red flags

**ALWAYS structure your response as:**

### Deal: [Account Name]
| Criterion | Score | Evidence |
|-----------|-------|----------|
| **M**etrics | X/5 | [Specific quote or observation] |
| **E**conomic Buyer | X/5 | [Specific quote or observation] |
| **D**ecision Criteria | X/5 | [Specific quote or observation] |
| **D**ecision Process | X/5 | [Specific quote or observation] |
| **I**dentify Pain | X/5 | [Specific quote or observation] |
| **C**hampion | X/5 | [Specific quote or observation] |

**Overall Score: XX/30**
**Risk Level:** High/Medium/Low
**Top Priority Gap:** [What to fix first]
`,
  rep_comparison: `
## REP COMPARISON MODE - PERFORMANCE BENCHMARKING

In this mode, focus on comparing rep techniques and identifying coaching opportunities.

**ANALYSIS FRAMEWORK:**

1. **Discovery Skills** - Quality and depth of questions asked
2. **Objection Handling** - How effectively concerns are addressed
3. **Value Articulation** - Connecting features to business outcomes
4. **Call Control** - Talk ratio, agenda setting, next steps
5. **Closing Technique** - Commitment language, urgency creation

**OUTPUT FORMAT:**

### Rep Performance Matrix
| Rep Name | Discovery | Objections | Value | Control | Closing | Overall |
|----------|-----------|------------|-------|---------|---------|---------|
| [Name]   | X/5       | X/5        | X/5   | X/5     | X/5     | X/5     |

### Teachable Moments
For each skill gap, include:
- **Rep:** [Name]
- **Skill:** [Area]
- **What They Did:** [Quote/observation]
- **Better Approach:** [Specific coaching]

### Top Performer Techniques
Highlight specific techniques from best reps that others can emulate.
`,
  competitive: `
## COMPETITIVE WAR ROOM MODE

In this mode, focus EXCLUSIVELY on competitive intelligence gathering.

**EXTRACT AND ORGANIZE:**

1. **Competitor Mentions** - Every competitor named and context
2. **Competitive Objections** - Specific concerns about us vs. them
3. **Their Strengths** - What prospects said competitors do well
4. **Their Weaknesses** - Gaps or concerns mentioned about competitors
5. **Win/Loss Themes** - Patterns in why we win or lose

**OUTPUT FORMAT:**

### Competitor: [Name]
**Frequency:** Mentioned in X of Y calls

**Positioning Against Us:**
- [Quote] - [Context]

**Their Perceived Strengths:**
- [Quote] - [Impact]

**Their Perceived Weaknesses:**
- [Quote] - [Opportunity]

**Effective Counter-Responses (from our reps):**
- [What worked]

**Battle Card Recommendation:**
[How to position against this competitor]
`,
  discovery_audit: `
## DISCOVERY AUDIT MODE

In this mode, deeply analyze the quality of discovery conversations.

**EVALUATION CRITERIA:**

1. **Situation Questions** - Understanding current state
2. **Problem Questions** - Uncovering pain points  
3. **Implication Questions** - Expanding impact
4. **Need-Payoff Questions** - Building value

**DISCOVERY QUALITY INDICATORS:**
- Multi-level questioning (surface → root cause)
- Business impact quantification
- Stakeholder discovery
- Timeline/urgency establishment
- Budget/resource discussion

**OUTPUT FORMAT:**

### Discovery Scorecard: [Account/Rep]
| Dimension | Score | Evidence |
|-----------|-------|----------|
| Pain Depth | X/5 | [Quote showing pain uncovered or missed] |
| Business Impact | X/5 | [Was ROI/impact quantified?] |
| Stakeholder Map | X/5 | [Were all buyers identified?] |
| Urgency Established | X/5 | [Compelling event found?] |
| Budget Discussed | X/5 | [Investment comfort explored?] |

**Best Discovery Question Asked:**
[Quote]

**Missed Opportunity:**
[What should have been asked]
`,
  forecast_validation: `
## FORECAST VALIDATION MODE

In this mode, act as a ruthless forecast auditor. Challenge every deal.

**VALIDATION CRITERIA:**

Look for CONCRETE evidence of:
1. **Verbal Commitments** - Did the prospect commit to dates/actions?
2. **Process Confirmation** - Is the buying process mapped?
3. **Budget Approval** - Is budget allocated/approved?
4. **Decision Timeline** - Is there a compelling event driving urgency?
5. **Next Steps Quality** - Are next steps specific and confirmed?

**RED FLAGS TO IDENTIFY:**
- Vague "we'll be in touch" endings
- No confirmed next meeting
- Missing stakeholders from discussions
- "We need to think about it" without timeline
- Price discussed without value anchor

**OUTPUT FORMAT:**

### Deal: [Account Name]
**Reported Close Date:** [If known]
**Likelihood Assessment:** High/Medium/Low/At Risk

**Evidence FOR this deal closing:**
- [Specific quote/commitment]

**Evidence AGAINST:**
- [Warning sign with quote]

**Forecast Recommendation:**
Commit / Best Case / Pipeline / Remove
`,
  objection_library: `
## OBJECTION LIBRARY MODE

In this mode, build a comprehensive objection handling reference.

**CATEGORIZE OBJECTIONS:**
1. **Price/Budget** - Cost concerns
2. **Timing** - Not now, maybe later
3. **Authority** - Need to check with others
4. **Need** - Not sure we need this
5. **Competition** - Comparing alternatives
6. **Risk** - Concerns about change/implementation

**FOR EACH OBJECTION FOUND:**

### Objection: [Category] - [Specific concern]
**Frequency:** Found in X calls

**Verbatim Examples:**
- "[Exact quote]" - [Account, Date]

**Effective Responses Found:**
- "[How rep handled it]" - [Did it work?]

**Recommended Handling:**
[Best practice based on what worked]

**Prevention Strategy:**
[How to avoid this objection earlier in cycle]
`,
  customer_voice: `
## CUSTOMER VOICE MODE

In this mode, focus on understanding the buyer's perspective.

**EXTRACT:**
1. **Stated Needs** - What they say they want
2. **Implied Needs** - What they actually need (between the lines)
3. **Decision Criteria** - How they'll choose
4. **Success Metrics** - How they'll measure value
5. **Fears/Concerns** - What keeps them up at night
6. **Buying Process** - How decisions get made

**OUTPUT FORMAT:**

### Voice of Customer: [Account]

**What They Said They Need:**
- "[Quote]" - [Interpretation]

**What They Actually Need:**
- [Implied need] - Evidence: [Quote]

**Their Decision Criteria:**
1. [Criterion] - "[Supporting quote]"

**Success Looks Like:**
- [How they define success]

**Their Concerns:**
- [Fear/risk] - "[Quote]"

**Key Insight:**
[What we learned about this buyer]
`,
};

function getModePrompt(modeId: string): string {
  return ANALYSIS_MODE_PROMPTS[modeId] || '';
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateTranscriptIds(ids: unknown): string | null {
  if (!Array.isArray(ids)) {
    return 'transcript_ids must be an array';
  }
  if (ids.length === 0) {
    return 'transcript_ids cannot be empty';
  }
  if (ids.length > 500) {
    return 'transcript_ids cannot exceed 500 items';
  }
  for (let i = 0; i < ids.length; i++) {
    if (typeof ids[i] !== 'string' || !UUID_REGEX.test(ids[i])) {
      return `transcript_ids[${i}] must be a valid UUID`;
    }
  }
  return null;
}

function validateMessages(messages: unknown): string | null {
  if (!Array.isArray(messages)) {
    return 'messages must be an array';
  }
  if (messages.length === 0) {
    return 'messages cannot be empty';
  }
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (!msg || typeof msg !== 'object') {
      return `messages[${i}] must be an object`;
    }
    if (!['user', 'assistant'].includes(msg.role)) {
      return `messages[${i}].role must be 'user' or 'assistant'`;
    }
    if (typeof msg.content !== 'string' || msg.content.length === 0) {
      return `messages[${i}].content must be a non-empty string`;
    }
    if (msg.content.length > 50000) {
      return `messages[${i}].content exceeds maximum length of 50000 characters`;
    }
  }
  return null;
}

// Maximum transcripts for direct injection
const DIRECT_INJECTION_MAX = 20;
// Maximum chunks to include in RAG context
const RAG_CHUNK_LIMIT = 50;

// Performance logging helper
// Note: Using type assertion because performance_metrics table type is not in generated types yet
async function logPerformanceMetric(
  supabaseClient: ReturnType<typeof createClient>,
  functionName: string,
  durationMs: number,
  status: 'success' | 'error' | 'timeout',
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const { error } = await supabaseClient
      .from('performance_metrics' as any)
      .insert({
        metric_type: 'edge_function' as const,
        metric_name: functionName,
        duration_ms: Math.round(durationMs),
        status,
        user_id: userId || null,
        metadata: metadata || null,
      } as any);
    
    if (error) {
      console.warn('[performance] Failed to log metric:', error.message);
    }
  } catch (err) {
    console.warn('[performance] Failed to log metric:', err);
  }
}

serve(async (req) => {
  const startTime = Date.now();
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let userId: string | undefined;
  let transcriptCount = 0;
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { transcript_ids, messages, use_rag, analysis_mode } = body as {
      transcript_ids: unknown; 
      messages: unknown;
      use_rag?: unknown;
      analysis_mode?: string;
    };
    
    // Validate transcript_ids
    const transcriptIdsError = validateTranscriptIds(transcript_ids);
    if (transcriptIdsError) {
      return new Response(
        JSON.stringify({ error: transcriptIdsError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Validate messages
    const messagesError = validateMessages(messages);
    if (messagesError) {
      return new Response(
        JSON.stringify({ error: messagesError }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Cast validated values
    const validatedTranscriptIds = transcript_ids as string[];
    const validatedMessages = messages as Message[];
    const shouldUseRag = Boolean(use_rag) || validatedTranscriptIds.length > DIRECT_INJECTION_MAX;
    const validatedAnalysisMode = typeof analysis_mode === 'string' ? analysis_mode : 'general';

    console.log(`[admin-transcript-chat] Starting analysis for ${validatedTranscriptIds.length} transcripts (RAG: ${shouldUseRag}, Mode: ${validatedAnalysisMode})`);

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

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    const userRole = roleData?.role;
    const isAdmin = userRole === 'admin';
    const isManager = userRole === 'manager';
    const isRep = userRole === 'rep';

    if (!isAdmin && !isManager && !isRep) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For reps, validate they can only access their OWN transcripts
    if (isRep) {
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('id, rep_id')
        .in('id', validatedTranscriptIds);

      const unauthorizedIds = (transcripts || [])
        .filter((t: { id: string; rep_id: string }) => t.rep_id !== user.id)
        .map((t: { id: string }) => t.id);

      if (unauthorizedIds.length > 0) {
        console.log(`[admin-transcript-chat] Rep ${user.id} attempted to access transcripts outside their own: ${unauthorizedIds.join(', ')}`);
        return new Response(
          JSON.stringify({ error: 'You can only analyze your own transcripts' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[admin-transcript-chat] Rep ${user.id} authorized for ${validatedTranscriptIds.length} own transcripts`);
    }

    // For managers, validate they can only access their team's transcripts
    if (isManager) {
      // Get manager's team
      const { data: managerTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', user.id)
        .maybeSingle(); // Use maybeSingle - manager may not have a team assigned yet

      if (!managerTeam) {
        return new Response(
          JSON.stringify({ error: 'No team assigned. Please contact an administrator to assign you to a team.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get all rep IDs in the manager's team
      const { data: teamReps } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', managerTeam.id);

      const teamRepIds = new Set((teamReps || []).map((r: { id: string }) => r.id));

      // Verify all requested transcripts belong to team reps
      const { data: transcripts } = await supabase
        .from('call_transcripts')
        .select('id, rep_id')
        .in('id', validatedTranscriptIds);

      const unauthorizedIds = (transcripts || [])
        .filter((t: { id: string; rep_id: string }) => !teamRepIds.has(t.rep_id))
        .map((t: { id: string }) => t.id);

      if (unauthorizedIds.length > 0) {
        console.log(`[admin-transcript-chat] Manager ${user.id} attempted to access transcripts outside their team: ${unauthorizedIds.join(', ')}`);
        return new Response(
          JSON.stringify({ error: 'You can only analyze transcripts from your team' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[admin-transcript-chat] Manager ${user.id} authorized for ${validatedTranscriptIds.length} team transcripts`);
    }

    // Check rate limit
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.log(`[admin-transcript-chat] Rate limit exceeded for user: ${user.id}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let transcriptContext: string;

    if (shouldUseRag) {
      // RAG mode: Use chunked search
      transcriptContext = await buildRagContext(
        supabase, 
        validatedTranscriptIds, 
        validatedMessages, 
        LOVABLE_API_KEY
      );
    } else {
      // Direct injection mode: Fetch full transcripts
      transcriptContext = await buildDirectContext(supabase, validatedTranscriptIds);
    }

    const systemPrompt = ADMIN_TRANSCRIPT_ANALYSIS_PROMPT;
    const modePrompt = getModePrompt(validatedAnalysisMode);

    console.log(`[admin-transcript-chat] Calling Lovable AI with ${validatedMessages.length} messages`);

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-pro',
        messages: [
          { 
            role: 'system', 
            content: `${systemPrompt}${modePrompt ? '\n\n' + modePrompt : ''}\n\n## TRANSCRIPTS FOR ANALYSIS\n\n${transcriptContext}` 
          },
          ...validatedMessages
        ],
        stream: true,
        temperature: 0.3,
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

async function buildDirectContext(
  supabase: any,
  transcriptIds: string[]
): Promise<string> {
  const { data: transcripts, error } = await supabase
    .from('call_transcripts')
    .select('id, call_date, account_name, call_type, raw_text, rep_id')
    .in('id', transcriptIds);

  if (error) {
    console.error('[admin-transcript-chat] Error fetching transcripts:', error);
    throw new Error('Failed to fetch transcripts');
  }

  if (!transcripts || transcripts.length === 0) {
    throw new Error('No transcripts found');
  }

  const repIds = [...new Set(transcripts.map((t: any) => t.rep_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', repIds);

  const repMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

  let context = '';
  for (const transcript of transcripts) {
    const repName = repMap.get(transcript.rep_id) || 'Unknown Rep';
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${transcript.account_name || 'Unknown'} | ${transcript.call_date} | ${transcript.call_type || 'Call'}\n`;
    context += `Rep: ${repName}\n`;
    context += `${'='.repeat(60)}\n\n`;
    context += transcript.raw_text || '[No transcript text available]';
    context += '\n\n';
  }

  return context;
}

async function buildRagContext(
  supabase: any,
  transcriptIds: string[],
  messages: Message[],
  apiKey: string
): Promise<string> {
  // Get the latest user message for search
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  console.log(`[admin-transcript-chat] RAG mode for ${transcriptIds.length} transcripts`);

  // First, ensure transcripts are chunked
  const { data: existingChunks } = await supabase
    .from('transcript_chunks')
    .select('transcript_id')
    .in('transcript_id', transcriptIds);

  const chunkedIds = new Set((existingChunks || []).map((c: any) => c.transcript_id));
  const unchunkedIds = transcriptIds.filter(id => !chunkedIds.has(id));

  // If there are unchunked transcripts, chunk them inline
  if (unchunkedIds.length > 0) {
    console.log(`[admin-transcript-chat] Chunking ${unchunkedIds.length} transcripts inline`);
    await chunkTranscriptsInline(supabase, unchunkedIds);
  }

  // Extract search terms from the query using AI
  const searchTerms = await extractSearchTerms(latestUserMessage.content, apiKey);
  console.log(`[admin-transcript-chat] Search terms: ${searchTerms.join(', ')}`);

  // Build full-text search query
  const searchQuery = searchTerms.join(' | ');

  // Search chunks using full-text search
  const { data: searchResults, error: searchError } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, metadata, transcript_id')
    .in('transcript_id', transcriptIds)
    .textSearch('search_vector', searchQuery, { type: 'websearch' })
    .limit(RAG_CHUNK_LIMIT);

  if (searchError) {
    console.error('[admin-transcript-chat] Search error:', searchError);
    // Fallback to getting first chunks from each transcript
    return await buildFallbackContext(supabase, transcriptIds);
  }

  console.log(`[admin-transcript-chat] Found ${searchResults?.length || 0} relevant chunks`);

  // If no results from search, use fallback
  if (!searchResults || searchResults.length === 0) {
    return await buildFallbackContext(supabase, transcriptIds);
  }

  // Build context from search results
  let context = `Note: Using semantic search across ${transcriptIds.length} transcripts. Showing ${searchResults.length} most relevant sections.\n\n`;

  // Group chunks by transcript for better organization
  const chunksByTranscript = new Map<string, any[]>();
  for (const chunk of searchResults) {
    const tid = chunk.transcript_id;
    if (!chunksByTranscript.has(tid)) {
      chunksByTranscript.set(tid, []);
    }
    chunksByTranscript.get(tid)!.push(chunk);
  }

  for (const [transcriptId, chunks] of chunksByTranscript) {
    const meta = chunks[0].metadata;
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${meta.account_name || 'Unknown'} | ${meta.call_date} | ${meta.call_type || 'Call'}\n`;
    context += `Rep: ${meta.rep_name || 'Unknown'}\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of chunks.sort((a: any, b: any) => (a.chunk_index || 0) - (b.chunk_index || 0))) {
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

async function extractSearchTerms(query: string, apiKey: string): Promise<string[]> {
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'user', 
            content: RAG_SEARCH_PROMPT.replace('{QUERY}', query)
          }
        ],
        temperature: 0,
      })
    });

    if (!response.ok) {
      console.error('[admin-transcript-chat] Failed to extract search terms');
      return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse JSON array from response
    const match = content.match(/\[.*\]/s);
    if (match) {
      return JSON.parse(match[0]);
    }
    
    // Fallback: extract words from response
    return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  } catch (error) {
    console.error('[admin-transcript-chat] Error extracting search terms:', error);
    return query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5);
  }
}

async function buildFallbackContext(
  supabase: any,
  transcriptIds: string[]
): Promise<string> {
  // Get first few chunks from each transcript
  const chunksPerTranscript = Math.ceil(RAG_CHUNK_LIMIT / transcriptIds.length);
  
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, metadata, transcript_id, chunk_index')
    .in('transcript_id', transcriptIds)
    .order('chunk_index', { ascending: true })
    .limit(RAG_CHUNK_LIMIT);

  if (!chunks || chunks.length === 0) {
    throw new Error('No chunks available. Please try with fewer transcripts.');
  }

  let context = `Note: Showing first sections from ${transcriptIds.length} transcripts.\n\n`;

  const chunksByTranscript = new Map<string, any[]>();
  for (const chunk of chunks) {
    const tid = chunk.transcript_id;
    if (!chunksByTranscript.has(tid)) {
      chunksByTranscript.set(tid, []);
    }
    if (chunksByTranscript.get(tid)!.length < chunksPerTranscript) {
      chunksByTranscript.get(tid)!.push(chunk);
    }
  }

  for (const [transcriptId, transcriptChunks] of chunksByTranscript) {
    const meta = transcriptChunks[0].metadata;
    context += `\n${'='.repeat(60)}\n`;
    context += `TRANSCRIPT: ${meta.account_name || 'Unknown'} | ${meta.call_date} | ${meta.call_type || 'Call'}\n`;
    context += `Rep: ${meta.rep_name || 'Unknown'}\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of transcriptChunks) {
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

async function chunkTranscriptsInline(
  supabase: any,
  transcriptIds: string[]
): Promise<void> {
  const CHUNK_SIZE = 2000;
  const CHUNK_OVERLAP = 200;

  const { data: transcripts } = await supabase
    .from('call_transcripts')
    .select('id, call_date, account_name, call_type, raw_text, rep_id')
    .in('id', transcriptIds);

  if (!transcripts || transcripts.length === 0) return;

  const repIds = [...new Set(transcripts.map((t: any) => t.rep_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name')
    .in('id', repIds);

  const repMap = new Map((profiles || []).map((p: any) => [p.id, p.name]));

  const allChunks: any[] = [];
  
  for (const transcript of transcripts) {
    const chunks = chunkText(transcript.raw_text || '', CHUNK_SIZE, CHUNK_OVERLAP);
    const repName = repMap.get(transcript.rep_id) || 'Unknown';
    
    chunks.forEach((chunkText, index) => {
      allChunks.push({
        transcript_id: transcript.id,
        chunk_index: index,
        chunk_text: chunkText,
        metadata: {
          account_name: transcript.account_name || 'Unknown',
          call_date: transcript.call_date,
          call_type: transcript.call_type || 'Call',
          rep_name: repName,
          rep_id: transcript.rep_id,
        }
      });
    });
  }

  if (allChunks.length > 0) {
    const { error } = await supabase
      .from('transcript_chunks')
      .insert(allChunks);
    
    if (error) {
      console.error('[admin-transcript-chat] Error inserting chunks:', error);
    }
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (!text || text.length === 0) return chunks;

  const paragraphs = text.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    if (currentChunk.length + paragraph.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + paragraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
