/**
 * Analysis Pipeline Orchestrator - P1 Optimized with Speaker Labeling + Call Classification
 * 
 * Performance optimizations (P1):
 * - Phase 0: Speaker Labeler + Sentinel (call classifier) run in parallel
 * - Sentinel provides scoring hints to calibrate downstream agents
 * - Skeptic runs async (non-blocking) at start of Batch 2
 * - Per-agent timeouts with graceful degradation
 * - Reduced batch count from 3 to 2 + async Skeptic
 * 
 * Phase 0: Speaker Labeler + Sentinel (parallel pre-processing)
 * Batch 1: Critical (Census, Historian, Spy)
 * Batch 2: Strategic (Profiler, Strategist, Referee, Interrogator, Negotiator) + Skeptic (async)
 * Phase 2: Coach (synthesis)
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { getAgent, getPhase0Agent, AgentConfig } from './agent-registry.ts';
import { executeAgent, executeAgentWithPrompt, executeCoachWithConsensus, AgentResult, getAgentTimeout } from './agent-factory.ts';
import { hashContent, AgentCacheMap, getCachedAgentResult, setCachedAgentResult } from './cache.ts';
import {
  CensusOutput,
  HistorianOutput,
  RefereeOutput,
  InterrogatorOutput,
  StrategistOutput,
  SkepticOutput,
  NegotiatorOutput,
  ProfilerOutput,
  SpyOutput,
  AuditorOutput,
  CoachOutput,
  SpeakerLabelerOutput,
  SentinelOutput,
  ScribeOutput,
  CallMetadata,
  MergedBehaviorScore,
  StrategyAudit,
} from './agent-schemas.ts';
import { SPEAKER_LABELER_PROMPT } from './agent-prompts.ts';
import { sanitizeUserContent } from './sanitize.ts';

// ============= SPEAKER CONTEXT TYPE =============

export interface SpeakerContext {
  repName: string;
  stakeholderName: string;
  accountName: string;
  managerOnCall: boolean;
  additionalSpeakers: string[];
}

// ============= ACCOUNT HISTORY CONTEXT TYPE =============

export interface AccountHistoryContext {
  previousCalls: Array<{
    call_date: string;
    call_type: string | null;
    summary: string;
    critical_gaps: Array<{ category: string; description: string; impact: string }>;
    next_steps_secured?: boolean;
    next_steps_details?: string;
    deal_heat_score?: number;
  }>;
  totalPreviousCalls: number;
  accountName: string;
}

// ============= CALL CLASSIFICATION TYPE =============

export interface CallClassification {
  detected_call_type: SentinelOutput['detected_call_type'];
  confidence: SentinelOutput['confidence'];
  detection_signals: string[];
  scoring_hints: SentinelOutput['scoring_hints'];
}

// ============= PIPELINE RESULT TYPE =============

export interface PipelineResult {
  metadata: CallMetadata;
  behavior: MergedBehaviorScore;
  strategy: StrategyAudit;
  psychology: ProfilerOutput;
  pricing: AuditorOutput;
  coaching: CoachOutput;
  salesAssets: ScribeOutput;
  callClassification?: CallClassification;
  warnings: string[];
  phase1DurationMs: number;
  phase2DurationMs: number;
  totalDurationMs: number;
}

// Delay between batches to allow rate limits to recover
const BATCH_DELAY_MS = 300;

// Phase 0 time budget - extended for maximum quality
const PHASE0_BUDGET_MS = 60000;

// No character limit for speaker labeling - process all transcripts regardless of length
const MAX_TRANSCRIPT_LENGTH_FOR_LABELING = Infinity;

// ============= ACCOUNT HISTORY HELPERS =============

function buildAccountHistorySection(history: AccountHistoryContext): string {
  if (!history.previousCalls.length) return '';
  
  const sections = history.previousCalls.map((call, i) => {
    const ordinal = i === 0 ? 'Most recent' : i === 1 ? 'Second most recent' : 'Third most recent';
    return `
**${ordinal} call (${call.call_date}${call.call_type ? `, ${call.call_type}` : ''}):**
- Summary: ${call.summary}
${call.critical_gaps?.length ? `- Unresolved gaps: ${call.critical_gaps.map(g => `${g.category}: ${g.description}`).join('; ')}` : ''}
${call.next_steps_details ? `- Promised next steps: ${call.next_steps_details}` : ''}
${call.deal_heat_score ? `- Deal heat at that time: ${call.deal_heat_score}/100` : ''}`;
  }).join('\n');
  
  return `
--- ACCOUNT HISTORY (${history.totalPreviousCalls} previous calls with ${history.accountName}) ---
${sections}

Use this context to:
1. Check if previously identified gaps were addressed in this call
2. Verify if promised next steps were mentioned/completed
3. Score whether the deal is progressing or regressing
4. Be lenient on discovery if pain points are already established from prior calls
`;
}

// ============= CONTEXT-AWARE PROMPT BUILDERS =============

function buildCensusPrompt(
  transcript: string,
  callType?: string
): string {
  const basePrompt = `Extract structured data entities from this sales call transcript:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callType) {
    if (callType === 'group_demo') {
      contextParts.push(`NOTE: This is a GROUP DEMO with multiple participants. Identify ALL attendees and their roles. Flag the PRIMARY decision maker among the group.`);
    } else if (callType === 'executive_alignment') {
      contextParts.push(`NOTE: This is an EXECUTIVE ALIGNMENT call. The primary prospect is likely a C-level or VP. Focus on capturing their exact title and sentiment carefully.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. User counts may reference previous discussions. Look for updates like "we've grown to..." or "now we have..."`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. The primary contact may be a technical stakeholder (IT Director, Architect). Capture their technical role accurately.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

function buildProfilerPrompt(
  transcript: string, 
  primarySpeakerName?: string,
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript to profile the PROSPECT's communication style and create a behavioral persona. Focus on how THEY speak, respond, and what they seem to value:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (primarySpeakerName) {
    contextParts.push(`Focus your analysis specifically on the speech patterns of ${primarySpeakerName}.`);
  }
  
  if (callType) {
    if (callType === 'group_demo') {
      contextParts.push(`NOTE: This is a GROUP DEMO with multiple prospect participants. Focus on the PRIMARY decision maker's profile, not an average of all attendees.`);
    } else if (callType === 'executive_alignment') {
      contextParts.push(`NOTE: This is an EXECUTIVE ALIGNMENT call. The prospect is likely a C-level or VP. Look for High-D (direct, results-focused) or High-C (data-driven) patterns typical of executives.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

function buildStrategistPrompt(
  transcript: string, 
  callSummary?: string, 
  callType?: string,
  scoringHints?: SentinelOutput['scoring_hints'],
  accountHistory?: AccountHistoryContext
): string {
  const basePrompt = `Analyze this sales call transcript for strategic alignment. Map every prospect pain to every rep pitch and score the relevance:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callSummary) {
    contextParts.push(`Call Summary: ${callSummary}`);
  }
  
  // Inject account history context for known pains
  if (accountHistory?.previousCalls?.length) {
    contextParts.push(buildAccountHistorySection(accountHistory));
    contextParts.push(`IMPORTANT: This is a FOLLOW-UP call with this account. Pain points from previous conversations should be considered as already-established context. Be lenient on discovery scoring since pain was already uncovered previously.`);
  }
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    // Adjust expectations based on call type
    if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. These calls often have fewer new pains to uncover - focus on relationship continuity and progress on known issues.`);
    } else if (callType === 'group_demo') {
      contextParts.push(`NOTE: This is a GROUP DEMO. Focus on how well the rep tailored the presentation to the audience's stated needs.`);
    } else if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION call. Strategic alignment should focus on addressing price objections and confirming value fit to justify investment.`);
    } else if (callType === 'executive_alignment') {
      contextParts.push(`NOTE: This is an EXECUTIVE ALIGNMENT call. Focus on high-level business value mapping, not tactical feature discussions.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Expect heavy feature discussion - focus on whether technical concerns map to previously identified business needs.`);
    }
  }
  
  if (scoringHints?.discovery_expectation === 'none' || scoringHints?.discovery_expectation === 'light') {
    contextParts.push(`IMPORTANT: This call type has ${scoringHints.discovery_expectation} discovery expectation. Don't penalize for lack of new pain discovery if existing pains are being addressed.`);
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

function buildBehaviorPrompt(
  transcript: string, 
  callSummary?: string, 
  scoringHints?: SentinelOutput['scoring_hints'],
  callType?: string,
  accountHistory?: AccountHistoryContext
): string {
  const basePrompt = `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callSummary) {
    contextParts.push(`Call Summary: ${callSummary}`);
  }
  
  // Inject account history context for leniency on discovery
  if (accountHistory?.previousCalls?.length) {
    contextParts.push(`IMPORTANT: This is a FOLLOW-UP call with ${accountHistory.accountName} (${accountHistory.totalPreviousCalls} previous calls on record). Discovery expectations should be REDUCED since context has already been established in prior conversations.`);
  }
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    if (callType === 'group_demo') {
      contextParts.push(`NOTE: This is a GROUP DEMO. Extended monologues during screen share are EXPECTED and should NOT be penalized.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Rep may need to explain technical details at length - moderate monologue tolerance.`);
    }
  }
  
  // Apply scoring hints from Sentinel
  if (scoringHints) {
    if (scoringHints.monologue_tolerance === 'lenient') {
      contextParts.push(`SCORING CALIBRATION: This call type expects extended monologues (demo/presentation). Be LENIENT on the Monologue score - do not penalize long turns that are appropriate for demos.`);
    } else if (scoringHints.monologue_tolerance === 'moderate') {
      contextParts.push(`SCORING CALIBRATION: This call type has moderate monologue tolerance. Some longer explanations are acceptable.`);
    }
    if (scoringHints.talk_ratio_ideal > 55) {
      contextParts.push(`SCORING CALIBRATION: For this call type, rep talk % of ${scoringHints.talk_ratio_ideal}% is ideal. Adjust Talk Ratio scoring accordingly.`);
    }
    if (scoringHints.discovery_expectation === 'none' || scoringHints.discovery_expectation === 'light') {
      contextParts.push(`SCORING CALIBRATION: This call type has ${scoringHints.discovery_expectation} discovery expectation. Light questioning is acceptable.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

function buildSkepticPrompt(
  transcript: string, 
  missedOpportunities?: Array<{ pain: string; severity: string; suggested_pitch: string }>,
  callType?: string,
  scoringHints?: SentinelOutput['scoring_hints'],
  accountHistory?: AccountHistoryContext
): string {
  const basePrompt = `Analyze this sales call transcript. Find the 3-5 most dangerous UNKNOWNS or MISSING INFORMATION that could block this deal:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (missedOpportunities && missedOpportunities.length > 0) {
    const painsList = missedOpportunities.map(o => `- ${o.pain} (${o.severity})`).join('\n');
    contextParts.push(`The rep already missed these specific pains:\n${painsList}\n\nFocus your gap analysis on UNKNOWNS regarding Budget, Authority, and Timeline.`);
  }
  
  // Inject account history - check if previous gaps were addressed
  if (accountHistory?.previousCalls?.length) {
    const previousGaps = accountHistory.previousCalls[0]?.critical_gaps || [];
    if (previousGaps.length > 0) {
      contextParts.push(`PREVIOUS CALL GAPS (check if addressed in THIS call):
${previousGaps.map(g => `- [${g.impact}] ${g.category}: ${g.description}`).join('\n')}

CRITICAL: Check if these gaps are STILL open or if they were addressed in this conversation. Prioritize identifying gaps that remain unresolved. Also note any NEW gaps that emerged.`);
    }
  }
  
  if (callType) {
    if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. Many gaps may already be known from prior conversations. Focus on NEW unknowns or changes in buyer situation, not rehashing previously covered ground.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Focus on technical gaps (integration, security, compliance) rather than business gaps that were likely covered earlier.`);
    } else if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION. Focus on gaps related to Budget, Authority, and competitive alternatives that could derail the deal at this stage.`);
    }
  }
  
  if (scoringHints?.discovery_expectation === 'none' || scoringHints?.discovery_expectation === 'light') {
    contextParts.push(`IMPORTANT: This call type has ${scoringHints.discovery_expectation} discovery expectation. Identify fewer gaps (2-3 max) unless critical issues are present.`);
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n\n')}`;
  }
  return basePrompt;
}

// ============= SPY PROMPT BUILDER =============

function buildSpyPrompt(transcript: string, callType?: string): string {
  const basePrompt = `Analyze this sales call transcript for competitive intelligence. Extract ONLY training/eLearning competitors and build battlecard:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION call. Training competitors are more likely to be mentioned as pricing benchmarks. Pay special attention to comparative pricing statements about OTHER TRAINING PLATFORMS. Ignore pricing discussions about unrelated tools.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. The prospect may reference many tools for integrations (SSO, HRIS, cloud platforms). These are INTEGRATION PARTNERS, not competitors. Only flag tools that are competing to provide TRAINING CONTENT.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. The prospect may have evaluated NEW training competitors since the last meeting. Look for new eLearning/training platform mentions or changes in evaluation status.`);
    } else if (callType === 'group_demo') {
      contextParts.push(`NOTE: This is a GROUP DEMO with multiple stakeholders. Different attendees may reference different tools from their departments. Only flag tools that are TRAINING PLATFORM competitors, not departmental productivity tools.`);
    } else if (callType === 'executive_alignment') {
      contextParts.push(`NOTE: This is an EXECUTIVE ALIGNMENT call. Executives may mention high-level vendor relationships. Only flag vendors competing for TRAINING BUDGET, not general enterprise software.`);
    }
  }
  
  // Always add reminder about focus
  contextParts.push(`REMINDER: Stormwind sells IT training, security awareness, and eLearning. Only extract competitors selling similar training/learning products. Ignore project management tools, cloud platforms, HR software, and general productivity apps.`);
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n\n')}`;
  }
  return basePrompt;
}

function buildNegotiatorPrompt(
  transcript: string, 
  competitorNames?: string[], 
  pitchedFeatures?: string[],
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (competitorNames && competitorNames.length > 0) {
    contextParts.push(`The prospect is evaluating these competitors: ${competitorNames.join(', ')}.`);
  }
  
  if (pitchedFeatures && pitchedFeatures.length > 0) {
    contextParts.push(`The rep pitched these features: ${pitchedFeatures.join(', ')}.`);
  }
  
  if (callType) {
    if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION call. Expect and prioritize PRICE objections. Score price objection handling with extra weight.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Expect more FEATURE and TECHNICAL objections. Price objections are less common in this context.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. Objections may be about timing, priority shifts, or internal blockers rather than product features.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join(' ')}\n\nCheck if the rep handled objections related to these specific vendors or features.`;
  }
  return basePrompt;
}

// ============= SPEAKER LABELER PROMPT BUILDER =============

function buildSpeakerLabelerPrompt(transcript: string, context: SpeakerContext): string {
  const contextLines: string[] = [];
  
  contextLines.push(`- REP: ${context.repName}`);
  contextLines.push(`- PROSPECT (Primary): ${context.stakeholderName} from ${context.accountName}`);
  
  if (context.managerOnCall) {
    contextLines.push(`- MANAGER: Present on call (supports the REP)`);
  }
  
  if (context.additionalSpeakers.length > 0) {
    context.additionalSpeakers.forEach((name, i) => {
      contextLines.push(`- OTHER ${i + 1}: ${name}`);
    });
  }
  
  const speakerContext = contextLines.join('\n');
  const prompt = SPEAKER_LABELER_PROMPT.replace('{SPEAKER_CONTEXT}', speakerContext);
  
  return `${prompt}\n\n--- TRANSCRIPT TO LABEL ---\n${sanitizeUserContent(transcript)}`;
}

// ============= SMART SKIP DETECTION =============

/**
 * Detect if transcript already has speaker labels (e.g., "Rep:", "Prospect:", "Speaker 1:")
 * If so, skip the Speaker Labeler agent to save time
 */
function hasExistingSpeakerLabels(transcript: string): { hasLabels: boolean; coverage: number; pattern: string | null } {
  const lines = transcript.split('\n').filter(l => l.trim());
  if (lines.length === 0) return { hasLabels: false, coverage: 0, pattern: null };
  
  // Common speaker label patterns
  const patterns = [
    /^(REP|PROSPECT|MANAGER|OTHER):/i,                    // Our format
    /^(Speaker\s*\d+):/i,                                  // Generic numbered
    /^([A-Z][a-z]+\s*[A-Z]?[a-z]*):/,                     // Name format (e.g., "John Smith:")
    /^(\[[^\]]+\]):/,                                      // Bracketed format [John]:
    /^(Host|Guest|Interviewer|Participant\s*\d*):/i,      // Meeting formats
  ];
  
  let labeledCount = 0;
  let matchedPattern: string | null = null;
  
  // Check first 50 lines for label patterns
  const sampleSize = Math.min(50, lines.length);
  for (let i = 0; i < sampleSize; i++) {
    const line = lines[i].trim();
    for (const pattern of patterns) {
      if (pattern.test(line)) {
        labeledCount++;
        if (!matchedPattern) matchedPattern = pattern.source;
        break;
      }
    }
  }
  
  const coverage = labeledCount / sampleSize;
  // Consider transcript pre-labeled if >50% of sample has labels
  return { 
    hasLabels: coverage > 0.5, 
    coverage: Math.round(coverage * 100), 
    pattern: matchedPattern 
  };
}

// ============= CLIENT-SIDE LABEL APPLICATION =============

/**
 * Apply line labels from Speaker Labeler to reconstruct labeled transcript
 * This replaces the previous approach where the AI returned the full labeled text
 */
function applyLabelsToTranscript(
  rawTranscript: string, 
  lineLabels: Array<{ line: number; speaker: string }>
): string {
  const lines = rawTranscript.split('\n');
  const labelMap = new Map<number, string>();
  
  // Build a map for O(1) lookup
  for (const label of lineLabels) {
    labelMap.set(label.line, label.speaker);
  }
  
  // Apply labels to each line (1-indexed in AI output)
  return lines.map((line, idx) => {
    const lineNum = idx + 1;
    const speaker = labelMap.get(lineNum);
    if (speaker && line.trim()) {
      // Only add prefix if line doesn't already have one
      if (/^(REP|PROSPECT|MANAGER|OTHER):/i.test(line.trim())) {
        return line;
      }
      return `${speaker}: ${line}`;
    }
    return line;
  }).join('\n');
}

// ============= RESULT MERGING =============

function mergeCallMetadata(census: CensusOutput, historian: HistorianOutput): CallMetadata {
  return {
    summary: historian.summary,
    topics: historian.key_topics,
    logistics: census.logistics,
    participants: census.participants,
    user_counts: census.user_counts,
  };
}

function mergeBehaviorWithQuestions(
  referee: RefereeOutput, 
  interrogator: InterrogatorOutput
): MergedBehaviorScore {
  const combinedScore = referee.overall_score + interrogator.score;
  return {
    overall_score: combinedScore,
    grade: combinedScore >= 60 ? 'Pass' : 'Fail',
    metrics: {
      ...referee.metrics,
      question_quality: interrogator,
    },
  };
}

function mergeStrategy(
  strategist: StrategistOutput,
  skeptic: SkepticOutput,
  negotiator: NegotiatorOutput,
  spy: SpyOutput,
  agentWarnings?: string[]
): StrategyAudit {
  return {
    strategic_threading: strategist.strategic_threading,
    critical_gaps: skeptic.critical_gaps,
    objection_handling: negotiator,
    competitive_intel: spy.competitive_intel,
    _analysis_warnings: agentWarnings && agentWarnings.length > 0 ? agentWarnings : undefined,
  };
}

// ============= COACHING INPUT BUILDER =============

function buildInterrogatorPrompt(
  transcript: string, 
  scoringHints?: SentinelOutput['scoring_hints'],
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript for question quality and leverage. Focus on the yield ratio - how much information the rep extracted relative to their question investment:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    if (callType === 'full_cycle_sales') {
      contextParts.push(`NOTE: This is a FULL CYCLE SALES call. Strong discovery questioning is critical - score strictly on question depth and yield ratio.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. Questions should focus on clarification and progress updates, not full discovery. Fewer questions are acceptable.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Questions should focus on technical requirements and integration details.`);
    }
  }
  
  if (scoringHints) {
    const expectation = scoringHints.discovery_expectation;
    if (expectation === 'heavy') {
      contextParts.push(`SCORING CALIBRATION: This call type requires HEAVY discovery. Expect many probing questions with high leverage (long detailed answers). Score strictly.`);
    } else if (expectation === 'moderate') {
      contextParts.push(`SCORING CALIBRATION: This call type requires MODERATE discovery. Balance of qualifying questions and other conversation is expected.`);
    } else if (expectation === 'light') {
      contextParts.push(`SCORING CALIBRATION: This call type has LIGHT discovery expectation. A few well-placed questions are sufficient. Don't penalize for fewer questions.`);
    } else if (expectation === 'none') {
      contextParts.push(`SCORING CALIBRATION: This call type has NO discovery expectation (e.g., demo or check-in). Score based on any questions asked, but don't penalize absence of discovery.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

// ============= AUDITOR PROMPT BUILDER =============

function buildAuditorPrompt(
  transcript: string,
  callType?: string,
  painSeverities?: Array<{ pain: string; severity: string }>
): string {
  const basePrompt = `Analyze this sales call transcript for pricing discipline. Find ALL discounts, concessions, or price reductions offered and assess whether the timing was appropriate:\n\n${sanitizeUserContent(transcript)}`;
  
  const contextParts: string[] = [];
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION call. Discounts are EXPECTED as part of the negotiation process. Be more lenient on timing - focus on whether value was established before discounting, not whether discounts were offered.`);
      contextParts.push(`SCORING ADJUSTMENT: For pricing negotiation calls, reduce penalty severity by 50% since discounting is part of the expected flow.`);
    } else if (callType === 'full_cycle_sales') {
      contextParts.push(`NOTE: This is a FULL CYCLE SALES call. Discounts should NOT be offered prematurely. Score strictly on timing and value establishment.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. If pricing was discussed in prior meetings, some flexibility is acceptable. Focus on whether new discounts were volunteered without reason.`);
    }
  }
  
  if (painSeverities && painSeverities.length > 0) {
    const highPains = painSeverities.filter(p => p.severity === 'High').map(p => p.pain);
    if (highPains.length > 0) {
      contextParts.push(`HIGH SEVERITY PAINS IDENTIFIED: ${highPains.join(', ')}. Discounts should only be offered AFTER these critical pains are addressed and value is established.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

// Helper to get stage expectations for grading
function getStageExpectations(callType: string): { summary: string; aGradeCriteria: string; expectedGaps: string[] } {
  switch (callType) {
    case 'discovery':
    case 'full_cycle_sales':
      return {
        summary: 'Early stage - Pain and Fit are primary; Budget/Authority may not be explored yet',
        aGradeCriteria: 'Deep pain uncovery, 3+ high-leverage questions, strong rapport, clear next step',
        expectedGaps: ['Budget', 'Authority']
      };
    case 'reconnect':
      return {
        summary: 'Follow-up stage - Should be advancing the deal and closing previous gaps',
        aGradeCriteria: 'Closes 1+ previous gaps, clear progress, strong next step',
        expectedGaps: []
      };
    case 'group_demo':
    case 'technical_deep_dive':
      return {
        summary: 'Demo stage - Presentation-heavy, extended monologues expected',
        aGradeCriteria: 'Engaged audience, technical questions answered, champion identified, clear next step',
        expectedGaps: ['Authority']
      };
    case 'executive_alignment':
    case 'proposal':
    case 'pricing_negotiation':
      return {
        summary: 'Late stage - Budget and Authority must be confirmed',
        aGradeCriteria: 'All stakeholders aligned, budget confirmed, clear path to signature',
        expectedGaps: []
      };
    default:
      return {
        summary: 'Standard sales call - balanced expectations',
        aGradeCriteria: 'Good discovery, objection handling, clear next step',
        expectedGaps: []
      };
  }
}

// ============= SCRIBE INPUT BUILDER =============

function buildScribeInput(
  historian: HistorianOutput,
  skeptic: SkepticOutput,
  spy: SpyOutput,
  referee: RefereeOutput,
  speakerContext?: SpeakerContext,
  transcriptExcerpt?: string
): string {
  const accountName = speakerContext?.accountName || 'Unknown Account';
  const stakeholderName = speakerContext?.stakeholderName || 'Unknown';
  
  const gapsSection = skeptic.critical_gaps?.length
    ? skeptic.critical_gaps.map(g => `- [${g.impact}] ${g.category}: ${g.description}`).join('\n')
    : '- None identified';
    
  const competitorsSection = spy.competitive_intel?.length
    ? spy.competitive_intel.map(c => `- ${c.competitor_name}: ${c.usage_status}`).join('\n')
    : '- None mentioned';
  
  const nextStepsText = referee.metrics?.next_steps?.secured
    ? `SECURED: ${referee.metrics.next_steps.details || 'Yes'}`
    : `NOT SECURED: ${referee.metrics?.next_steps?.details || 'No clear next steps'}`;
  
  // Include a transcript excerpt for additional context (first 5000 chars)
  const excerpt = transcriptExcerpt
    ? sanitizeUserContent(transcriptExcerpt.substring(0, 5000))
    : '';
  
  return `## CALL ANALYSIS SUMMARY

**Account:** ${accountName}
**Primary Contact:** ${stakeholderName}

**Call Summary:** ${historian.summary}

**Key Topics:** ${historian.key_topics?.join(', ') || 'Not extracted'}

**Next Steps:** ${nextStepsText}

**Critical Gaps:**
${gapsSection}

**Competitors Mentioned:**
${competitorsSection}

---

**Transcript Excerpt (for additional context):**
${excerpt}`;
}

function buildCoachingInputReport(
  metadata: CallMetadata,
  behavior: MergedBehaviorScore,
  questions: InterrogatorOutput,
  strategy: StrategistOutput,
  gaps: SkepticOutput,
  objections: NegotiatorOutput,
  psychology: ProfilerOutput,
  competitors: SpyOutput,
  pricing: AuditorOutput,
  callClassification?: CallClassification,
  accountHistory?: AccountHistoryContext
): string {
  const stageExpectations = getStageExpectations(callClassification?.detected_call_type || 'full_cycle_sales');
  
  // Categorize gaps by severity based on call type
  const expectedGapCategories = stageExpectations.expectedGaps;
  const criticalGaps = gaps.critical_gaps?.filter(g => !expectedGapCategories.includes(g.category)) || [];
  const expectedGaps = gaps.critical_gaps?.filter(g => expectedGapCategories.includes(g.category)) || [];
  
  const callTypeSection = callClassification ? `
### 0. CALL CLASSIFICATION (The Sentinel)
- Detected Type: ${callClassification.detected_call_type}
- Confidence: ${callClassification.confidence}
- Detection Signals: ${callClassification.detection_signals.join(', ') || 'None'}
- Scoring Context:
  - Discovery Expectation: ${callClassification.scoring_hints.discovery_expectation}
  - Monologue Tolerance: ${callClassification.scoring_hints.monologue_tolerance}
  - Ideal Talk Ratio: ${callClassification.scoring_hints.talk_ratio_ideal}%

### GRADING CONTEXT (CRITICAL - READ THIS FIRST)
- **Call Type:** ${callClassification.detected_call_type}
- **Stage Expectations:** ${stageExpectations.summary}
- **A-Grade Criteria for this call type:** ${stageExpectations.aGradeCriteria}
- **Gaps to EXCUSE (normal for this stage):** ${expectedGapCategories.length > 0 ? expectedGapCategories.join(', ') : 'None - all gaps should be addressed'}
- **Critical Gaps (should penalize):** ${criticalGaps.length > 0 ? criticalGaps.map(g => g.category).join(', ') : 'None detected'}
- **Expected Gaps (do NOT penalize heavily):** ${expectedGaps.length > 0 ? expectedGaps.map(g => g.category).join(', ') : 'None'}

**IMPORTANT**: This is a "${callClassification.detected_call_type}" call. Grade according to the appropriate rubric for this call type. Do NOT apply proposal-stage criteria to a discovery call.
` : '';

  // Build account history section for Coach
  const accountHistorySection = accountHistory?.previousCalls?.length ? `
### 10. ACCOUNT HISTORY CONTEXT
${buildAccountHistorySection(accountHistory)}

**COACHING INSTRUCTION**: This is a FOLLOW-UP call. When coaching:
1. Note if previous GAPS were addressed in this call
2. Check if PROMISED NEXT STEPS from the last call were mentioned
3. Assess deal MOMENTUM (is this deal progressing or stalling?)
4. Be lenient on discovery - pain context may already be established
5. Populate the 'deal_progression' object with your assessment
` : '';

  const pricingSection = `
### 9. PRICING DISCIPLINE (The Auditor)
- Score: ${pricing.pricing_score}/100 (${pricing.grade})
- Summary: ${pricing.summary}
${pricing.discounts_offered?.length > 0 ? pricing.discounts_offered.map(d => `- [${d.timing_assessment}] ${d.type}: ${d.discount_value} | ${d.value_established_before ? '✓ Value first' : '✗ No value'} | ${d.prospect_requested ? '✓ Requested' : '✗ Volunteered'} | ${d.coaching_note}`).join('\n') : '- No discounts offered (excellent discipline).'}
`;

  return `
## AGENT REPORTS FOR THIS CALL
${callTypeSection}
${accountHistorySection}

### 1. CALL METADATA (The Census & Historian)
- Summary: ${metadata.summary}
- Key Topics: ${metadata.topics?.join(', ') || 'None identified'}
- Participants: ${metadata.participants?.map(p => `${p.name} (${p.role}, ${p.sentiment}${p.is_decision_maker ? ', Decision Maker' : ''})`).join('; ') || 'Unknown'}
- Duration: ${metadata.logistics?.duration_minutes || 'Unknown'} minutes

### 2. BEHAVIORAL SCORE (The Referee)
- Overall Score: ${behavior.overall_score}/100 (${behavior.grade})
- Acknowledgment: ${behavior.metrics.patience.score}/30 (${behavior.metrics.patience.missed_acknowledgment_count} missed acknowledgments, ${behavior.metrics.patience.status})
- Monologue: ${behavior.metrics.monologue.score}/20 (${behavior.metrics.monologue.violation_count} violations, longest turn ${behavior.metrics.monologue.longest_turn_word_count} words)
- Talk/Listen Ratio: ${behavior.metrics.talk_listen_ratio.score}/15 (Rep talked ${behavior.metrics.talk_listen_ratio.rep_talk_percentage}%)
- Next Steps: ${behavior.metrics.next_steps.score}/15 (${behavior.metrics.next_steps.secured ? 'SECURED' : 'NOT SECURED'}: ${behavior.metrics.next_steps.details})

### 3. QUESTION LEVERAGE (The Interrogator)
- Score: ${questions.score}/20
- Yield Ratio: ${questions.yield_ratio}x (Avg Question: ${questions.average_question_length} words, Avg Answer: ${questions.average_answer_length} words)
- High Leverage Questions: ${questions.high_leverage_count} | Low Leverage: ${questions.low_leverage_count}
- Best Questions: ${questions.high_leverage_examples?.slice(0, 2).map(q => `"${q}"`).join(', ') || 'None'}
- Worst Questions: ${questions.low_leverage_examples?.slice(0, 2).map(q => `"${q}"`).join(', ') || 'None'}

### 4. STRATEGIC THREADING (The Strategist)
- Score: ${strategy.strategic_threading.score}/100 (${strategy.strategic_threading.grade})
- Relevance Map:
${strategy.strategic_threading.relevance_map?.map(r => `  - Pain: "${r.pain_identified}" → Feature: "${r.feature_pitched}" | ${r.is_relevant ? '✓ RELEVANT' : '✗ MISMATCH'}: ${r.reasoning}`).join('\n') || '  No mappings found.'}
- Missed Opportunities: ${strategy.strategic_threading.missed_opportunities?.map(o => typeof o === 'string' ? o : o.pain).join(', ') || 'None'}

### 5. CRITICAL GAPS (The Skeptic)
${gaps.critical_gaps?.length > 0 ? gaps.critical_gaps.map(g => `- [${g.impact}] ${g.category}: ${g.description} → Ask: "${g.suggested_question}"`).join('\n') : 'No critical gaps identified.'}

### 6. OBJECTION HANDLING (The Negotiator)
- Score: ${objections.score}/100 (${objections.grade})
${objections.objections_detected?.length > 0 ? objections.objections_detected.map(o => `- [${o.handling_rating}] "${o.objection}" (${o.category}): ${o.rep_response} | Tip: ${o.coaching_tip}`).join('\n') : '- No objections detected in this call.'}

### 7. PROSPECT PSYCHOLOGY (The Profiler)
- Persona: ${psychology.prospect_persona}
- DISC Profile: ${psychology.disc_profile}
- Communication Style: ${psychology.communication_style.tone}, ${psychology.communication_style.preference}
- Do: ${psychology.dos_and_donts.do?.join(', ') || 'N/A'}
- Don't: ${psychology.dos_and_donts.dont?.join(', ') || 'N/A'}

### 8. COMPETITIVE INTEL (The Spy)
${competitors.competitive_intel?.length > 0 ? competitors.competitive_intel.map(c => `- ${c.competitor_name} (${c.usage_status}, Position: ${c.competitive_position}): Strengths: ${c.strengths_mentioned?.join(', ') || 'None'}; Weaknesses: ${c.weaknesses_mentioned?.join(', ') || 'None'}; Strategy: ${c.positioning_strategy}`).join('\n') : 'No competitors mentioned.'}
${pricingSection}
`;
}

// ============= PIPELINE TIMEOUT =============

// 5 minutes - extended for background processing with fire-and-forget pattern
// analyze-call returns 202 immediately, so we have ample time for quality
const PIPELINE_TIMEOUT_MS = 300000;

// Hard limit before Coach phase - if we've exceeded this, skip Coach and return partial results
// This prevents complete analysis failure when agents take too long
const PIPELINE_HARD_LIMIT_MS = 240000; // 4 minutes

class PipelineTimeoutError extends Error {
  constructor(elapsedMs: number) {
    super(`Pipeline timeout after ${Math.round(elapsedMs)}ms`);
    this.name = 'PipelineTimeoutError';
  }
}

function checkTimeout(startTime: number, phase: string): void {
  const elapsed = performance.now() - startTime;
  if (elapsed > PIPELINE_TIMEOUT_MS) {
    throw new PipelineTimeoutError(elapsed);
  }
  // Log warning if we're getting close (80% of timeout)
  if (elapsed > PIPELINE_TIMEOUT_MS * 0.8) {
    console.warn(`[Pipeline] WARNING: ${phase} - ${Math.round(elapsed)}ms elapsed, approaching timeout`);
  }
}

// ============= MAIN PIPELINE =============

/**
 * Run the full analysis pipeline with context-aware batched execution
 * 
 * Phase 0: Speaker Labeler (pre-processing with speaker context)
 * Batch 1 (Critical): Census, Historian, Spy
 * Batch 2 (Strategic): Profiler, Strategist, Referee, Interrogator, Negotiator + Skeptic (async)
 * Phase 2: Coach - synthesizes all outputs
 */
export interface PipelineOptions {
  force?: boolean;
  correlationId?: string;
}

export async function runAnalysisPipeline(
  transcript: string,
  supabase: SupabaseClient,
  callId: string,
  speakerContext?: SpeakerContext,
  accountHistory?: AccountHistoryContext,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const warnings: string[] = [];
  const forceRerun = options?.force === true;
  const cid = options?.correlationId || callId.slice(0, 12);
  const logPrefix = `[Pipeline][${cid}]`;

  // ============= CONTENT-ADDRESSED CACHE SETUP =============
  const contentHash = await hashContent(transcript);
  let agentCache: AgentCacheMap = {};
  let cacheHits = 0;

  if (!forceRerun) {
    // Load existing agent cache from ai_call_analysis.raw_json._agent_cache
    try {
      const { data: existingAnalysis } = await supabase
        .from('ai_call_analysis')
        .select('raw_json')
        .eq('call_id', callId)
        .maybeSingle();

      if (existingAnalysis?.raw_json && typeof existingAnalysis.raw_json === 'object') {
        const rawJson = existingAnalysis.raw_json as Record<string, unknown>;
        if (rawJson._agent_cache && typeof rawJson._agent_cache === 'object') {
          agentCache = rawJson._agent_cache as AgentCacheMap;
          console.log(`${logPrefix} Cache loaded: ${Object.keys(agentCache).length} cached agent results, content hash: ${contentHash.substring(0, 12)}...`);
        }
      }
    } catch (err) {
      console.warn(`${logPrefix} Failed to load agent cache, proceeding without cache:`, err);
    }
  } else {
    console.log(`${logPrefix} Force mode: skipping agent cache`);
  }

  // Cache-aware agent execution wrapper
  // Checks cache before calling LLM; stores result in cache on success
  async function cachedExecuteAgentWithPrompt<T>(
    config: AgentConfig<z.ZodTypeAny>,
    prompt: string,
    supabaseClient: SupabaseClient,
    cId: string
  ): Promise<AgentResult<T>> {
    if (!forceRerun) {
      const cached = getCachedAgentResult(agentCache, config.id, contentHash);
      if (cached !== null) {
        // Validate cached result still parses against schema
        const validation = config.schema.safeParse(cached);
        if (validation.success) {
          cacheHits++;
          console.log(`[${config.name}] CACHE HIT (hash match) - skipping LLM call`);
          return { success: true, data: validation.data as T, durationMs: 0 };
        } else {
          console.log(`[${config.name}] Cache stale (schema mismatch) - calling LLM`);
        }
      }
    }

    const result = await executeAgentWithPrompt(config, prompt, supabaseClient, cId);
    if (result.success) {
      setCachedAgentResult(agentCache, config.id, contentHash, result.data);
    }
    return result as AgentResult<T>;
  }

  async function cachedExecuteAgent<T>(
    config: AgentConfig<z.ZodTypeAny>,
    transcriptText: string,
    supabaseClient: SupabaseClient,
    cId: string
  ): Promise<AgentResult<T>> {
    if (!forceRerun) {
      const cached = getCachedAgentResult(agentCache, config.id, contentHash);
      if (cached !== null) {
        const validation = config.schema.safeParse(cached);
        if (validation.success) {
          cacheHits++;
          console.log(`[${config.name}] CACHE HIT (hash match) - skipping LLM call`);
          return { success: true, data: validation.data as T, durationMs: 0 };
        }
      }
    }

    const result = await executeAgent(config, transcriptText, supabaseClient, cId);
    if (result.success) {
      setCachedAgentResult(agentCache, config.id, contentHash, result.data);
    }
    return result as AgentResult<T>;
  }

  // Async agent result holder (scoped to this pipeline run to avoid race conditions)
  let pendingSkepticResult: Promise<AgentResult<SkepticOutput>> | null = null;

  // Determine which transcript to use (labeled or raw)
  let processedTranscript = transcript;
  
  // Store call classification for downstream context
  let callClassification: CallClassification | undefined;

  // ============= PHASE 0: Speaker Labeler + Sentinel (Pre-processing, parallel) =============
  console.log(`${logPrefix} Phase 0: Running Speaker Labeler + Sentinel in parallel...`);
  const phase0Start = performance.now();
  
  // Get Phase 0 agents
  const speakerLabelerConfig = getPhase0Agent('speaker_labeler');
  const sentinelConfig = getPhase0Agent('sentinel');
  
  // Build prompts
  const labelerPrompt = speakerContext 
    ? buildSpeakerLabelerPrompt(transcript, speakerContext)
    : null;
  const sentinelPrompt = `Classify this sales call transcript by type:\n\n${sanitizeUserContent(transcript)}`; // Full transcript for maximum classification accuracy
  
  // Create timeout race for Phase 0 (20 second budget)
  const phase0Timeout = new Promise<'timeout'>((resolve) => 
    setTimeout(() => resolve('timeout'), PHASE0_BUDGET_MS)
  );
  
  // Length guard: skip speaker labeling for very long transcripts
  const skipLabeling = transcript.length > MAX_TRANSCRIPT_LENGTH_FOR_LABELING;
  if (skipLabeling) {
    const lengthKb = Math.round(transcript.length / 1000);
    warnings.push(`Transcript too long for speaker labeling (${lengthKb}k chars), using raw transcript`);
    console.log(`${logPrefix} Phase 0: Skipping speaker labeling (${lengthKb}k chars exceeds ${MAX_TRANSCRIPT_LENGTH_FOR_LABELING / 1000}k limit)`);
  }
  
  // Smart skip detection: check if transcript already has speaker labels
  let hasPreLabels = false;
  if (!skipLabeling) {
    const labelCheck = hasExistingSpeakerLabels(transcript);
    if (labelCheck.hasLabels) {
      hasPreLabels = true;
      processedTranscript = transcript; // Use as-is, already labeled
      warnings.push(`Transcript already has speaker labels (${labelCheck.coverage}% coverage, pattern: ${labelCheck.pattern})`);
      console.log(`${logPrefix} Phase 0: SMART SKIP - Transcript pre-labeled (${labelCheck.coverage}% coverage, pattern: ${labelCheck.pattern})`);
    }
  }
  
  // Run Phase 0 agents in parallel (within timeout)
  const phase0Promises: Promise<AgentResult<unknown>>[] = [];
  
  // Add Sentinel (always runs)
  if (sentinelConfig) {
    phase0Promises.push(executeAgentWithPrompt(sentinelConfig, sentinelPrompt, supabase, callId));
  }
  
  // Add Speaker Labeler (only if context provided, not too long, and no pre-existing labels)
  if (speakerLabelerConfig && labelerPrompt && !skipLabeling && !hasPreLabels) {
    phase0Promises.push(executeAgentWithPrompt(speakerLabelerConfig, labelerPrompt, supabase, callId));
  }
  
  // Race against timeout
  const phase0RaceResult = await Promise.race([
    Promise.all(phase0Promises),
    phase0Timeout
  ]);
  
  const phase0Duration = performance.now() - phase0Start;
  
  if (phase0RaceResult === 'timeout') {
    warnings.push(`Phase 0 timed out (${PHASE0_BUDGET_MS / 1000}s budget), using defaults`);
    console.log(`${logPrefix} Phase 0 aborted: exceeded ${PHASE0_BUDGET_MS / 1000}s budget after ${Math.round(phase0Duration)}ms`);
  } else {
    const results = phase0RaceResult;
    let resultIndex = 0;
    
    // Process Sentinel result
    if (sentinelConfig && results[resultIndex]) {
      const sentinelResult = results[resultIndex] as AgentResult<SentinelOutput>;
      resultIndex++;
      
      if (sentinelResult.success) {
        const sentinelData = sentinelResult.data;
        callClassification = {
          detected_call_type: sentinelData.detected_call_type,
          confidence: sentinelData.confidence,
          detection_signals: sentinelData.detection_signals,
          scoring_hints: sentinelData.scoring_hints,
        };
        console.log(`${logPrefix} Sentinel: Call type = ${sentinelData.detected_call_type} (${sentinelData.confidence} confidence)`);
        console.log(`${logPrefix} Scoring hints: discovery=${sentinelData.scoring_hints.discovery_expectation}, monologue=${sentinelData.scoring_hints.monologue_tolerance}, talk_ratio=${sentinelData.scoring_hints.talk_ratio_ideal}%`);
      } else {
        warnings.push(`Call classification failed: ${sentinelResult.error}`);
        console.log(`${logPrefix} Sentinel fallback: ${sentinelResult.error}`);
      }
    }
    
    // Process Speaker Labeler result (only if we ran it)
    if (speakerLabelerConfig && labelerPrompt && !skipLabeling && !hasPreLabels && results[resultIndex]) {
      const labelerResult = results[resultIndex] as AgentResult<SpeakerLabelerOutput>;
      
      if (labelerResult.success) {
        const labelerData = labelerResult.data;
        
        if (labelerData.line_labels && labelerData.line_labels.length > 0) {
          const labeledTranscript = applyLabelsToTranscript(transcript, labelerData.line_labels);
          
          // Validate label coverage
          const lines = labeledTranscript.split('\n').filter((l: string) => l.trim());
          const labeledLines = lines.filter((l: string) => /^(REP|PROSPECT|MANAGER|OTHER):/i.test(l.trim()));
          const labelCoverage = lines.length > 0 ? labeledLines.length / lines.length : 0;
          
          if (labelCoverage >= 0.1) {
            processedTranscript = labeledTranscript;
            console.log(`${logPrefix} Speaker Labeler: ${labelerData.speaker_count} speakers, ${Math.round(labelCoverage * 100)}% coverage (${labelerData.detection_confidence} confidence)`);
          } else {
            warnings.push(`Low label coverage (${Math.round(labelCoverage * 100)}%), using raw transcript`);
            console.log(`${logPrefix} Speaker Labeler fallback: Low coverage ${Math.round(labelCoverage * 100)}%`);
          }
        } else {
          warnings.push('Speaker labeling returned no line labels, using raw transcript');
          console.log(`${logPrefix} Speaker Labeler fallback: Empty line_labels array`);
        }
      } else {
        warnings.push(`Speaker labeling failed: ${labelerResult.error}, using raw transcript`);
        console.log(`${logPrefix} Speaker Labeler fallback: ${labelerResult.error}`);
      }
    }
  }
  
  console.log(`${logPrefix} Phase 0 complete in ${Math.round(phase0Duration)}ms`);

  // Get all agent configs
  const censusConfig = getAgent('census')!;
  const historianConfig = getAgent('historian')!;
  const spyConfig = getAgent('spy')!;
  const profilerConfig = getAgent('profiler')!;
  const strategistConfig = getAgent('strategist')!;
  const refereeConfig = getAgent('referee')!;
  const interrogatorConfig = getAgent('interrogator')!;
  const skepticConfig = getAgent('skeptic')!;
  const negotiatorConfig = getAgent('negotiator')!;
  const auditorConfig = getAgent('auditor')!;
  const coachConfig = getAgent('coach')!;

  // ============= BATCH 1: Critical Agents (Census, Historian, Spy) =============
  // Note: Use processedTranscript (labeled) for analysis
  // Spy now receives call type context from Sentinel for better competitor detection
  console.log(`${logPrefix} Batch 1/2: Running Census, Historian, Spy...`);
  const batch1Start = performance.now();

  // Build context-aware prompts for Batch 1
  const censusPrompt = buildCensusPrompt(processedTranscript, callClassification?.detected_call_type);
  const spyPrompt = buildSpyPrompt(processedTranscript, callClassification?.detected_call_type);

  const [censusResult, historianResult, spyResult] = await Promise.all([
    cachedExecuteAgentWithPrompt<CensusOutput>(censusConfig, censusPrompt, supabase, callId),
    cachedExecuteAgent<HistorianOutput>(historianConfig, processedTranscript, supabase, callId),
    cachedExecuteAgentWithPrompt<SpyOutput>(spyConfig, spyPrompt, supabase, callId),
  ]);

  const batch1Duration = performance.now() - batch1Start;
  console.log(`${logPrefix} Batch 1 complete in ${Math.round(batch1Duration)}ms`);
  
  // Check timeout after each batch
  checkTimeout(pipelineStart, 'After Batch 1');

  // Check critical agents - graceful degradation instead of hard failure
  if (!censusResult.success) {
    warnings.push(`Critical agent 'Census' failed: ${censusResult.error} - using defaults`);
    console.warn(`${logPrefix} Census failed, using defaults: ${censusResult.error}`);
  }
  if (!historianResult.success) {
    warnings.push(`Critical agent 'Historian' failed: ${historianResult.error} - using defaults`);
    console.warn(`${logPrefix} Historian failed, using defaults: ${historianResult.error}`);
  }
  if (!spyResult.success) {
    warnings.push(`Competitive intelligence failed: ${spyResult.error}`);
  }

  // Extract context from Batch 1 for Batch 2 - use defaults if agents failed
  const census = censusResult.success 
    ? censusResult.data as CensusOutput 
    : (censusConfig.default as CensusOutput);
  const historian = historianResult.success 
    ? historianResult.data as HistorianOutput 
    : (historianConfig.default as HistorianOutput);
  const spy = spyResult.data as SpyOutput;
  
  const primaryDecisionMaker = census.participants.find(p => p.is_decision_maker);
  const callSummary = historian.summary;

  // Small delay between batches to let rate limits recover
  await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

  // ============= BATCH 2: Strategic + Deep Dive (Split into 2a/2b for rate limit control) =============
  // Skeptic runs async (non-blocking) and we await before Coach
  console.log(`${logPrefix} Batch 2a: Running Profiler, Strategist, Referee + Skeptic (async)...`);
  const batch2Start = performance.now();

  // Build context-aware prompts using processedTranscript
  const profilerPrompt = buildProfilerPrompt(
    processedTranscript, 
    primaryDecisionMaker?.name,
    callClassification?.detected_call_type
  );
  const strategistPrompt = buildStrategistPrompt(
    processedTranscript, 
    callSummary, 
    callClassification?.detected_call_type,
    callClassification?.scoring_hints,
    accountHistory
  );
  const behaviorPrompt = buildBehaviorPrompt(
    processedTranscript, 
    callSummary, 
    callClassification?.scoring_hints,
    callClassification?.detected_call_type,
    accountHistory
  );
  const competitorNames = spyResult.success 
    ? spy.competitive_intel.map(c => c.competitor_name) 
    : undefined;

  // Fire Skeptic async (non-blocking) - runs independently, await before Coach
  const skepticPrompt = buildSkepticPrompt(
    processedTranscript, 
    undefined, // missed opportunities - populated after strategist runs
    callClassification?.detected_call_type,
    callClassification?.scoring_hints,
    accountHistory
  );
  pendingSkepticResult = cachedExecuteAgentWithPrompt<SkepticOutput>(skepticConfig, skepticPrompt, supabase, callId);
  console.log(`${logPrefix} Skeptic fired async (non-blocking)`);

  // Batch 2a: Profiler, Strategist, Referee (3 agents)
  const [profilerResult, strategistResult, refereeResult] = await Promise.all([
    cachedExecuteAgentWithPrompt<ProfilerOutput>(profilerConfig, profilerPrompt, supabase, callId),
    cachedExecuteAgentWithPrompt<StrategistOutput>(strategistConfig, strategistPrompt, supabase, callId),
    cachedExecuteAgentWithPrompt<RefereeOutput>(refereeConfig, behaviorPrompt, supabase, callId),
  ]);
  
  const batch2aDuration = performance.now() - batch2Start;
  console.log(`${logPrefix} Batch 2a complete in ${Math.round(batch2aDuration)}ms`);
  
  // Small delay between sub-batches to reduce API pressure
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Batch 2b: Interrogator, Negotiator, Auditor (3 agents)
  // These need context from Batch 2a (Strategist)
  console.log(`${logPrefix} Batch 2b: Running Interrogator, Negotiator, Auditor...`);
  const batch2bStart = performance.now();
  
  const interrogatorPrompt = buildInterrogatorPrompt(
    processedTranscript, 
    callClassification?.scoring_hints,
    callClassification?.detected_call_type
  );
  
  // Extract context from Strategist for Negotiator and Auditor
  const strategistDataForContext = strategistResult.data as StrategistOutput;
  const pitchedFeatures = strategistResult.success && strategistDataForContext?.strategic_threading?.relevance_map
    ? strategistDataForContext.strategic_threading.relevance_map.map(p => p.feature_pitched)
    : undefined;
  const painSeverities = strategistResult.success && strategistDataForContext?.strategic_threading?.relevance_map
    ? strategistDataForContext.strategic_threading.relevance_map
        .filter(p => p.pain_severity)
        .map(p => ({ pain: p.pain_identified, severity: p.pain_severity as string }))
    : undefined;
    
  const negotiatorPrompt = buildNegotiatorPrompt(
    processedTranscript, 
    competitorNames, 
    pitchedFeatures,
    callClassification?.detected_call_type
  );
  const auditorPrompt = buildAuditorPrompt(
    processedTranscript,
    callClassification?.detected_call_type,
    painSeverities
  );
  
  const [interrogatorResult, negotiatorResult, auditorResult] = await Promise.all([
    cachedExecuteAgentWithPrompt<InterrogatorOutput>(interrogatorConfig, interrogatorPrompt, supabase, callId),
    cachedExecuteAgentWithPrompt<NegotiatorOutput>(negotiatorConfig, negotiatorPrompt, supabase, callId),
    cachedExecuteAgentWithPrompt<AuditorOutput>(auditorConfig, auditorPrompt, supabase, callId),
  ]);
  
  const batch2bDuration = performance.now() - batch2bStart;
  console.log(`${logPrefix} Batch 2b complete in ${Math.round(batch2bDuration)}ms`);

  const batch2Duration = performance.now() - batch2Start;
  
  // Check timeout after Batch 2
  checkTimeout(pipelineStart, 'After Batch 2');

  // Track warnings for non-critical agents
  if (!profilerResult.success) warnings.push(`Psychology profiling failed: ${profilerResult.error}`);
  if (!strategistResult.success) warnings.push(`Strategy analysis failed: ${strategistResult.error}`);
  if (!refereeResult.success) warnings.push(`Behavior analysis failed: ${refereeResult.error}`);
  if (!interrogatorResult.success) warnings.push(`Question analysis failed: ${interrogatorResult.error}`);
  if (!auditorResult.success) warnings.push(`Pricing discipline analysis failed: ${auditorResult.error}`);
  if (!negotiatorResult.success) warnings.push(`Objection handling analysis failed: ${negotiatorResult.error}`);

  // Now await Skeptic (should be done or nearly done)
  console.log(`${logPrefix} Awaiting async Skeptic result...`);
  const skepticResult = await pendingSkepticResult;
  pendingSkepticResult = null; // Clear for next run
  
  if (!skepticResult.success) warnings.push(`Deal gaps analysis failed: ${skepticResult.error}`);
  console.log(`${logPrefix} Skeptic complete (was running async)`);
  
  // Check timeout before Phase 2
  checkTimeout(pipelineStart, 'Before Phase 2');

  const phase1Duration = batch1Duration + batch2Duration + BATCH_DELAY_MS;
  console.log(`${logPrefix} Phase 1 (all 2 batches) complete in ${Math.round(phase1Duration)}ms (${warnings.length} warnings)`);
  
  // Circuit breaker: if we have 3+ warnings already, log prominently for investigation
  if (warnings.length >= 3) {
    console.warn(`${logPrefix} WARNING ACCUMULATION: ${warnings.length} warnings accumulated - this call may have issues:`, warnings.slice(0, 5));
  }

  // ============= MERGE PHASE 1 RESULTS =============
  const strategist = strategistResult.data as StrategistOutput;
  const referee = refereeResult.data as RefereeOutput;
  const interrogator = interrogatorResult.data as InterrogatorOutput;
  const skeptic = skepticResult.data as SkepticOutput;
  const negotiator = negotiatorResult.data as NegotiatorOutput;
  const profiler = profilerResult.data as ProfilerOutput;
  const auditor = auditorResult.data as AuditorOutput;

  // Track which strategy-related agents used fallbacks
  const strategyWarnings: string[] = [];
  if (!strategistResult.success) strategyWarnings.push('strategist_fallback_used');
  if (!skepticResult.success) strategyWarnings.push('skeptic_fallback_used');
  if (!negotiatorResult.success) strategyWarnings.push('negotiator_fallback_used');

  const metadata = mergeCallMetadata(census, historian);
  const behavior = mergeBehaviorWithQuestions(referee, interrogator);
  const strategy = mergeStrategy(strategist, skeptic, negotiator, spy, strategyWarnings);

  console.log(`${logPrefix} Scores - Behavior: ${behavior.overall_score} (base: ${referee.overall_score}, questions: ${interrogator.score}), Threading: ${strategy.strategic_threading.score}, Critical Gaps: ${strategy.critical_gaps.length}, Pricing: ${auditor.pricing_score}`);

  // ============= PHASE 2: The Coach + The Scribe =============
  
  // Check if we've exceeded the hard limit - if so, skip Phase 2 and return partial results
  const elapsedBeforePhase2 = performance.now() - pipelineStart;
  if (elapsedBeforePhase2 > PIPELINE_HARD_LIMIT_MS) {
    console.warn(`${logPrefix} Pipeline exceeded ${PIPELINE_HARD_LIMIT_MS}ms (${Math.round(elapsedBeforePhase2)}ms), skipping Phase 2`);
    warnings.push(`Pipeline timeout (${Math.round(elapsedBeforePhase2)}ms) - Phase 2 skipped, using defaults`);
    
    const coachDefault = coachConfig.default as CoachOutput;
    const scribeConfig = getAgent('scribe')!;
    const scribeDefault = scribeConfig.default as ScribeOutput;
    return {
      metadata,
      behavior,
      strategy,
      psychology: profiler,
      pricing: auditor,
      coaching: coachDefault,
      salesAssets: scribeDefault,
      callClassification,
      warnings,
      phase1DurationMs: phase1Duration,
      phase2DurationMs: 0,
      totalDurationMs: elapsedBeforePhase2,
    };
  }
  
  console.log(`${logPrefix} Phase 2: Running The Coach + The Scribe (parallel)...`);
  const phase2Start = performance.now();

  // Build coaching input report
  const coachingReport = buildCoachingInputReport(
    metadata,
    behavior,
    interrogator,
    strategist,
    skeptic,
    negotiator,
    profiler,
    spy,
    auditor,
    callClassification,
    accountHistory
  );

  // Build Scribe input from Phase 1 outputs
  const scribeInput = buildScribeInput(
    historian,
    skeptic,
    spy,
    referee,
    speakerContext,
    processedTranscript
  );

  const scribeConfig = getAgent('scribe')!;

  // Run Coach and Scribe in parallel - Coach uses consensus, Scribe uses single model
  const [coachResult, scribeResult] = await Promise.all([
    executeCoachWithConsensus(coachConfig, coachingReport, supabase, callId),
    cachedExecuteAgentWithPrompt<ScribeOutput>(scribeConfig, scribeInput, supabase, callId),
  ]);
  
  if (!coachResult.success) {
    warnings.push(`Coaching synthesis failed: ${coachResult.error}`);
  }
  if (!scribeResult.success) {
    warnings.push(`CRM notes generation failed: ${scribeResult.error}`);
  }

  const phase2Duration = performance.now() - phase2Start;
  const totalDuration = performance.now() - pipelineStart;

  console.log(`${logPrefix} Phase 2 complete in ${Math.round(phase2Duration)}ms, Grade: ${coachResult.data.overall_grade}, Focus: ${coachResult.data.primary_focus_area}`);
  console.log(`${logPrefix} Total pipeline: ${Math.round(totalDuration)}ms (Phase 1: ${Math.round(phase1Duration)}ms, Phase 2: ${Math.round(phase2Duration)}ms)`);

  // Log cache performance
  const totalAgents = Object.keys(agentCache).length;
  if (cacheHits > 0) {
    console.log(`${logPrefix} Cache stats: ${cacheHits} cache hits out of ~12 agents (saved ${cacheHits} LLM calls, hash: ${contentHash.substring(0, 12)}...)`);
  }

  // Persist agent cache to ai_call_analysis.raw_json._agent_cache for future runs
  try {
    const { data: existingRow } = await supabase
      .from('ai_call_analysis')
      .select('raw_json')
      .eq('call_id', callId)
      .maybeSingle();

    if (existingRow) {
      const currentRawJson = (existingRow.raw_json && typeof existingRow.raw_json === 'object')
        ? existingRow.raw_json as Record<string, unknown>
        : {};
      await supabase
        .from('ai_call_analysis')
        .update({ raw_json: { ...currentRawJson, _agent_cache: agentCache } })
        .eq('call_id', callId);
    }
  } catch (err) {
    console.warn(`${logPrefix} Failed to persist agent cache:`, err);
  }

  return {
    metadata,
    behavior,
    strategy,
    psychology: profiler,
    pricing: auditor,
    coaching: coachResult.data,
    salesAssets: scribeResult.data as ScribeOutput,
    callClassification,
    warnings,
    phase1DurationMs: phase1Duration,
    phase2DurationMs: phase2Duration,
    totalDurationMs: totalDuration,
  };
}
