import { createClient } from "@supabase/supabase-js";

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

// Batched IN query helper to avoid URL length limits with large ID arrays
// Supabase REST API has ~8KB URL limit; 50 UUIDs per batch stays well under
async function batchedInQuery<T>(
  supabase: any,
  table: string,
  column: string,
  ids: string[],
  selectFields: string,
  batchSize = 50
): Promise<{ data: T[] | null; error: any }> {
  if (ids.length === 0) {
    return { data: [], error: null };
  }

  if (ids.length <= batchSize) {
    // Small enough for single query
    const { data, error } = await supabase
      .from(table)
      .select(selectFields)
      .in(column, ids);
    return { data, error };
  }

  // Split into batches
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  console.log(`[admin-transcript-chat] Batching ${ids.length} IDs into ${batches.length} batches for ${table}.${column}`);

  // Execute batches in parallel (max 5 concurrent to avoid overwhelming DB)
  const results: T[] = [];
  const CONCURRENT_LIMIT = 5;
  
  for (let i = 0; i < batches.length; i += CONCURRENT_LIMIT) {
    const batchPromises = batches.slice(i, i + CONCURRENT_LIMIT).map(batch =>
      supabase.from(table).select(selectFields).in(column, batch)
    );
    
    const batchResults = await Promise.all(batchPromises);
    
    for (const { data, error } of batchResults) {
      if (error) {
        console.error(`[admin-transcript-chat] Batch query error for ${table}:`, error);
        return { data: null, error };
      }
      if (data) results.push(...data);
    }
  }

  return { data: results, error: null };
}

// CORS: Restrict to production domains
function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  
  // Allow custom domain from environment variable
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }
  
  // Allow StormWind domain from environment variable
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`);
    allowedOrigins.push(`https://www.${stormwindDomain}`);
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Veteran business analyst system prompt with RAG V2 awareness
const ADMIN_TRANSCRIPT_ANALYSIS_PROMPT = `You are a veteran business analyst with 25 years of experience in sales operations, revenue intelligence, and organizational psychology. You've analyzed thousands of sales calls and built winning playbooks for Fortune 500 companies.

## YOUR ANALYTICAL SUPERPOWERS

You are analyzing transcripts that have been **semantically indexed** for intelligent retrieval. This gives you capabilities beyond simple text search:

**🔮 Vector Embeddings (Semantic Search):**
Each transcript section has been embedded using AI. The sections you're seeing were selected based on **semantic similarity** to the user's question—the most relevant content appears first, ranked by relevance score.

**🏷️ Named Entity Recognition (NER):**
Transcripts have been processed to extract structured entities:
- **👤 People** — Names of participants, stakeholders, decision-makers mentioned
- **🏢 Organizations** — Companies, departments, teams discussed
- **⚔️ Competitors** — Competing products/vendors explicitly named
- **💰 Money** — Budget figures, pricing, deal values, investment amounts
- **📅 Dates** — Timelines, deadlines, meeting dates, compelling events

**📌 Topic Classification:**
Each section is tagged with sales conversation topics:
\`pricing\`, \`objections\`, \`demo\`, \`next_steps\`, \`discovery\`, \`negotiation\`,
\`technical\`, \`competitor_discussion\`, \`budget\`, \`timeline\`, \`decision_process\`,
\`pain_points\`, \`value_prop\`, \`closing\`

**✅ MEDDPICC Element Tagging:**
Sections are flagged when they contain qualification signals:
\`metrics\`, \`economic_buyer\`, \`decision_criteria\`, \`decision_process\`,
\`paper_process\`, \`identify_pain\`, \`champion\`, \`competition\`

**💡 How to leverage this:**
1. **Trust the relevance ranking** — Content shown first is most semantically relevant to the query
2. **Look for entity annotations** — When sections include [👤 ...] or [⚔️ ...] tags, those entities were extracted
3. **Reference MEDDPICC tags** — Sections tagged with [✅ economic_buyer] contain EB discussions
4. **Cross-reference patterns** — Same entity appearing across multiple calls reveals trends

## YOUR EXPERTISE

**Sales Methodology Mastery:**
- Deep knowledge of MEDDPICC, BANT, SPIN Selling, Challenger Sale, Sandler frameworks
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

**Deal Health Assessment (MEDDPICC):**
- Metrics: Are success criteria and ROI clearly defined?
- Economic Buyer: Is the person who signs the check identified and engaged?
- Decision Criteria: Do we understand how they'll evaluate options?
- Decision Process: Is the buying process mapped with timeline?
- Paper Process: Is procurement, legal review, or contract process discussed?
- Identify Pain: Is the business pain compelling and urgent?
- Champion: Is there an internal advocate pushing this forward?
- Competition: Are alternatives, competitors, or "do nothing" options understood?

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
7. **Leverage the extracted entities**—reference specific people, competitors, and money amounts by name

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
7. Reference extracted entities (people, competitors, money) by their actual names when available

You have access to semantically-indexed sales call transcripts. Analyze them like the veteran you are—leverage the structured data, find the patterns humans miss, call out the risks, and deliver insights that drive revenue.`;

// Analysis mode-specific prompts with RAG awareness
const ANALYSIS_MODE_PROMPTS: Record<string, string> = {
  general: `
## GENERAL ANALYSIS MODE

**LEVERAGE YOUR RAG CAPABILITIES:**
- Use extracted entities to build stakeholder maps and competitive landscapes
- Reference MEDDPICC tags to quickly identify qualification discussions
- Note topic distributions to understand conversation focus areas
- Cross-reference people and organizations mentioned across calls
`,
  deal_scoring: `
## DEAL SCORING MODE - MEDDPICC FRAMEWORK ANALYSIS

**LEVERAGE INDEXED DATA:**
- Sections tagged with \`economic_buyer\` contain EB-related discussions
- Sections tagged with \`decision_process\` or \`paper_process\` reveal buying journey
- \`champion\` and \`competition\` tags highlight key qualification signals
- 💰 Money entities reveal budget discussions—look for actual figures
- Look for [✅ metrics] tags to find success criteria discussions

In this mode, focus EXCLUSIVELY on deal qualification using MEDDPICC criteria. For each deal:

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
| **P**aper Process | X/5 | [Specific quote or observation] |
| **I**dentify Pain | X/5 | [Specific quote or observation] |
| **C**hampion | X/5 | [Specific quote or observation] |
| **C**ompetition | X/5 | [Specific quote or observation] |

**Overall Score: XX/40**
**Risk Level:** High/Medium/Low
**Top Priority Gap:** [What to fix first]
`,
  rep_comparison: `
## REP COMPARISON MODE - PERFORMANCE BENCHMARKING

**LEVERAGE INDEXED DATA:**
- Compare topic distributions across reps (who spends more time on discovery vs. demo?)
- Use extracted entities to see which reps uncover more stakeholders
- Look at objection handling sections tagged with \`objections\` topic
- Cross-reference extracted people to see relationship-building patterns

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

**LEVERAGE INDEXED DATA:**
- ⚔️ Competitor entities have been extracted—look for specific company names in the annotations
- Sections tagged with \`competitor_discussion\` are prioritized in your view
- 🏢 Organization entities may reveal additional competitors not explicitly named
- Cross-reference competitor mentions across calls to identify patterns
- Look for 💰 Money entities near competitor mentions for pricing intel

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

**LEVERAGE INDEXED DATA:**
- Sections tagged with \`discovery\` topic focus on qualification questions
- \`pain_points\` and \`identify_pain\` tags reveal pain discovery moments
- 👤 People entities show which stakeholders were identified
- \`budget\` and \`timeline\` topics indicate financial/urgency discovery
- Look for question patterns in the transcript text

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

**LEVERAGE INDEXED DATA:**
- \`next_steps\` and \`closing\` topics show commitment language
- 📅 Date entities reveal mentioned timelines and deadlines
- \`decision_process\` tags show buying journey discussions
- Look for 💰 Money entities to validate budget discussions
- \`timeline\` topic sections contain urgency signals

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

**LEVERAGE INDEXED DATA:**
- Sections tagged with \`objections\` topic are prioritized
- \`pricing\` and \`negotiation\` topics reveal price-related pushback
- ⚔️ Competitor entities help identify competitive objections
- Cross-reference objection patterns across reps to find best responses
- Look for sentiment shifts in the conversation around objection moments

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

**LEVERAGE INDEXED DATA:**
- 👤 People entities identify the prospect voices in the conversation
- \`pain_points\` and \`value_prop\` topics reveal customer priorities
- \`decision_criteria\` and \`decision_process\` tags show buying motivations
- Look for direct prospect quotes (lines starting with "PROSPECT:")
- Cross-reference concerns across calls to find common themes

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
// Maximum chunks to include in RAG context - UPDATED TO 100
const RAG_CHUNK_LIMIT = 100;

// Query Intent Classification Schema for Tool Calling
const QUERY_INTENT_SCHEMA = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
      description: "Key search terms extracted from the query"
    },
    entities: {
      type: "object",
      properties: {
        people: { type: "array", items: { type: "string" } },
        organizations: { type: "array", items: { type: "string" } },
        competitors: { type: "array", items: { type: "string" } }
      },
      description: "Named entities to search for"
    },
    topics: {
      type: "array",
      items: {
        type: "string",
        enum: ["pricing", "objections", "demo", "next_steps", "discovery", "negotiation",
               "technical", "competitor_discussion", "budget", "timeline", "decision_process",
               "pain_points", "value_prop", "closing"]
      },
      description: "Sales conversation topics relevant to the query"
    },
    meddpicc_elements: {
      type: "array",
      items: {
        type: "string",
        enum: ["metrics", "economic_buyer", "decision_criteria", "decision_process",
               "paper_process", "identify_pain", "champion", "competition"]
      },
      description: "MEDDPICC elements relevant to the query"
    }
  },
  required: ["keywords", "entities", "topics", "meddpicc_elements"]
};

interface QueryIntent {
  keywords: string[];
  entities: {
    people?: string[];
    organizations?: string[];
    competitors?: string[];
  };
  topics: string[];
  meddpicc_elements: string[];
}

// Generate embedding using OpenAI API (text-embedding-3-small, 1536 dimensions)
// Must match the document embeddings in chunk-transcripts
async function generateQueryEmbedding(text: string, openaiApiKey: string): Promise<string> {
  try {
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.slice(0, 8000) // Limit input length
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[admin-transcript-chat] OpenAI Embedding API error:', response.status, errorText);
      throw new Error(`OpenAI Embedding API error: ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;
    if (!embedding || !Array.isArray(embedding)) {
      throw new Error('Invalid embedding response from OpenAI');
    }
    // Format as PostgreSQL array string: [0.123, -0.456, ...]
    return `[${embedding.join(',')}]`;
  } catch (error) {
    console.error('[admin-transcript-chat] Query embedding generation failed:', error);
    throw error;
  }
}

// Classify query intent using Lovable AI Gateway with tool calling
async function classifyQueryIntent(query: string, apiKey: string): Promise<QueryIntent> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Analyze this sales transcript analysis query and extract search parameters for finding relevant transcript sections:

"${query}"

Extract:
- keywords: Key search terms
- entities: People, organizations, competitors mentioned
- topics: Relevant sales conversation topics
- meddpicc_elements: MEDDPICC framework elements being asked about`
        }],
        tools: [{
          type: 'function',
          function: {
            name: 'classify_query',
            description: 'Extract search parameters from user query for transcript search',
            parameters: QUERY_INTENT_SCHEMA
          }
        }],
        tool_choice: { type: 'function', function: { name: 'classify_query' } }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    console.log(`[admin-transcript-chat] Intent classification completed in ${Date.now() - startTime}ms`);

    if (!response.ok) {
      console.error('[admin-transcript-chat] Intent classification failed:', response.status);
      return {
        keywords: query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5),
        entities: {},
        topics: [],
        meddpicc_elements: []
      };
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.warn('[admin-transcript-chat] No tool call in intent response, using defaults');
      return {
        keywords: query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5),
        entities: {},
        topics: [],
        meddpicc_elements: []
      };
    }

    const args = JSON.parse(toolCall.function.arguments);
    return {
      keywords: args.keywords || [],
      entities: args.entities || {},
      topics: args.topics || [],
      meddpicc_elements: args.meddpicc_elements || []
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error('[admin-transcript-chat] Intent classification timed out after 15s');
    } else {
      console.error('[admin-transcript-chat] Error classifying query intent:', error);
    }
    return {
      keywords: query.toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 5),
      entities: {},
      topics: [],
      meddpicc_elements: []
    };
  }
}

Deno.serve(async (req) => {
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
      const { data: managerTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', user.id)
        .maybeSingle();

      if (!managerTeam) {
        return new Response(
          JSON.stringify({ error: 'No team assigned. Please contact an administrator to assign you to a team.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: teamReps } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', managerTeam.id);

      const teamRepIds = new Set((teamReps || []).map((r: { id: string }) => r.id));

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

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    let transcriptContext: string;
    let usedDirectFallback = false;

    if (shouldUseRag) {
      // RAG V2 mode: Use hybrid search
      try {
        transcriptContext = await buildRagContext(
          supabase, 
          validatedTranscriptIds, 
          validatedMessages, 
          LOVABLE_API_KEY,
          OPENAI_API_KEY
        );
      } catch (ragError) {
        // If RAG fails and we have 20 or fewer transcripts, fall back to direct mode
        if (validatedTranscriptIds.length <= DIRECT_INJECTION_MAX) {
          console.log(`[admin-transcript-chat] RAG failed, falling back to direct mode for ${validatedTranscriptIds.length} transcripts`);
          transcriptContext = await buildDirectContext(supabase, validatedTranscriptIds);
          usedDirectFallback = true;
        } else {
          // Too many transcripts for direct fallback
          console.error(`[admin-transcript-chat] RAG failed and selection too large for direct fallback:`, ragError);
          return new Response(
            JSON.stringify({ 
              error: 'Unable to process transcripts. Try selecting 20 or fewer calls, or use the Pre-Index button to prepare transcripts for analysis.' 
            }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      // Direct injection mode: Fetch full transcripts
      transcriptContext = await buildDirectContext(supabase, validatedTranscriptIds);
    }

    if (usedDirectFallback) {
      console.log(`[admin-transcript-chat] Using direct fallback mode`);
    }

    const systemPrompt = ADMIN_TRANSCRIPT_ANALYSIS_PROMPT;
    const modePrompt = getModePrompt(validatedAnalysisMode);

    console.log(`[admin-transcript-chat] Context built (${transcriptContext.length} chars). Calling Lovable AI with ${validatedMessages.length} messages`);

    // Main AI call with 60 second timeout
    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 60000);
    
    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-pro-preview',
          messages: [
            { 
              role: 'system', 
              content: `${systemPrompt}${modePrompt ? '\n\n' + modePrompt : ''}\n\n## TRANSCRIPTS FOR ANALYSIS\n\n${transcriptContext}` 
            },
            ...validatedMessages
          ],
          stream: true,
          temperature: 0.3,
        }),
        signal: aiController.signal
      });
      
      clearTimeout(aiTimeoutId);
      console.log(`[admin-transcript-chat] AI Gateway responded with status ${aiResponse.status} in ${Date.now() - startTime}ms`);
    } catch (fetchError) {
      clearTimeout(aiTimeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[admin-transcript-chat] AI Gateway timed out after 60s (total time: ${Date.now() - startTime}ms)`);
        return new Response(
          JSON.stringify({ error: 'Analysis timed out. Try selecting fewer transcripts or using a simpler question.' }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw fetchError;
    }

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

    console.log(`[admin-transcript-chat] Streaming response to client (total time: ${Date.now() - startTime}ms)`);
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

// RAG V2: Build context using hybrid search with embeddings, FTS, and entity matching
async function buildRagContext(
  supabase: any,
  transcriptIds: string[],
  messages: Message[],
  apiKey: string,
  openaiApiKey: string
): Promise<string> {
  const latestUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!latestUserMessage) {
    throw new Error('No user message found');
  }

  console.log(`[admin-transcript-chat] RAG V2 mode for ${transcriptIds.length} transcripts`);

  // First, ensure transcripts are chunked
  // Use batched query to avoid URL length limits with large transcript selections
  const { data: existingChunks, error: chunksError } = await batchedInQuery<{ transcript_id: string }>(
    supabase,
    'transcript_chunks',
    'transcript_id',
    transcriptIds,
    'transcript_id',
    50
  );

  if (chunksError) {
    console.error('[admin-transcript-chat] Error fetching chunk status:', chunksError);
    throw new Error(`Failed to check chunk status: ${chunksError.message}`);
  }

  const chunkedIds = new Set((existingChunks || []).map((c: any) => c.transcript_id));
  const unchunkedIds = transcriptIds.filter(id => !chunkedIds.has(id));

  // If there are unchunked transcripts, chunk them inline
  if (unchunkedIds.length > 0) {
    console.log(`[admin-transcript-chat] Chunking ${unchunkedIds.length} transcripts inline`);
    const chunkingResult = await chunkTranscriptsInline(supabase, unchunkedIds);
    
    if (!chunkingResult.success) {
      console.error(`[admin-transcript-chat] Inline chunking failed: ${chunkingResult.error}`);
      throw new Error(`Failed to index transcripts: ${chunkingResult.error}`);
    }
    
    console.log(`[admin-transcript-chat] Successfully chunked ${chunkingResult.chunksCreated} chunks`);
  }

  // Step 1: Generate query embedding using OpenAI (same model as document embeddings)
  let queryEmbedding: string | null = null;
  try {
    queryEmbedding = await generateQueryEmbedding(latestUserMessage.content, openaiApiKey);
    console.log(`[admin-transcript-chat] Generated query embedding`);
  } catch (embError) {
    console.warn(`[admin-transcript-chat] Query embedding failed, will use FTS only:`, embError);
  }

  // Step 2: Classify query intent
  const intent = await classifyQueryIntent(latestUserMessage.content, apiKey);
  console.log(`[admin-transcript-chat] Query intent: keywords=${intent.keywords.join(',')}, topics=${intent.topics.join(',')}, meddpicc=${intent.meddpicc_elements.join(',')}`);

  // Step 3: Call unified hybrid search RPC
  const searchParams: Record<string, unknown> = {
    filter_transcript_ids: transcriptIds,
    match_count: RAG_CHUNK_LIMIT,
    weight_vector: 0.5,
    weight_fts: 0.3,
    weight_entity: 0.2
  };

  // Add embedding if available
  if (queryEmbedding) {
    searchParams.query_embedding = queryEmbedding;
  }

  // Add FTS query from keywords
  if (intent.keywords.length > 0) {
    searchParams.query_text = intent.keywords.join(' ');
  }

  // Add entity search
  if (Object.keys(intent.entities).length > 0) {
    searchParams.search_entities = intent.entities;
  }

  // Add topic search
  if (intent.topics.length > 0) {
    searchParams.search_topics = intent.topics;
  }

  // Add MEDDPICC search
  if (intent.meddpicc_elements.length > 0) {
    searchParams.search_meddpicc = intent.meddpicc_elements;
  }

  console.log(`[admin-transcript-chat] Calling find_best_chunks RPC with ${Object.keys(searchParams).length} parameters`);
  const findChunksStart = Date.now();

  const { data: searchResults, error: searchError } = await supabase
    .rpc('find_best_chunks', searchParams);
  
  console.log(`[admin-transcript-chat] find_best_chunks completed in ${Date.now() - findChunksStart}ms`);

  if (searchError) {
    console.error('[admin-transcript-chat] Hybrid search error:', searchError);
    // Fallback to getting chunks from each transcript
    return await buildFallbackContext(supabase, transcriptIds);
  }

  console.log(`[admin-transcript-chat] Hybrid search found ${searchResults?.length || 0} relevant chunks`);

  // If no results from search, use fallback
  if (!searchResults || searchResults.length === 0) {
    return await buildFallbackContext(supabase, transcriptIds);
  }

  // Build context header with search metadata
  let context = `📊 **RAG V2 ANALYSIS MODE**
- Analyzing: ${transcriptIds.length} transcripts
- Showing: ${searchResults.length} most relevant sections (ranked by hybrid score)
- Search type: Hybrid (50% semantic similarity, 30% keyword match, 20% entity/topic)
${intent.keywords.length > 0 ? `- Keywords matched: ${intent.keywords.join(', ')}` : ''}
${intent.entities.competitors?.length ? `- Competitors detected: ${intent.entities.competitors.join(', ')}` : ''}
${intent.entities.organizations?.length ? `- Organizations detected: ${intent.entities.organizations.join(', ')}` : ''}
${intent.entities.people?.length ? `- People detected: ${intent.entities.people.join(', ')}` : ''}
${intent.topics.length > 0 ? `- Topics focused: ${intent.topics.join(', ')}` : ''}
${intent.meddpicc_elements.length > 0 ? `- MEDDPICC elements: ${intent.meddpicc_elements.join(', ')}` : ''}

The sections below are ordered by relevance score (highest first). Entity annotations appear when extracted.

`;

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
    context += `TRANSCRIPT: ${meta?.account_name || 'Unknown'} | ${meta?.call_date || 'Unknown'} | ${meta?.call_type || 'Call'}\n`;
    context += `Rep: ${meta?.rep_name || 'Unknown'}\n`;
    context += `[Relevance scores: ${chunks.map((c: any) => c.relevance_score?.toFixed(3)).join(', ')}]\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of chunks.sort((a: any, b: any) => (a.chunk_index || 0) - (b.chunk_index || 0))) {
      // Add entity/topic metadata annotations if available
      const annotations: string[] = [];
      if (chunk.entities?.people?.length) annotations.push(`👤 ${chunk.entities.people.join(', ')}`);
      if (chunk.entities?.organizations?.length) annotations.push(`🏢 ${chunk.entities.organizations.join(', ')}`);
      if (chunk.entities?.competitors?.length) annotations.push(`⚔️ ${chunk.entities.competitors.join(', ')}`);
      if (chunk.entities?.money?.length) annotations.push(`💰 ${chunk.entities.money.join(', ')}`);
      if (chunk.entities?.dates?.length) annotations.push(`📅 ${chunk.entities.dates.join(', ')}`);
      if (chunk.topics?.length) annotations.push(`📌 ${chunk.topics.join(', ')}`);
      if (chunk.meddpicc_elements?.length) annotations.push(`✅ ${chunk.meddpicc_elements.join(', ')}`);
      
      if (annotations.length > 0) {
        context += `[${annotations.join(' | ')}]\n`;
      }
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

async function buildFallbackContext(
  supabase: any,
  transcriptIds: string[]
): Promise<string> {
  // Get first chunks from each transcript, up to RAG_CHUNK_LIMIT (100)
  const chunksPerTranscript = Math.ceil(RAG_CHUNK_LIMIT / transcriptIds.length);
  
  const { data: chunks } = await supabase
    .from('transcript_chunks')
    .select('id, chunk_text, metadata, transcript_id, chunk_index')
    .in('transcript_id', transcriptIds)
    .order('chunk_index', { ascending: true })
    .limit(RAG_CHUNK_LIMIT);

  if (!chunks || chunks.length === 0) {
    throw new Error('No indexed content available for these transcripts');
  }

  let context = `Note: Using fallback mode. Showing first sections from ${transcriptIds.length} transcripts (up to ${RAG_CHUNK_LIMIT} chunks).\n\n`;

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
    context += `TRANSCRIPT: ${meta?.account_name || 'Unknown'} | ${meta?.call_date || 'Unknown'} | ${meta?.call_type || 'Call'}\n`;
    context += `Rep: ${meta?.rep_name || 'Unknown'}\n`;
    context += `${'='.repeat(60)}\n\n`;
    
    for (const chunk of transcriptChunks) {
      context += chunk.chunk_text + '\n\n---\n\n';
    }
  }

  return context;
}

interface ChunkingResult {
  success: boolean;
  chunksCreated: number;
  error?: string;
}

// Inline chunking (legacy - without RAG V2 columns for quick indexing)
async function chunkTranscriptsInline(
  supabase: any,
  transcriptIds: string[]
): Promise<ChunkingResult> {
  const CHUNK_SIZE = 2000;
  const CHUNK_OVERLAP = 200;

  try {
    // Use batched query to avoid URL length limits with large transcript selections
    const { data: transcripts, error: fetchError } = await batchedInQuery<{
      id: string;
      call_date: string;
      account_name: string;
      call_type: string;
      raw_text: string;
      rep_id: string;
    }>(
      supabase,
      'call_transcripts',
      'id',
      transcriptIds,
      'id, call_date, account_name, call_type, raw_text, rep_id',
      50
    );

    if (fetchError) {
      return { success: false, chunksCreated: 0, error: `Failed to fetch transcripts: ${fetchError.message}` };
    }

    if (!transcripts || transcripts.length === 0) {
      return { success: true, chunksCreated: 0 };
    }

    const repIds = [...new Set(transcripts.map((t: any) => t.rep_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name')
      .in('id', repIds);

    const repMap = new Map<string, string>((profiles || []).map((p: { id: string; name: string }) => [p.id, p.name]));

    interface InlineChunk {
      transcript_id: string;
      chunk_index: number;
      chunk_text: string;
      extraction_status: string;
      metadata: {
        account_name: string;
        call_date: string;
        call_type: string;
        rep_name: string;
        rep_id: string;
      };
    }

    const allChunks: InlineChunk[] = [];
    for (const transcript of transcripts) {
      const chunks = chunkText(transcript.raw_text || '', CHUNK_SIZE, CHUNK_OVERLAP);
      const repName: string = repMap.get(transcript.rep_id) || 'Unknown';
      
      chunks.forEach((chunkTextContent, index) => {
        allChunks.push({
          transcript_id: transcript.id,
          chunk_index: index,
          chunk_text: chunkTextContent,
          extraction_status: 'pending', // Mark as pending for later backfill
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

    if (allChunks.length === 0) {
      return { success: true, chunksCreated: 0 };
    }

    // Upsert in batches (idempotent - safe to retry, skips duplicates)
    const BATCH_SIZE = 50;
    let totalProcessed = 0;
    
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE);
      
      const { error } = await supabase
        .from('transcript_chunks')
        .upsert(batch, { 
          onConflict: 'transcript_id,chunk_index', 
          ignoreDuplicates: true 
        });
      
      if (error) {
        console.error('[admin-transcript-chat] Failed to upsert chunks:', error);
        return { 
          success: false, 
          chunksCreated: totalProcessed, 
          error: `Database error: ${error.message}` 
        };
      }
      
      totalProcessed += batch.length;
      console.log(`[admin-transcript-chat] Upserted batch of ${batch.length} chunks (duplicates skipped)`);
    }

    return { success: true, chunksCreated: totalProcessed };
  } catch (error) {
    console.error('[admin-transcript-chat] Unexpected error in chunking:', error);
    return { 
      success: false, 
      chunksCreated: 0, 
      error: error instanceof Error ? error.message : 'Unexpected error' 
    };
  }
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (!text || text.length === 0) return chunks;

  // Speaker-aware splitting
  const speakerPattern = /(?=\n\n(?:REP|PROSPECT):)/gi;
  let sections = text.split(speakerPattern).filter(s => s.trim().length > 0);

  // Fall back to paragraph splitting if no speaker markers
  if (sections.length <= 1) {
    sections = text.split(/\n\n+/).filter(s => s.trim().length > 0);
  }

  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + '\n\n' + section;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + section;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length === 1 && chunks[0].length > chunkSize * 1.5) {
    return chunkBySentence(text, chunkSize, overlap);
  }

  return chunks;
}

function chunkBySentence(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let currentChunk = '';

  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + ' ' + sentence;
    } else {
      currentChunk += sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
