/**
 * Agent Schemas - Single Source of Truth
 * 
 * All Zod schemas for agent outputs are defined here.
 * TypeScript types are inferred from these schemas.
 * JSON tool schemas are auto-generated in agent-registry.ts
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ============= AGENT OUTPUT SCHEMAS =============

// The Census - structured data extraction
export const CensusSchema = z.object({
  logistics: z.object({
    platform: z.string().optional(),
    duration_minutes: z.number(),
    video_on: z.boolean(),
  }),
  participants: z.array(z.object({
    name: z.string(),
    role: z.string(),
    is_decision_maker: z.boolean(),
    sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Skeptical']),
  })),
  user_counts: z.object({
    it_users: z.number().optional().nullable(),
    end_users: z.number().optional().nullable(),
    source_quote: z.string().optional().nullable(),
  }),
});

// The Historian - executive summary
export const HistorianSchema = z.object({
  summary: z.string(),
  key_topics: z.array(z.string()),
});

// The Referee - behavioral scoring
export const RefereeSchema = z.object({
  overall_score: z.number(),
  grade: z.enum(['Pass', 'Fail']),
  metrics: z.object({
    patience: z.object({
      score: z.number(),
      interruption_count: z.number(),
      status: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
      interruptions: z.array(z.object({
        interrupted_speaker: z.string(),
        interrupter: z.string(),
        context: z.string(),
        severity: z.enum(['Minor', 'Moderate', 'Severe']),
      })).optional(),
    }),
    monologue: z.object({
      score: z.number(),
      longest_turn_word_count: z.number(),
      violation_count: z.number(),
    }),
    talk_listen_ratio: z.object({
      score: z.number(),
      rep_talk_percentage: z.number(),
    }),
    next_steps: z.object({
      score: z.number(),
      secured: z.boolean(),
      details: z.string(),
    }),
  }),
});

// The Interrogator - question leverage
export const InterrogatorSchema = z.object({
  score: z.number(),
  explanation: z.string(),
  no_questions_reason: z.enum(['no_discovery_attempted', 'poor_engagement']).nullable().optional(),
  average_question_length: z.number(),
  average_answer_length: z.number(),
  high_leverage_count: z.number(),
  low_leverage_count: z.number(),
  high_leverage_examples: z.array(z.string()),
  low_leverage_examples: z.array(z.string()),
  total_sales_questions: z.number(),
  yield_ratio: z.number(),
});

// The Strategist - pain-to-pitch mapping
export const StrategistSchema = z.object({
  strategic_threading: z.object({
    score: z.number(),
    grade: z.enum(['Pass', 'Fail']),
    strategic_summary: z.string().describe("1-2 sentence TL;DR of strategic alignment quality"),
    score_breakdown: z.object({
      high_pains_addressed: z.number(),
      high_pains_total: z.number(),
      medium_pains_addressed: z.number(),
      medium_pains_total: z.number(),
      spray_and_pray_count: z.number(),
    }),
    relevance_map: z.array(z.object({
      pain_identified: z.string(),
      pain_type: z.enum(['Explicit', 'Implicit']).optional(),
      pain_severity: z.enum(['High', 'Medium', 'Low']).optional(),
      feature_pitched: z.string(),
      is_relevant: z.boolean(),
      reasoning: z.string(),
    })),
    missed_opportunities: z.array(z.object({
      pain: z.string(),
      severity: z.enum(['High', 'Medium']),
      suggested_pitch: z.string(),
      talk_track: z.string().describe("Exact words rep could use to address this pain"),
    })),
  }),
});

// The Skeptic - deal gaps
export const SkepticSchema = z.object({
  critical_gaps: z.array(z.object({
    category: z.enum(['Budget', 'Authority', 'Need', 'Timeline', 'Competition', 'Technical']),
    description: z.string(),
    impact: z.enum(['High', 'Medium', 'Low']),
    suggested_question: z.string(),
  })),
});

// The Negotiator - objection handling
export const NegotiatorSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.enum(['Pass', 'Fail']),
  objections_detected: z.array(z.object({
    objection: z.string(),
    category: z.enum(['Price', 'Competitor', 'Authority', 'Need', 'Timing', 'Feature']),
    rep_response: z.string(),
    handling_rating: z.enum(['Great', 'Okay', 'Bad']),
    coaching_tip: z.string(),
  })),
});

// The Profiler - psychology profile
export const ProfilerSchema = z.object({
  primary_speaker_name: z.string(),
  prospect_persona: z.string(),
  disc_profile: z.enum(['D - Dominance', 'I - Influence', 'S - Steadiness', 'C - Compliance', 'Unknown']),
  evidence_quote: z.string(),
  communication_style: z.object({
    tone: z.string(),
    preference: z.string(),
  }),
  dos_and_donts: z.object({
    do: z.array(z.string()),
    dont: z.array(z.string()),
  }),
  suggested_email_subject: z.string(),
});

// The Spy - competitive intelligence
export const SpySchema = z.object({
  competitive_intel: z.array(z.object({
    competitor_name: z.string(),
    usage_status: z.enum(['Current Vendor', 'Past Vendor', 'Evaluating', 'Mentioned']),
    strengths_mentioned: z.array(z.string()),
    weaknesses_mentioned: z.array(z.string()),
    evidence_quote: z.string().describe("Verbatim quote from transcript proving this competitor intel"),
    competitive_position: z.enum(['Winning', 'Losing', 'Neutral', 'At Risk']).describe("Our position relative to this competitor based on prospect sentiment"),
    positioning_strategy: z.string().describe("1-2 sentences: how to de-position this competitor based on their weakness"),
    silver_bullet_question: z.string(),
    question_timing: z.string().describe("When to use the silver bullet question (e.g., 'Use during demo', 'Save for proposal stage')"),
  })),
});

// The Auditor - pricing discipline / discount analysis
export const AuditorSchema = z.object({
  discounts_offered: z.array(z.object({
    type: z.enum(['Percentage', 'Flat Amount', 'Free Trial Extension', 'Bundle Deal', 'Payment Terms', 'Waived Fee', 'Other']),
    discount_value: z.string().describe("The actual discount (e.g., '15%', '$500', '30 extra days')"),
    context_quote: z.string().describe("What triggered or accompanied this discount offer"),
    timing_assessment: z.enum(['Premature', 'Appropriate', 'Late/Reactive']).describe("When was this discount offered relative to value establishment?"),
    value_established_before: z.boolean().describe("Was ROI/pain established before offering this discount?"),
    prospect_requested: z.boolean().describe("Did the prospect ask for a discount, or was it volunteered?"),
    coaching_note: z.string().describe("Brief coaching feedback on this specific discount offer"),
  })),
  pricing_score: z.number().min(0).max(100).describe("Pricing discipline score 0-100"),
  grade: z.enum(['Pass', 'Fail']).describe("Pass if score >= 60, Fail otherwise"),
  summary: z.string().describe("1-2 sentence assessment of pricing discipline"),
  coaching_tips: z.array(z.string()).max(5).describe("2-3 specific tips for improving pricing discipline"),
});

// The Coach - synthesis
export const CoachSchema = z.object({
  overall_grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  executive_summary: z.string(),
  top_3_strengths: z.array(z.string()),
  top_3_areas_for_improvement: z.array(z.string()),
  primary_focus_area: z.enum(['Discovery Depth', 'Behavioral Polish', 'Closing/Next Steps', 'Objection Handling', 'Strategic Alignment']),
  coaching_prescription: z.string().describe("1-2 sentence punchy diagnosis of the core issue. No markdown, no bullets."),
  coaching_drill: z.string().optional().describe("Detailed roleplay or practice exercise in markdown format."),
  immediate_action: z.string().optional().describe("The single most important action to take TODAY. Starts with a verb."),
  grade_reasoning: z.string(),
});

// The Speaker Labeler - pre-processing agent (compact output format for performance)
export const SpeakerLabelerSchema = z.object({
  line_labels: z.array(z.object({
    line: z.number().describe("1-indexed line number"),
    speaker: z.enum(['REP', 'PROSPECT', 'MANAGER', 'OTHER']),
  })),
  speaker_mapping: z.array(z.object({
    original_name: z.string(),
    role: z.enum(['REP', 'PROSPECT', 'MANAGER', 'OTHER']),
    display_label: z.string(),
  })),
  speaker_count: z.number(),
  detection_confidence: z.enum(['high', 'medium', 'low']),
});

// The Sentinel - call type classifier (Phase 0, runs with Speaker Labeler)
export const SentinelSchema = z.object({
  detected_call_type: z.enum([
    'full_cycle_sales',     // Discovery → Pitch → Pricing → Close attempt
    'reconnect',            // Follow-up meeting, internal feedback discussion
    'group_demo',           // Demo to multiple stakeholders/team
    'technical_deep_dive',  // Heavy Q&A on integration, APIs, security
    'executive_alignment',  // Strategic discussion with decision-maker
    'pricing_negotiation',  // Focus on pricing, discounts, contract terms
    'unknown'               // Cannot reliably classify
  ]),
  confidence: z.enum(['high', 'medium', 'low']),
  detection_signals: z.array(z.string()).max(5).describe("Evidence phrases from transcript supporting classification"),
  user_submitted_type_match: z.boolean().optional().describe("Whether AI classification matches user-submitted call type"),
  scoring_hints: z.object({
    discovery_expectation: z.enum(['heavy', 'moderate', 'light', 'none']).describe("How much new discovery should we expect?"),
    monologue_tolerance: z.enum(['strict', 'moderate', 'lenient']).describe("How forgiving on long rep turns?"),
    talk_ratio_ideal: z.number().min(20).max(70).describe("Target rep talk % for this call type"),
  }),
});

// ============= INFERRED TYPES =============

export type CensusOutput = z.infer<typeof CensusSchema>;
export type HistorianOutput = z.infer<typeof HistorianSchema>;
export type RefereeOutput = z.infer<typeof RefereeSchema>;
export type InterrogatorOutput = z.infer<typeof InterrogatorSchema>;
export type StrategistOutput = z.infer<typeof StrategistSchema>;
export type SkepticOutput = z.infer<typeof SkepticSchema>;
export type NegotiatorOutput = z.infer<typeof NegotiatorSchema>;
export type ProfilerOutput = z.infer<typeof ProfilerSchema>;
export type SpyOutput = z.infer<typeof SpySchema>;
export type AuditorOutput = z.infer<typeof AuditorSchema>;
export type CoachOutput = z.infer<typeof CoachSchema>;
export type SpeakerLabelerOutput = z.infer<typeof SpeakerLabelerSchema>;
export type SentinelOutput = z.infer<typeof SentinelSchema>;

// ============= COMBINED TYPES FOR BACKWARD COMPATIBILITY =============

// Merged metadata (Census + Historian)
export interface CallMetadata {
  summary: string;
  topics: string[];
  logistics: CensusOutput['logistics'];
  participants: CensusOutput['participants'];
  user_counts: CensusOutput['user_counts'];
}

// Merged behavior (Referee + Interrogator)
export interface MergedBehaviorScore extends Omit<RefereeOutput, 'metrics'> {
  metrics: RefereeOutput['metrics'] & {
    question_quality: InterrogatorOutput;
  };
}

// Full strategy audit (Strategist + Skeptic + Negotiator + Spy)
export interface StrategyAudit {
  strategic_threading: StrategistOutput['strategic_threading'];
  critical_gaps: SkepticOutput['critical_gaps'];
  objection_handling: NegotiatorOutput;
  competitive_intel: SpyOutput['competitive_intel'];
}

// ============= COACHING INPUTS =============

export interface CoachingInputs {
  metadata: CallMetadata | null;
  behavior: RefereeOutput | null;
  questions: InterrogatorOutput | null;
  strategy: StrategistOutput | null;
  gaps: SkepticOutput | null;
  objections: { objection_handling: NegotiatorOutput } | null;
  psychology: ProfilerOutput | null;
  competitors: SpyOutput | null;
}
