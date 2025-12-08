/**
 * Agent Registry - Centralized Agent Configuration
 * 
 * All agents are defined here with their schemas, prompts, and options.
 * Adding a new agent = adding one object to this registry.
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import {
  CensusSchema,
  HistorianSchema,
  RefereeSchema,
  InterrogatorSchema,
  StrategistSchema,
  SkepticSchema,
  NegotiatorSchema,
  ProfilerSchema,
  SpySchema,
  CoachSchema,
} from './agent-schemas.ts';
import {
  CENSUS_PROMPT,
  HISTORIAN_PROMPT,
  REFEREE_PROMPT,
  INTERROGATOR_PROMPT,
  STRATEGIST_PROMPT,
  SKEPTIC_PROMPT,
  NEGOTIATOR_PROMPT,
  PROFILER_PROMPT,
  SPY_PROMPT,
  COACH_PROMPT,
} from './agent-prompts.ts';

// ============= AGENT CONFIGURATION TYPE =============

export interface AgentConfig<T extends z.ZodTypeAny = z.ZodTypeAny> {
  id: string;                              // Unique identifier
  name: string;                            // Display name (e.g., "The Census")
  description: string;                     // What this agent does
  schema: T;                               // Zod validation schema
  systemPrompt: string;                    // System prompt for AI
  userPromptTemplate: (transcript: string) => string;  // User prompt generator
  toolName: string;                        // Tool function name
  toolDescription: string;                 // Tool description for AI
  options: {
    model: 'google/gemini-2.5-flash' | 'google/gemini-2.5-pro';
    temperature?: number;
    maxTokens?: number;
  };
  isCritical: boolean;                     // If true, failure stops pipeline
  default: z.infer<T>;                     // Fallback value on failure
  phase: 1 | 2;                            // 1 = parallel, 2 = sequential (after phase 1)
}

// ============= DEFAULT FALLBACK VALUES =============

const DEFAULT_CENSUS = {
  logistics: { duration_minutes: 0, video_on: false },
  participants: [],
  user_counts: { it_users: null, end_users: null, source_quote: null },
};

const DEFAULT_HISTORIAN = {
  summary: 'Summary generation failed',
  key_topics: [],
};

const DEFAULT_REFEREE = {
  overall_score: 0,
  grade: 'Fail' as const,
  metrics: {
    patience: { score: 0, interruption_count: 0, status: 'Poor' as const },
    monologue: { score: 0, longest_turn_word_count: 0, violation_count: 0 },
    talk_listen_ratio: { score: 0, rep_talk_percentage: 0 },
    next_steps: { score: 0, secured: false, details: 'Analysis failed' },
  },
};

const DEFAULT_INTERROGATOR = {
  score: 0,
  explanation: 'Question analysis failed',
  average_question_length: 0,
  average_answer_length: 0,
  high_leverage_count: 0,
  low_leverage_count: 0,
  high_leverage_examples: [],
  low_leverage_examples: [],
  total_sales_questions: 0,
  yield_ratio: 0,
};

const DEFAULT_STRATEGIST = {
  strategic_threading: {
    score: 0,
    grade: 'Fail' as const,
    strategic_summary: 'Strategic analysis failed',
    score_breakdown: {
      high_pains_addressed: 0,
      high_pains_total: 0,
      medium_pains_addressed: 0,
      medium_pains_total: 0,
      spray_and_pray_count: 0,
    },
    relevance_map: [],
    missed_opportunities: [],
  },
};

const DEFAULT_SKEPTIC = {
  critical_gaps: [],
};

const DEFAULT_NEGOTIATOR = {
  score: 100,
  grade: 'Pass' as const,
  objections_detected: [],
};

const DEFAULT_PROFILER = {
  primary_speaker_name: 'Unknown',
  prospect_persona: 'Unknown',
  disc_profile: 'Unknown' as const,
  evidence_quote: 'Insufficient data for profile analysis',
  communication_style: { tone: 'Unknown', preference: 'Unknown' },
  dos_and_donts: { do: [], dont: [] },
  suggested_email_subject: 'Following up on our conversation',
};

const DEFAULT_SPY = {
  competitive_intel: [],
};

const DEFAULT_COACH = {
  overall_grade: 'C' as const,
  executive_summary: 'Coaching synthesis was not completed due to an analysis error.',
  top_3_strengths: [],
  top_3_areas_for_improvement: [],
  primary_focus_area: 'Discovery Depth' as const,
  coaching_prescription: 'Unable to generate coaching prescription.',
  grade_reasoning: 'Analysis incomplete',
};

// ============= AGENT REGISTRY =============

export const AGENT_REGISTRY: AgentConfig[] = [
  // Phase 1 Agents (run in parallel)
  {
    id: 'census',
    name: 'The Census',
    description: 'Extract structured data entities (participants, logistics, user counts)',
    schema: CensusSchema,
    systemPrompt: CENSUS_PROMPT,
    userPromptTemplate: (t) => `Extract structured data entities from this sales call transcript:\n\n${t}`,
    toolName: 'extract_call_census',
    toolDescription: 'Extract structured data entities from a sales call: participants, logistics, and user counts',
    options: { model: 'google/gemini-2.5-flash' },
    isCritical: true,
    default: DEFAULT_CENSUS,
    phase: 1,
  },
  {
    id: 'historian',
    name: 'The Historian',
    description: 'Write executive summary and extract key topics',
    schema: HistorianSchema,
    systemPrompt: HISTORIAN_PROMPT,
    userPromptTemplate: (t) => `Write a high-quality executive summary of this sales call:\n\n${t}`,
    toolName: 'write_call_history',
    toolDescription: 'Write a high-quality executive summary of a sales call',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.4 },
    isCritical: true,
    default: DEFAULT_HISTORIAN,
    phase: 1,
  },
  {
    id: 'referee',
    name: 'The Referee',
    description: 'Score behavioral dynamics (patience, monologue, talk ratio, next steps)',
    schema: RefereeSchema,
    systemPrompt: REFEREE_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${t}`,
    toolName: 'score_call_behavior',
    toolDescription: 'Analyze and score the behavioral dynamics of a sales call',
    options: { model: 'google/gemini-2.5-flash' },
    isCritical: false,
    default: DEFAULT_REFEREE,
    phase: 1,
  },
  {
    id: 'interrogator',
    name: 'The Interrogator',
    description: 'Analyze question leverage and yield ratio',
    schema: InterrogatorSchema,
    systemPrompt: INTERROGATOR_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript for Question/Answer dynamics. Identify the Rep's questions, filter out logistical questions, and calculate the leverage (Yield Ratio) of each valid sales question:\n\n${t}`,
    toolName: 'analyze_question_leverage',
    toolDescription: 'Analyze question/answer dynamics from a sales call transcript',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.2 },
    isCritical: false,
    default: DEFAULT_INTERROGATOR,
    phase: 1,
  },
  {
    id: 'strategist',
    name: 'The Strategist',
    description: 'Map pains to pitches and score strategic alignment',
    schema: StrategistSchema,
    systemPrompt: STRATEGIST_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript for strategic alignment. Map every prospect pain to every rep pitch and score the relevance:\n\n${t}`,
    toolName: 'audit_call_strategy',
    toolDescription: 'Audit the strategic alignment in a sales call - mapping pains to pitches',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.2, maxTokens: 4096 },
    isCritical: false,
    default: DEFAULT_STRATEGIST,
    phase: 1,
  },
  {
    id: 'skeptic',
    name: 'The Skeptic',
    description: 'Identify critical deal gaps and missing information',
    schema: SkepticSchema,
    systemPrompt: SKEPTIC_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript. Find the 3-5 most dangerous UNKNOWNS or MISSING INFORMATION that could block this deal:\n\n${t}`,
    toolName: 'identify_deal_gaps',
    toolDescription: 'Identify critical information gaps blocking a sales deal',
    options: { model: 'google/gemini-2.5-pro', temperature: 0.1, maxTokens: 4096 },
    isCritical: false,
    default: DEFAULT_SKEPTIC,
    phase: 1,
  },
  {
    id: 'negotiator',
    name: 'The Negotiator',
    description: 'Analyze objection handling using LAER framework',
    schema: NegotiatorSchema,
    systemPrompt: NEGOTIATOR_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${t}`,
    toolName: 'analyze_objection_handling',
    toolDescription: 'Analyze how the rep handled objections and pushback during the sales call',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.1, maxTokens: 4096 },
    isCritical: false,
    default: DEFAULT_NEGOTIATOR,
    phase: 1,
  },
  {
    id: 'profiler',
    name: 'The Profiler',
    description: 'Profile prospect psychology and DISC type',
    schema: ProfilerSchema,
    systemPrompt: PROFILER_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript to profile the PROSPECT's communication style and create a behavioral persona. Focus on how THEY speak, respond, and what they seem to value:\n\n${t}`,
    toolName: 'analyze_prospect_psychology',
    toolDescription: 'Analyze the primary decision maker\'s communication style and create a behavioral profile',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.3, maxTokens: 2048 },
    isCritical: false,
    default: DEFAULT_PROFILER,
    phase: 1,
  },
  {
    id: 'spy',
    name: 'The Spy',
    description: 'Extract competitive intelligence and build battlecard',
    schema: SpySchema,
    systemPrompt: SPY_PROMPT,
    userPromptTemplate: (t) => `Analyze this sales call transcript for competitive intelligence. Find ALL mentions of other vendors, tools, or incumbents and build a battlecard:\n\n${t}`,
    toolName: 'analyze_competitors',
    toolDescription: 'Extract competitive intelligence from a sales call transcript',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.2, maxTokens: 4096 },
    isCritical: false,
    default: DEFAULT_SPY,
    phase: 1,
  },
  // Phase 2 Agent (runs after phase 1 completes)
  {
    id: 'coach',
    name: 'The Coach',
    description: 'Synthesize all insights into prioritized coaching plan',
    schema: CoachSchema,
    systemPrompt: COACH_PROMPT,
    userPromptTemplate: (input) => `Based on the following analysis reports from 9 specialized agents, synthesize a coaching plan for the sales rep:\n\n${input}`,
    toolName: 'synthesize_coaching',
    toolDescription: 'Synthesize all analysis into a prioritized coaching plan',
    options: { model: 'google/gemini-2.5-flash', temperature: 0.3, maxTokens: 4096 },
    isCritical: false,
    default: DEFAULT_COACH,
    phase: 2,
  },
];

// ============= HELPER FUNCTIONS =============

/**
 * Get an agent by ID
 */
export function getAgent(id: string): AgentConfig | undefined {
  return AGENT_REGISTRY.find(a => a.id === id);
}

/**
 * Get all Phase 1 agents (parallel execution)
 */
export function getPhase1Agents(): AgentConfig[] {
  return AGENT_REGISTRY.filter(a => a.phase === 1);
}

/**
 * Get all Phase 2 agents (sequential execution)
 */
export function getPhase2Agents(): AgentConfig[] {
  return AGENT_REGISTRY.filter(a => a.phase === 2);
}

/**
 * Get all critical agents (failure stops pipeline)
 */
export function getCriticalAgents(): AgentConfig[] {
  return AGENT_REGISTRY.filter(a => a.isCritical);
}
