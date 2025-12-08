/**
 * Analysis Pipeline Orchestrator
 * 
 * Runs agents in phases and merges results for storage.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { 
  getAgent, 
  getPhase1Agents, 
  AgentConfig 
} from './agent-registry.ts';
import { executeAgent, executeAgentsInParallel, AgentResult } from './agent-factory.ts';
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
  CoachingInputs,
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
- Missed Opportunities: ${strategy.strategic_threading.missed_opportunities?.join(', ') || 'None'}

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

// ============= MAIN PIPELINE =============

/**
 * Run the full analysis pipeline
 * Phase 1: Run all agents in parallel (except Coach)
 * Phase 2: Run The Coach with aggregated inputs
 */
export async function runAnalysisPipeline(
  transcript: string,
  supabase: SupabaseClient,
  callId: string
): Promise<PipelineResult> {
  const pipelineStart = performance.now();
  const warnings: string[] = [];

  // ============= PHASE 1: Parallel Agents =============
  console.log('[Pipeline] Phase 1: Running 9 agents in parallel...');
  const phase1Start = performance.now();

  const phase1Agents = getPhase1Agents();
  const phase1Results = await executeAgentsInParallel(phase1Agents, transcript, supabase, callId);

  // Process results with critical agent checking
  const getResult = <T>(id: string): { data: T; success: boolean } => {
    const result = phase1Results.get(id) as AgentResult<T> | undefined;
    if (!result) {
      throw new Error(`Missing result for agent: ${id}`);
    }
    return { data: result.data, success: result.success };
  };

  // Check critical agents
  const censusResult = getResult<CensusOutput>('census');
  if (!censusResult.success) {
    throw new Error(`Critical agent 'Census' failed: ${phase1Results.get('census')?.error}`);
  }

  const historianResult = getResult<HistorianOutput>('historian');
  if (!historianResult.success) {
    throw new Error(`Critical agent 'Historian' failed: ${phase1Results.get('historian')?.error}`);
  }

  // Get non-critical results with warnings
  const refereeResult = getResult<RefereeOutput>('referee');
  if (!refereeResult.success) warnings.push(`Behavior analysis failed: ${phase1Results.get('referee')?.error}`);

  const interrogatorResult = getResult<InterrogatorOutput>('interrogator');
  if (!interrogatorResult.success) warnings.push(`Question analysis failed: ${phase1Results.get('interrogator')?.error}`);

  const strategistResult = getResult<StrategistOutput>('strategist');
  if (!strategistResult.success) warnings.push(`Strategy analysis failed: ${phase1Results.get('strategist')?.error}`);

  const skepticResult = getResult<SkepticOutput>('skeptic');
  if (!skepticResult.success) warnings.push(`Deal gaps analysis failed: ${phase1Results.get('skeptic')?.error}`);

  const negotiatorResult = getResult<NegotiatorOutput>('negotiator');
  if (!negotiatorResult.success) warnings.push(`Objection handling analysis failed: ${phase1Results.get('negotiator')?.error}`);

  const profilerResult = getResult<ProfilerOutput>('profiler');
  if (!profilerResult.success) warnings.push(`Psychology profiling failed: ${phase1Results.get('profiler')?.error}`);

  const spyResult = getResult<SpyOutput>('spy');
  if (!spyResult.success) warnings.push(`Competitive intelligence failed: ${phase1Results.get('spy')?.error}`);

  const phase1Duration = performance.now() - phase1Start;
  console.log(`[Pipeline] Phase 1 complete in ${Math.round(phase1Duration)}ms (${warnings.length} warnings)`);

  // ============= MERGE PHASE 1 RESULTS =============
  const metadata = mergeCallMetadata(censusResult.data, historianResult.data);
  const behavior = mergeBehaviorWithQuestions(refereeResult.data, interrogatorResult.data);
  const strategy = mergeStrategy(
    strategistResult.data, 
    skepticResult.data, 
    negotiatorResult.data, 
    spyResult.data
  );

  console.log(`[Pipeline] Scores - Behavior: ${behavior.overall_score} (base: ${refereeResult.data.overall_score}, questions: ${interrogatorResult.data.score}), Threading: ${strategy.strategic_threading.score}, Critical Gaps: ${strategy.critical_gaps.length}`);

  // ============= PHASE 2: The Coach =============
  console.log('[Pipeline] Phase 2: Running The Coach (synthesis agent)...');
  const phase2Start = performance.now();

  const coachConfig = getAgent('coach');
  if (!coachConfig) {
    throw new Error('Coach agent not found in registry');
  }

  // Build coaching input report
  const coachingReport = buildCoachingInputReport(
    metadata,
    behavior,
    interrogatorResult.data,
    strategistResult.data,
    skepticResult.data,
    negotiatorResult.data,
    profilerResult.data,
    spyResult.data
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
    psychology: profilerResult.data,
    coaching: coachResult.data,
    warnings,
    phase1DurationMs: phase1Duration,
    phase2DurationMs: phase2Duration,
    totalDurationMs: totalDuration,
  };
}
