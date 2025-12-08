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

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAgent, getPhase0Agent, AgentConfig } from './agent-registry.ts';
import { executeAgent, executeAgentWithPrompt, AgentResult, getAgentTimeout } from './agent-factory.ts';
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
  CoachOutput,
  SpeakerLabelerOutput,
  SentinelOutput,
  CallMetadata,
  MergedBehaviorScore,
  StrategyAudit,
} from './agent-schemas.ts';
import { SPEAKER_LABELER_PROMPT } from './agent-prompts.ts';

// ============= SPEAKER CONTEXT TYPE =============

export interface SpeakerContext {
  repName: string;
  stakeholderName: string;
  accountName: string;
  managerOnCall: boolean;
  additionalSpeakers: string[];
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
  coaching: CoachOutput;
  callClassification?: CallClassification;
  warnings: string[];
  phase1DurationMs: number;
  phase2DurationMs: number;
  totalDurationMs: number;
}

// Delay between batches to allow rate limits to recover (reduced for P1)
const BATCH_DELAY_MS = 300;

// Phase 0 time budget - abort Speaker Labeler if it exceeds this
const PHASE0_BUDGET_MS = 20000;

// Maximum transcript length for speaker labeling (80k chars ~ 20k words)
// Longer transcripts skip labeling to prevent timeout/overflow
const MAX_TRANSCRIPT_LENGTH_FOR_LABELING = 80000;

// ============= CONTEXT-AWARE PROMPT BUILDERS =============

function buildProfilerPrompt(
  transcript: string, 
  primarySpeakerName?: string,
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript to profile the PROSPECT's communication style and create a behavioral persona. Focus on how THEY speak, respond, and what they seem to value:\n\n${transcript}`;
  
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
  scoringHints?: SentinelOutput['scoring_hints']
): string {
  const basePrompt = `Analyze this sales call transcript for strategic alignment. Map every prospect pain to every rep pitch and score the relevance:\n\n${transcript}`;
  
  const contextParts: string[] = [];
  
  if (callSummary) {
    contextParts.push(`Call Summary: ${callSummary}`);
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
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${transcript}`;
  
  const contextParts: string[] = [];
  
  if (callSummary) {
    contextParts.push(`Call Summary: ${callSummary}`);
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
  scoringHints?: SentinelOutput['scoring_hints']
): string {
  const basePrompt = `Analyze this sales call transcript. Find the 3-5 most dangerous UNKNOWNS or MISSING INFORMATION that could block this deal:\n\n${transcript}`;
  
  const contextParts: string[] = [];
  
  if (missedOpportunities && missedOpportunities.length > 0) {
    const painsList = missedOpportunities.map(o => `- ${o.pain} (${o.severity})`).join('\n');
    contextParts.push(`The rep already missed these specific pains:\n${painsList}\n\nFocus your gap analysis on UNKNOWNS regarding Budget, Authority, and Timeline.`);
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
  const basePrompt = `Analyze this sales call transcript for competitive intelligence. Extract competitor mentions and build battlecard:\n\n${transcript}`;
  
  const contextParts: string[] = [];
  
  if (callType) {
    contextParts.push(`Call Type: ${callType}`);
    
    if (callType === 'pricing_negotiation') {
      contextParts.push(`NOTE: This is a PRICING NEGOTIATION call. Competitors are more likely to be mentioned as pricing benchmarks. Pay special attention to comparative pricing statements.`);
    } else if (callType === 'technical_deep_dive') {
      contextParts.push(`NOTE: This is a TECHNICAL DEEP DIVE. Look for competitors mentioned in technical context (features, integrations, APIs). Technical stakeholders often reference alternatives.`);
    } else if (callType === 'reconnect') {
      contextParts.push(`NOTE: This is a RECONNECT call. The prospect may have evaluated competitors since the last meeting. Look for new competitor mentions or changes in evaluation status.`);
    }
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join('\n')}`;
  }
  return basePrompt;
}

function buildNegotiatorPrompt(
  transcript: string, 
  competitorNames?: string[], 
  pitchedFeatures?: string[],
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${transcript}`;
  
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
  
  return `${prompt}\n\n--- TRANSCRIPT TO LABEL ---\n${transcript}`;
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
  spy: SpyOutput
): StrategyAudit {
  return {
    strategic_threading: strategist.strategic_threading,
    critical_gaps: skeptic.critical_gaps,
    objection_handling: negotiator,
    competitive_intel: spy.competitive_intel,
  };
}

// ============= COACHING INPUT BUILDER =============

function buildInterrogatorPrompt(
  transcript: string, 
  scoringHints?: SentinelOutput['scoring_hints'],
  callType?: string
): string {
  const basePrompt = `Analyze this sales call transcript for question quality and leverage. Focus on the yield ratio - how much information the rep extracted relative to their question investment:\n\n${transcript}`;
  
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

function buildCoachingInputReport(
  metadata: CallMetadata,
  behavior: MergedBehaviorScore,
  questions: InterrogatorOutput,
  strategy: StrategistOutput,
  gaps: SkepticOutput,
  objections: NegotiatorOutput,
  psychology: ProfilerOutput,
  competitors: SpyOutput,
  callClassification?: CallClassification
): string {
  const callTypeSection = callClassification ? `
### 0. CALL CLASSIFICATION (The Sentinel)
- Detected Type: ${callClassification.detected_call_type}
- Confidence: ${callClassification.confidence}
- Detection Signals: ${callClassification.detection_signals.join(', ') || 'None'}
- Scoring Context:
  - Discovery Expectation: ${callClassification.scoring_hints.discovery_expectation}
  - Monologue Tolerance: ${callClassification.scoring_hints.monologue_tolerance}
  - Ideal Talk Ratio: ${callClassification.scoring_hints.talk_ratio_ideal}%

**IMPORTANT**: Calibrate your coaching based on this call type. A "${callClassification.detected_call_type}" call has different success criteria than a standard discovery call.
` : '';

  return `
## AGENT REPORTS FOR THIS CALL
${callTypeSection}

### 1. CALL METADATA (The Census & Historian)
- Summary: ${metadata.summary}
- Key Topics: ${metadata.topics?.join(', ') || 'None identified'}
- Participants: ${metadata.participants?.map(p => `${p.name} (${p.role}, ${p.sentiment}${p.is_decision_maker ? ', Decision Maker' : ''})`).join('; ') || 'Unknown'}
- Duration: ${metadata.logistics?.duration_minutes || 'Unknown'} minutes

### 2. BEHAVIORAL SCORE (The Referee)
- Overall Score: ${behavior.overall_score}/100 (${behavior.grade})
- Patience: ${behavior.metrics.patience.score}/30 (${behavior.metrics.patience.interruption_count} interruptions, ${behavior.metrics.patience.status})
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
- Missed Opportunities: ${strategy.strategic_threading.missed_opportunities?.map(o => o.pain).join(', ') || 'None'}

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
`;
}

// ============= PIPELINE TIMEOUT =============

const PIPELINE_TIMEOUT_MS = 50000; // 50 seconds - leave 10s buffer for Edge Function limit

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
export async function runAnalysisPipeline(
  transcript: string,
  supabase: SupabaseClient,
  callId: string,
  speakerContext?: SpeakerContext
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const warnings: string[] = [];

  // Async agent result holder (scoped to this pipeline run to avoid race conditions)
  let pendingSkepticResult: Promise<AgentResult<SkepticOutput>> | null = null;

  // Determine which transcript to use (labeled or raw)
  let processedTranscript = transcript;
  
  // Store call classification for downstream context
  let callClassification: CallClassification | undefined;

  // ============= PHASE 0: Speaker Labeler + Sentinel (Pre-processing, parallel) =============
  console.log('[Pipeline] Phase 0: Running Speaker Labeler + Sentinel in parallel...');
  const phase0Start = performance.now();
  
  // Get Phase 0 agents
  const speakerLabelerConfig = getPhase0Agent('speaker_labeler');
  const sentinelConfig = getPhase0Agent('sentinel');
  
  // Build prompts
  const labelerPrompt = speakerContext 
    ? buildSpeakerLabelerPrompt(transcript, speakerContext)
    : null;
  const sentinelPrompt = `Classify this sales call transcript by type:\n\n${transcript.slice(0, 50000)}`; // Limit for classifier
  
  // Create timeout race for Phase 0 (20 second budget)
  const phase0Timeout = new Promise<'timeout'>((resolve) => 
    setTimeout(() => resolve('timeout'), PHASE0_BUDGET_MS)
  );
  
  // Length guard: skip speaker labeling for very long transcripts
  const skipLabeling = transcript.length > MAX_TRANSCRIPT_LENGTH_FOR_LABELING;
  if (skipLabeling) {
    const lengthKb = Math.round(transcript.length / 1000);
    warnings.push(`Transcript too long for speaker labeling (${lengthKb}k chars), using raw transcript`);
    console.log(`[Pipeline] Phase 0: Skipping speaker labeling (${lengthKb}k chars exceeds limit)`);
  }
  
  // Run Phase 0 agents in parallel (within timeout)
  const phase0Promises: Promise<AgentResult<unknown>>[] = [];
  
  // Add Sentinel (always runs)
  if (sentinelConfig) {
    phase0Promises.push(executeAgentWithPrompt(sentinelConfig, sentinelPrompt, supabase, callId));
  }
  
  // Add Speaker Labeler (only if context provided and not too long)
  if (speakerLabelerConfig && labelerPrompt && !skipLabeling) {
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
    console.log(`[Pipeline] Phase 0 aborted: exceeded ${PHASE0_BUDGET_MS / 1000}s budget after ${Math.round(phase0Duration)}ms`);
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
        console.log(`[Pipeline] Sentinel: Call type = ${sentinelData.detected_call_type} (${sentinelData.confidence} confidence)`);
        console.log(`[Pipeline] Scoring hints: discovery=${sentinelData.scoring_hints.discovery_expectation}, monologue=${sentinelData.scoring_hints.monologue_tolerance}, talk_ratio=${sentinelData.scoring_hints.talk_ratio_ideal}%`);
      } else {
        warnings.push(`Call classification failed: ${sentinelResult.error}`);
        console.log(`[Pipeline] Sentinel fallback: ${sentinelResult.error}`);
      }
    }
    
    // Process Speaker Labeler result
    if (speakerLabelerConfig && labelerPrompt && !skipLabeling && results[resultIndex]) {
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
            console.log(`[Pipeline] Speaker Labeler: ${labelerData.speaker_count} speakers, ${Math.round(labelCoverage * 100)}% coverage (${labelerData.detection_confidence} confidence)`);
          } else {
            warnings.push(`Low label coverage (${Math.round(labelCoverage * 100)}%), using raw transcript`);
            console.log(`[Pipeline] Speaker Labeler fallback: Low coverage ${Math.round(labelCoverage * 100)}%`);
          }
        } else {
          warnings.push('Speaker labeling returned no line labels, using raw transcript');
          console.log(`[Pipeline] Speaker Labeler fallback: Empty line_labels array`);
        }
      } else {
        warnings.push(`Speaker labeling failed: ${labelerResult.error}, using raw transcript`);
        console.log(`[Pipeline] Speaker Labeler fallback: ${labelerResult.error}`);
      }
    }
  }
  
  console.log(`[Pipeline] Phase 0 complete in ${Math.round(phase0Duration)}ms`);

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
  const coachConfig = getAgent('coach')!;

  // ============= BATCH 1: Critical Agents (Census, Historian, Spy) =============
  // Note: Use processedTranscript (labeled) for analysis
  // Spy now receives call type context from Sentinel for better competitor detection
  console.log('[Pipeline] Batch 1/2: Running Census, Historian, Spy...');
  const batch1Start = performance.now();

  // Build context-aware Spy prompt
  const spyPrompt = buildSpyPrompt(processedTranscript, callClassification?.detected_call_type);

  const [censusResult, historianResult, spyResult] = await Promise.all([
    executeAgent(censusConfig, processedTranscript, supabase, callId),
    executeAgent(historianConfig, processedTranscript, supabase, callId),
    executeAgentWithPrompt(spyConfig, spyPrompt, supabase, callId),
  ]);

  const batch1Duration = performance.now() - batch1Start;
  console.log(`[Pipeline] Batch 1 complete in ${Math.round(batch1Duration)}ms`);
  
  // Check timeout after each batch
  checkTimeout(pipelineStart, 'After Batch 1');

  // Check critical agents
  if (!censusResult.success) {
    throw new Error(`Critical agent 'Census' failed: ${censusResult.error}`);
  }
  if (!historianResult.success) {
    throw new Error(`Critical agent 'Historian' failed: ${historianResult.error}`);
  }
  if (!spyResult.success) {
    warnings.push(`Competitive intelligence failed: ${spyResult.error}`);
  }

  // Extract context from Batch 1 for Batch 2
  const census = censusResult.data as CensusOutput;
  const historian = historianResult.data as HistorianOutput;
  const spy = spyResult.data as SpyOutput;
  
  const primaryDecisionMaker = census.participants.find(p => p.is_decision_maker);
  const callSummary = historian.summary;

  // Small delay between batches to let rate limits recover
  await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));

  // ============= BATCH 2: Strategic + Deep Dive (P1 Optimized) =============
  // Skeptic runs async (non-blocking) to reduce critical path
  // Skeptic runs async (non-blocking) and we await before Coach
  console.log('[Pipeline] Batch 2/2: Running Profiler, Strategist, Referee, Interrogator, Negotiator + Skeptic (async)...');
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
    callClassification?.scoring_hints
  );
  const behaviorPrompt = buildBehaviorPrompt(
    processedTranscript, 
    callSummary, 
    callClassification?.scoring_hints,
    callClassification?.detected_call_type
  );
  const interrogatorPrompt = buildInterrogatorPrompt(
    processedTranscript, 
    callClassification?.scoring_hints,
    callClassification?.detected_call_type
  );
  const competitorNames = spyResult.success 
    ? spy.competitive_intel.map(c => c.competitor_name) 
    : undefined;
  const negotiatorPrompt = buildNegotiatorPrompt(
    processedTranscript, 
    competitorNames, 
    undefined,
    callClassification?.detected_call_type
  );

  // Fire Skeptic async (non-blocking) - P1 optimization
  // This runs independently and we'll await it before Coach
  const skepticPrompt = buildSkepticPrompt(
    processedTranscript, 
    undefined, // missed opportunities - populated after strategist runs
    callClassification?.detected_call_type,
    callClassification?.scoring_hints
  );
  pendingSkepticResult = executeAgentWithPrompt(skepticConfig, skepticPrompt, supabase, callId);
  console.log('[Pipeline] Skeptic fired async (non-blocking)');

  // Run remaining agents in parallel
  const [profilerResult, strategistResult, refereeResult, interrogatorResult, negotiatorResult] = await Promise.all([
    executeAgentWithPrompt(profilerConfig, profilerPrompt, supabase, callId),
    executeAgentWithPrompt(strategistConfig, strategistPrompt, supabase, callId),
    executeAgentWithPrompt(refereeConfig, behaviorPrompt, supabase, callId),
    executeAgentWithPrompt(interrogatorConfig, interrogatorPrompt, supabase, callId),
    executeAgentWithPrompt(negotiatorConfig, negotiatorPrompt, supabase, callId),
  ]);

  const batch2Duration = performance.now() - batch2Start;
  console.log(`[Pipeline] Batch 2 complete in ${Math.round(batch2Duration)}ms`);
  
  // Check timeout after Batch 2
  checkTimeout(pipelineStart, 'After Batch 2');

  // Track warnings for non-critical agents
  if (!profilerResult.success) warnings.push(`Psychology profiling failed: ${profilerResult.error}`);
  if (!strategistResult.success) warnings.push(`Strategy analysis failed: ${strategistResult.error}`);
  if (!refereeResult.success) warnings.push(`Behavior analysis failed: ${refereeResult.error}`);
  if (!interrogatorResult.success) warnings.push(`Question analysis failed: ${interrogatorResult.error}`);
  if (!negotiatorResult.success) warnings.push(`Objection handling analysis failed: ${negotiatorResult.error}`);

  // Now await Skeptic (should be done or nearly done)
  console.log('[Pipeline] Awaiting async Skeptic result...');
  const skepticResult = await pendingSkepticResult;
  pendingSkepticResult = null; // Clear for next run
  
  if (!skepticResult.success) warnings.push(`Deal gaps analysis failed: ${skepticResult.error}`);
  console.log(`[Pipeline] Skeptic complete (was running async)`);
  
  // Check timeout before Phase 2
  checkTimeout(pipelineStart, 'Before Phase 2');

  const phase1Duration = batch1Duration + batch2Duration + BATCH_DELAY_MS;
  console.log(`[Pipeline] Phase 1 (all 2 batches) complete in ${Math.round(phase1Duration)}ms (${warnings.length} warnings)`);

  // ============= MERGE PHASE 1 RESULTS =============
  const strategist = strategistResult.data as StrategistOutput;
  const referee = refereeResult.data as RefereeOutput;
  const interrogator = interrogatorResult.data as InterrogatorOutput;
  const skeptic = skepticResult.data as SkepticOutput;
  const negotiator = negotiatorResult.data as NegotiatorOutput;
  const profiler = profilerResult.data as ProfilerOutput;

  const metadata = mergeCallMetadata(census, historian);
  const behavior = mergeBehaviorWithQuestions(referee, interrogator);
  const strategy = mergeStrategy(strategist, skeptic, negotiator, spy);

  console.log(`[Pipeline] Scores - Behavior: ${behavior.overall_score} (base: ${referee.overall_score}, questions: ${interrogator.score}), Threading: ${strategy.strategic_threading.score}, Critical Gaps: ${strategy.critical_gaps.length}`);

  // ============= PHASE 2: The Coach =============
  console.log('[Pipeline] Phase 2: Running The Coach (synthesis agent)...');
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
    callClassification
  );

  const coachResult = await executeAgent(coachConfig, coachingReport, supabase, callId);
  
  if (!coachResult.success) {
    warnings.push(`Coaching synthesis failed: ${coachResult.error}`);
  }

  const phase2Duration = performance.now() - phase2Start;
  const totalDuration = performance.now() - pipelineStart;

  console.log(`[Pipeline] Phase 2 complete in ${Math.round(phase2Duration)}ms, Grade: ${coachResult.data.overall_grade}, Focus: ${coachResult.data.primary_focus_area}`);
  console.log(`[Pipeline] Total pipeline: ${Math.round(totalDuration)}ms (Phase 1: ${Math.round(phase1Duration)}ms, Phase 2: ${Math.round(phase2Duration)}ms)`);

  return {
    metadata,
    behavior,
    strategy,
    psychology: profiler,
    coaching: coachResult.data,
    callClassification,
    warnings,
    phase1DurationMs: phase1Duration,
    phase2DurationMs: phase2Duration,
    totalDurationMs: totalDuration,
  };
}
