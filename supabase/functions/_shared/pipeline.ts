/**
 * Analysis Pipeline Orchestrator - P1 Optimized
 * 
 * Performance optimizations (P1):
 * - Skeptic runs async (non-blocking) at start of Batch 2
 * - Per-agent timeouts with graceful degradation
 * - Reduced batch count from 3 to 2 + async Skeptic
 * 
 * Batch 1: Critical (Census, Historian, Spy)
 * Batch 2: Strategic (Profiler, Strategist, Referee, Interrogator, Negotiator) + Skeptic (async)
 * Phase 2: Coach (synthesis)
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getAgent, AgentConfig } from './agent-registry.ts';
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
  CallMetadata,
  MergedBehaviorScore,
  StrategyAudit,
} from './agent-schemas.ts';

// ============= PIPELINE RESULT TYPE =============

export interface PipelineResult {
  metadata: CallMetadata;
  behavior: MergedBehaviorScore;
  strategy: StrategyAudit;
  psychology: ProfilerOutput;
  coaching: CoachOutput;
  warnings: string[];
  phase1DurationMs: number;
  phase2DurationMs: number;
  totalDurationMs: number;
}

// Delay between batches to allow rate limits to recover (reduced for P1)
const BATCH_DELAY_MS = 300;

// Async agent result holder (for non-blocking Skeptic)
let pendingSkepticResult: Promise<AgentResult<SkepticOutput>> | null = null;

// ============= CONTEXT-AWARE PROMPT BUILDERS =============

function buildProfilerPrompt(transcript: string, primarySpeakerName?: string): string {
  const basePrompt = `Analyze this sales call transcript to profile the PROSPECT's communication style and create a behavioral persona. Focus on how THEY speak, respond, and what they seem to value:\n\n${transcript}`;
  
  if (primarySpeakerName) {
    return `${basePrompt}\n\n--- CONTEXT ---\nFocus your analysis specifically on the speech patterns of ${primarySpeakerName}.`;
  }
  return basePrompt;
}

function buildStrategistPrompt(transcript: string, callSummary?: string): string {
  const basePrompt = `Analyze this sales call transcript for strategic alignment. Map every prospect pain to every rep pitch and score the relevance:\n\n${transcript}`;
  
  if (callSummary) {
    return `${basePrompt}\n\n--- CONTEXT ---\nCall Summary: ${callSummary}\n\nUse this to understand the core conversation flow.`;
  }
  return basePrompt;
}

function buildBehaviorPrompt(transcript: string, callSummary?: string): string {
  const basePrompt = `Analyze this sales call transcript for behavioral dynamics and score the rep's performance:\n\n${transcript}`;
  
  if (callSummary) {
    const isDemoCall = callSummary.toLowerCase().includes('demo') || callSummary.toLowerCase().includes('walkthrough');
    const leniencyNote = isDemoCall 
      ? "\n\nNOTE: This summary indicates the call was a 'Demo' or 'Walkthrough'. Be lenient on the Monologue score, as long turns are expected in demos." 
      : "";
    return `${basePrompt}\n\n--- CONTEXT ---\nCall Summary: ${callSummary}${leniencyNote}`;
  }
  return basePrompt;
}

function buildSkepticPrompt(transcript: string, missedOpportunities?: Array<{ pain: string; severity: string; suggested_pitch: string }>): string {
  const basePrompt = `Analyze this sales call transcript. Find the 3-5 most dangerous UNKNOWNS or MISSING INFORMATION that could block this deal:\n\n${transcript}`;
  
  if (missedOpportunities && missedOpportunities.length > 0) {
    const painsList = missedOpportunities.map(o => `- ${o.pain} (${o.severity})`).join('\n');
    return `${basePrompt}\n\n--- CONTEXT ---\nThe rep already missed these specific pains:\n${painsList}\n\nFocus your gap analysis on UNKNOWNS regarding Budget, Authority, and Timeline.`;
  }
  return basePrompt;
}

function buildNegotiatorPrompt(
  transcript: string, 
  competitorNames?: string[], 
  pitchedFeatures?: string[]
): string {
  const basePrompt = `Analyze this sales call transcript for objections and pushback. Identify how the rep handled each moment of friction:\n\n${transcript}`;
  
  const contextParts: string[] = [];
  
  if (competitorNames && competitorNames.length > 0) {
    contextParts.push(`The prospect is evaluating these competitors: ${competitorNames.join(', ')}.`);
  }
  
  if (pitchedFeatures && pitchedFeatures.length > 0) {
    contextParts.push(`The rep pitched these features: ${pitchedFeatures.join(', ')}.`);
  }
  
  if (contextParts.length > 0) {
    return `${basePrompt}\n\n--- CONTEXT ---\n${contextParts.join(' ')}\n\nCheck if the rep handled objections related to these specific vendors or features.`;
  }
  return basePrompt;
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

function buildCoachingInputReport(
  metadata: CallMetadata,
  behavior: MergedBehaviorScore,
  questions: InterrogatorOutput,
  strategy: StrategistOutput,
  gaps: SkepticOutput,
  objections: NegotiatorOutput,
  psychology: ProfilerOutput,
  competitors: SpyOutput
): string {
  return `
## AGENT REPORTS FOR THIS CALL

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
 * Batch 1 (Critical): Census, Historian, Spy
 * Batch 2 (Strategic): Profiler, Strategist, Referee, Interrogator - uses Batch 1 outputs
 * Batch 3 (Deep Dive): Skeptic, Negotiator - uses Batch 1 & 2 outputs
 * Phase 2: Coach - synthesizes all outputs
 */
export async function runAnalysisPipeline(
  transcript: string,
  supabase: SupabaseClient,
  callId: string
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const warnings: string[] = [];

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
  console.log('[Pipeline] Batch 1/3: Running Census, Historian, Spy...');
  const batch1Start = performance.now();

  const [censusResult, historianResult, spyResult] = await Promise.all([
    executeAgent(censusConfig, transcript, supabase, callId),
    executeAgent(historianConfig, transcript, supabase, callId),
    executeAgent(spyConfig, transcript, supabase, callId),
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
  console.log('[Pipeline] Batch 2/2: Running Profiler, Strategist, Referee, Interrogator, Negotiator + Skeptic (async)...');
  const batch2Start = performance.now();

  // Build context-aware prompts
  const profilerPrompt = buildProfilerPrompt(transcript, primaryDecisionMaker?.name);
  const strategistPrompt = buildStrategistPrompt(transcript, callSummary);
  const behaviorPrompt = buildBehaviorPrompt(transcript, callSummary);
  const competitorNames = spyResult.success 
    ? spy.competitive_intel.map(c => c.competitor_name) 
    : undefined;
  const negotiatorPrompt = buildNegotiatorPrompt(transcript, competitorNames, undefined);

  // Fire Skeptic async (non-blocking) - P1 optimization
  // This runs independently and we'll await it before Coach
  const skepticPrompt = buildSkepticPrompt(transcript, undefined); // No context needed for P1
  pendingSkepticResult = executeAgentWithPrompt(skepticConfig, skepticPrompt, supabase, callId);
  console.log('[Pipeline] Skeptic fired async (non-blocking)');

  // Run remaining agents in parallel
  const [profilerResult, strategistResult, refereeResult, interrogatorResult, negotiatorResult] = await Promise.all([
    executeAgentWithPrompt(profilerConfig, profilerPrompt, supabase, callId),
    executeAgentWithPrompt(strategistConfig, strategistPrompt, supabase, callId),
    executeAgentWithPrompt(refereeConfig, behaviorPrompt, supabase, callId),
    executeAgent(interrogatorConfig, transcript, supabase, callId),
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
  console.log(`[Pipeline] Phase 1 (all 3 batches) complete in ${Math.round(phase1Duration)}ms (${warnings.length} warnings)`);

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
    spy
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
    warnings,
    phase1DurationMs: phase1Duration,
    phase2DurationMs: phase2Duration,
    totalDurationMs: totalDuration,
  };
}
