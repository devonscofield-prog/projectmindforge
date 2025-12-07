/**
 * Analysis Agents for Call Analysis 2.0
 * 
 * Agent 1: The Clerk - Metadata & Facts extraction
 * Agent 2: The Referee - Behavioral scoring
 * Agent 3: The Auditor - Strategy & MEDDPICC analysis
 */

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// Tool schemas for structured output extraction
const CALL_METADATA_TOOL = {
  type: "function",
  function: {
    name: "extract_call_metadata",
    description: "Extract metadata, participants, topics, and user counts from a sales call transcript",
    parameters: {
      type: "object",
      properties: {
        summary: { type: "string", description: "A concise 2-3 sentence executive summary of the call" },
        topics: { 
          type: "array", 
          items: { type: "string" },
          description: "List of high-level topics discussed (e.g., 'Pricing', 'SSO', 'Phishing')"
        },
        logistics: {
          type: "object",
          properties: {
            platform: { type: "string", description: "Meeting platform if mentioned" },
            duration_minutes: { type: "number", description: "Call duration in minutes" },
            video_on: { type: "boolean", description: "Whether video was on" }
          },
          required: ["duration_minutes", "video_on"]
        },
        participants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              role: { type: "string", description: "Job title or inferred role" },
              is_decision_maker: { type: "boolean" },
              sentiment: { type: "string", enum: ["Positive", "Neutral", "Negative", "Skeptical"] }
            },
            required: ["name", "role", "is_decision_maker", "sentiment"]
          }
        },
        user_counts: {
          type: "object",
          properties: {
            it_users: { type: "number", description: "Number of IT staff mentioned, null if not mentioned" },
            end_users: { type: "number", description: "Number of general employees mentioned, null if not mentioned" },
            source_quote: { type: "string", description: "The exact quote where these numbers were mentioned, null if none" }
          }
        }
      },
      required: ["summary", "topics", "logistics", "participants", "user_counts"]
    }
  }
};

const BEHAVIOR_SCORE_TOOL = {
  type: "function",
  function: {
    name: "score_call_behavior",
    description: "Analyze and score the behavioral dynamics of a sales call",
    parameters: {
      type: "object",
      properties: {
        overall_score: { type: "number", minimum: 0, maximum: 100, description: "Overall behavioral score 0-100" },
        grade: { type: "string", enum: ["Pass", "Fail"], description: "Pass if score >= 60, Fail otherwise" },
        coaching_tip: { type: "string", description: "One high-impact behavioral tip based on the lowest metric" },
        metrics: {
          type: "object",
          properties: {
            patience: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 30, description: "Score 0-30" },
                interruption_count: { type: "number", description: "Number of interruptions detected" },
                status: { type: "string", enum: ["Excellent", "Good", "Fair", "Poor"] }
              },
              required: ["score", "interruption_count", "status"]
            },
            question_quality: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 20, description: "Score 0-20" },
                open_ended_count: { type: "number", description: "Number of open-ended questions" },
                closed_count: { type: "number", description: "Number of closed questions" },
                explanation: { type: "string", description: "Brief note on question types used" },
                open_ended_questions: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "List of actual open-ended questions the rep asked (verbatim from transcript)" 
                },
                closed_questions: { 
                  type: "array", 
                  items: { type: "string" }, 
                  description: "List of actual closed questions the rep asked (verbatim from transcript)" 
                }
              },
              required: ["score", "open_ended_count", "closed_count", "explanation", "open_ended_questions", "closed_questions"]
            },
            monologue: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 20, description: "Score 0-20" },
                longest_turn_word_count: { type: "number", description: "Word count of longest turn" },
                violation_count: { type: "number", description: "Number of turns exceeding ~250 words" }
              },
              required: ["score", "longest_turn_word_count", "violation_count"]
            },
            talk_listen_ratio: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 15, description: "Score 0-15" },
                rep_talk_percentage: { type: "number", description: "Percentage of call the rep spoke" }
              },
              required: ["score", "rep_talk_percentage"]
            },
            next_steps: {
              type: "object",
              properties: {
                score: { type: "number", minimum: 0, maximum: 15, description: "Score 0-15" },
                secured: { type: "boolean", description: "Whether specific next steps were secured" },
                details: { type: "string", description: "The specific next step found, or 'None'" }
              },
              required: ["score", "secured", "details"]
            }
          },
          required: ["patience", "question_quality", "monologue", "talk_listen_ratio", "next_steps"]
        }
      },
      required: ["overall_score", "grade", "coaching_tip", "metrics"]
    }
  }
};

const STRATEGY_AUDIT_TOOL = {
  type: "function",
  function: {
    name: "audit_call_strategy",
    description: "Audit the strategic alignment and identify critical gaps in a sales call",
    parameters: {
      type: "object",
      properties: {
        strategic_threading: {
          type: "object",
          properties: {
            score: { type: "number", minimum: 0, maximum: 100, description: "Strategic alignment score 0-100" },
            grade: { type: "string", enum: ["Pass", "Fail"], description: "Pass if score >= 60" },
            relevance_map: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  pain_identified: { type: "string", description: "The specific need/pain quoted from the prospect" },
                  feature_pitched: { type: "string", description: "The feature the rep pitched in response" },
                  is_relevant: { type: "boolean", description: "Whether the feature maps to the pain" },
                  reasoning: { type: "string", description: "Why this was a strategic match or mismatch" }
                },
                required: ["pain_identified", "feature_pitched", "is_relevant", "reasoning"]
              }
            },
            missed_opportunities: {
              type: "array",
              items: { type: "string" },
              description: "Pains mentioned by prospect that were ignored by the rep"
            }
          },
          required: ["score", "grade", "relevance_map", "missed_opportunities"]
        },
        critical_gaps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              category: { 
                type: "string", 
                enum: ["Budget", "Authority", "Need", "Timeline", "Competition", "Technical"],
                description: "The category of information gap"
              },
              description: { type: "string", description: "Specific description of what is missing in this deal" },
              impact: { 
                type: "string", 
                enum: ["High", "Medium", "Low"],
                description: "How dangerous this gap is to the deal"
              },
              suggested_question: { type: "string", description: "The exact question the rep should ask to close this gap" }
            },
            required: ["category", "description", "impact", "suggested_question"]
          },
          description: "3-5 critical pieces of information blocking the deal"
        }
      },
      required: ["strategic_threading", "critical_gaps"]
    }
  }
};

const CLERK_SYSTEM_PROMPT = `You are 'The Clerk', a strictly factual executive assistant. Your job is to extract participants, logistics, and data from a sales call transcript.

Rules:
- Do not infer sentiment unless explicitly stated or clearly demonstrated through language.
- Extract exact quotes for 'user_counts' if found.
- Identify 'decision_makers' based on job titles or authority demonstrated.
- Summary should be factual, not coaching-oriented.
- If duration is not mentioned, estimate based on transcript length (~150 words per minute).
- If video status is unclear, default to false.
- For participants, include all named individuals with their roles.`;

const REFEREE_SYSTEM_PROMPT = `You are 'The Referee', a behavioral data analyst. Analyze the transcript for conversational dynamics.

Rules:
- **Patience (0-30 pts):** Flag interruptions where a speaker starts before another finishes. Deduct points for each interruption.
- **Monologue (0-20 pts):** Flag any single turn exceeding ~250 words. Deduct points for each violation.
- **Question Quality (0-20 pts):** Use this EXPLICIT formula:
  1. Tag every question as Open (Who/What/Where/When/Why/How) or Closed (Do/Is/Can/Will/Are/Did/Would/Could/Should/Has/Have)
  2. Calculate: totalQuestions = open + closed, openRatio = open / totalQuestions
  3. **Ratio Score (0-12 pts):** openRatio >= 70% = 12, >= 60% = 10, >= 50% = 8, >= 40% = 6, >= 30% = 4, < 30% = 2
  4. **Volume Bonus (0-8 pts):** Reward thorough discovery:
     - 15+ total questions = 8 pts
     - 12-14 questions = 6 pts
     - 9-11 questions = 4 pts
     - 6-8 questions = 2 pts
     - < 6 questions = 0 pts
  5. Final score = Ratio Score + Volume Bonus (cap at 20)
  IMPORTANT: Extract actual verbatim questions from transcript into open_ended_questions and closed_questions arrays.
- **Talk Ratio (0-15 pts):** Score STRICTLY based on rep talk percentage:
  - 40-50%: 15 pts (ideal balance - prospect is talking more)
  - 51-55%: 12 pts
  - 56-60%: 9 pts
  - 61-65%: 6 pts
  - 66-70%: 3 pts
  - 71%+: 0 pts (talking way too much to be effective)
  - <40%: Deduct proportionally (rep may not be engaging enough)
- **Next Steps (0-15 pts):** Look for specific calendar dates, "I will send X" commitments, or scheduled follow-ups.

Scoring:
- Grade is "Pass" if overall_score >= 60, otherwise "Fail".
- coaching_tip should address the lowest-scoring metric with a specific, actionable improvement.`;

const AUDITOR_SYSTEM_PROMPT = `You are a Senior Sales Auditor. Your goal is to measure Deal Health and Strategic Alignment objectively.

**PHASE 1: STRATEGIC THREADING (The Relevance Map)**
1. Extract specific 'Pains/Goals' the Prospect explicitly stated.
2. Extract specific 'Features/Solutions' the Rep pitched.
3. Create a 'Relevance Map' connecting Pains to Features.
   - If a Rep pitches a feature that maps to a pain -> Relevant.
   - If a Rep pitches a feature with NO connection to a stated pain -> Irrelevant (Spray and Pray).
4. Score (0-100) based on the ratio of Relevant vs. Irrelevant pitches.
5. Grade is "Pass" if score >= 60, otherwise "Fail".

**PHASE 2: CRITICAL GAP SCANNER**
Instead of grading a framework, identify the 3-5 most dangerous 'Unknowns' in this deal based on the transcript.

Rules for identifying gaps:
- **Missing Logic**: If they discussed a '2027 contract expiry', a Critical Gap is 'Did not ask about early cancellation terms.'
- **Missing Stakeholders**: If they mentioned a 'Boss' or manager, did we get the Boss's name? Their role in the decision?
- **Missing Budget Info**: If price was discussed, do we know the actual budget range or approval process?
- **Missing Timeline Details**: If a deadline was mentioned, do we know WHY that deadline matters?
- **Missing Competition Intel**: If they're evaluating alternatives, do we know which ones and what they like about them?
- **Missing Technical Requirements**: If they mentioned integrations or requirements, do we have specifics?

Categories: Budget, Authority, Need, Timeline, Competition, Technical
Impact levels: High (deal-blocking), Medium (creates friction), Low (nice to know)

For each gap, provide a specific 'suggested_question' - the exact question the rep should ask to close the gap.`;

export interface CallMetadata {
  summary: string;
  topics: string[];
  logistics: {
    platform?: string;
    duration_minutes: number;
    video_on: boolean;
  };
  participants: Array<{
    name: string;
    role: string;
    is_decision_maker: boolean;
    sentiment: 'Positive' | 'Neutral' | 'Negative' | 'Skeptical';
  }>;
  user_counts: {
    it_users: number | null;
    end_users: number | null;
    source_quote: string | null;
  };
}

export interface BehaviorScore {
  overall_score: number;
  grade: 'Pass' | 'Fail';
  coaching_tip: string;
  metrics: {
    patience: {
      score: number;
      interruption_count: number;
      status: 'Excellent' | 'Good' | 'Fair' | 'Poor';
    };
    question_quality: {
      score: number;
      open_ended_count: number;
      closed_count: number;
      explanation: string;
      open_ended_questions?: string[];
      closed_questions?: string[];
    };
    monologue: {
      score: number;
      longest_turn_word_count: number;
      violation_count: number;
    };
    talk_listen_ratio: {
      score: number;
      rep_talk_percentage: number;
    };
    next_steps: {
      score: number;
      secured: boolean;
      details: string;
    };
  };
}

export interface StrategyAudit {
  strategic_threading: {
    score: number;
    grade: 'Pass' | 'Fail';
    relevance_map: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities: string[];
  };
  critical_gaps: Array<{
    category: 'Budget' | 'Authority' | 'Need' | 'Timeline' | 'Competition' | 'Technical';
    description: string;
    impact: 'High' | 'Medium' | 'Low';
    suggested_question: string;
  }>;
}

interface CallLovableAIOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

async function callLovableAI(
  systemPrompt: string,
  userPrompt: string,
  tool: object,
  toolName: string,
  options: CallLovableAIOptions = {}
): Promise<any> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const {
    model = 'google/gemini-2.5-flash',
    temperature,
    maxTokens = 4096,
  } = options;

  const requestBody: any = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    tools: [tool],
    tool_choice: { type: 'function', function: { name: toolName } },
    max_tokens: maxTokens,
  };

  // Only add temperature if specified (some models don't support it)
  if (temperature !== undefined) {
    requestBody.temperature = temperature;
  }

  const response = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[analysis-agents] AI Gateway error ${response.status}:`, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add funds to continue.');
    }
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== toolName) {
    console.error('[analysis-agents] Unexpected response structure:', JSON.stringify(data));
    throw new Error('Invalid AI response structure');
  }

  try {
    return JSON.parse(toolCall.function.arguments);
  } catch (e) {
    console.error('[analysis-agents] Failed to parse tool arguments:', toolCall.function.arguments);
    throw new Error('Failed to parse AI response');
  }
}

/**
 * Agent 1: The Clerk - Extract metadata and facts from transcript
 */
export async function analyzeCallMetadata(transcript: string): Promise<CallMetadata> {
  console.log('[analyzeCallMetadata] Starting metadata extraction...');
  
  const userPrompt = `Analyze this sales call transcript and extract all relevant metadata:\n\n${transcript}`;
  
  const result = await callLovableAI(
    CLERK_SYSTEM_PROMPT,
    userPrompt,
    CALL_METADATA_TOOL,
    'extract_call_metadata'
  );
  
  console.log('[analyzeCallMetadata] Extraction complete');
  return result as CallMetadata;
}

/**
 * Agent 2: The Referee - Score behavioral dynamics
 */
export async function analyzeCallBehavior(transcript: string): Promise<BehaviorScore> {
  console.log('[analyzeCallBehavior] Starting behavioral analysis...');
  
  const userPrompt = `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${transcript}`;
  
  const result = await callLovableAI(
    REFEREE_SYSTEM_PROMPT,
    userPrompt,
    BEHAVIOR_SCORE_TOOL,
    'score_call_behavior'
  );
  
  console.log('[analyzeCallBehavior] Analysis complete, score:', result.overall_score);
  return result as BehaviorScore;
}

/**
 * Agent 3: The Auditor - Analyze strategic alignment and MEDDPICC
 * Uses gemini-2.5-pro for complex reasoning with low temperature for strict logic
 */
export async function analyzeCallStrategy(transcript: string): Promise<StrategyAudit> {
  console.log('[analyzeCallStrategy] Starting strategy audit with Pro model...');
  
  const userPrompt = `Perform a comprehensive strategic audit of this sales call transcript. Analyze the rep's strategic alignment (pain-to-feature mapping) and MEDDPICC qualification rigor:\n\n${transcript}`;
  
  const result = await callLovableAI(
    AUDITOR_SYSTEM_PROMPT,
    userPrompt,
    STRATEGY_AUDIT_TOOL,
    'audit_call_strategy',
    {
      model: 'google/gemini-2.5-pro',
      temperature: 0.1,
      maxTokens: 8192, // More tokens for complex analysis
    }
  );
  
  console.log('[analyzeCallStrategy] Audit complete, threading score:', result.strategic_threading?.score, ', MEDDPICC score:', result.meddpicc?.overall_score);
  return result as StrategyAudit;
}
