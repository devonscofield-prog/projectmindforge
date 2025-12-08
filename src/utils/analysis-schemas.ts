import { z } from 'zod';

// --- 1. THE CLERK (Metadata & Facts) ---
export const CallMetadataSchema = z.object({
  summary: z.string().describe("A concise 2-3 sentence executive summary of the call."),
  topics: z.array(z.string()).describe("List of high-level topics discussed (e.g., 'Pricing', 'SSO', 'Phishing')."),
  logistics: z.object({
    platform: z.string().optional(),
    duration_minutes: z.number(),
    video_on: z.boolean(),
  }),
  participants: z.array(z.object({
    name: z.string(),
    role: z.string().describe("Job title or inferred role"),
    is_decision_maker: z.boolean(),
    sentiment: z.enum(['Positive', 'Neutral', 'Negative', 'Skeptical']),
  })),
  user_counts: z.object({
    it_users: z.number().optional().nullable().describe("Number of IT staff mentioned"),
    end_users: z.number().optional().nullable().describe("Number of general employees mentioned"),
    source_quote: z.string().optional().nullable().describe("The exact quote where these numbers were mentioned"),
  }),
});

export type CallMetadata = z.infer<typeof CallMetadataSchema>;

// --- 2. THE REFEREE (Behavioral Math) ---
export const BehaviorScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  grade: z.enum(['Pass', 'Fail']),
  metrics: z.object({
    patience: z.object({
      score: z.number().min(0).max(30),
      interruption_count: z.number(),
      status: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
      interruptions: z.array(z.object({
        interrupted_speaker: z.string().describe("Who was cut off"),
        interrupter: z.string().describe("Who interrupted"),
        context: z.string().describe("Brief description of what was being said"),
        severity: z.enum(['Minor', 'Moderate', 'Severe']).describe("Minor = brief overlap, Moderate = cut off mid-thought, Severe = repeated pattern"),
      })).optional().describe("List of interruption instances detected"),
    }),
    question_quality: z.object({
      score: z.number().min(0).max(20),
      explanation: z.string().describe("Brief note on question leverage effectiveness."),
      // Question Leverage Metrics
      average_question_length: z.number().describe("Average word count of Rep's questions"),
      average_answer_length: z.number().describe("Average word count of Prospect's immediate answers"),
      high_leverage_count: z.number().describe("Count of questions that triggered long answers"),
      low_leverage_count: z.number().describe("Count of questions that triggered 1-word answers"),
      high_leverage_examples: z.array(z.string()).describe("List of 2-3 specific questions from the call that triggered long, detailed answers."),
      low_leverage_examples: z.array(z.string()).describe("List of 2-3 specific questions that were closed-ended, leading, or resulted in 1-word answers."),
      // Additional metrics from Interrogator agent
      total_sales_questions: z.number().optional().describe("Total number of qualifying sales questions found"),
      yield_ratio: z.number().optional().describe("Calculated ratio: average_answer_length / average_question_length"),
    }),
    monologue: z.object({
      score: z.number().min(0).max(20),
      longest_turn_word_count: z.number(),
      violation_count: z.number().describe("Number of turns exceeding the limit"),
    }),
    talk_listen_ratio: z.object({
      score: z.number().min(0).max(15),
      rep_talk_percentage: z.number(),
    }),
    next_steps: z.object({
      score: z.number().min(0).max(15),
      secured: z.boolean(),
      details: z.string().describe("The specific next step found, or 'None'"),
    }),
  }),
});

export type BehaviorScore = z.infer<typeof BehaviorScoreSchema>;

// --- 3a. Objection Handling (standalone for validation) ---
export const ObjectionHandlingSchema = z.object({
  score: z.number().min(0).max(100),
  grade: z.enum(['Pass', 'Fail']),
  objections_detected: z.array(z.object({
    objection: z.string().describe("The prospect's specific objection (e.g., 'Too expensive')"),
    category: z.enum(['Price', 'Competitor', 'Authority', 'Need', 'Timing', 'Feature']),
    rep_response: z.string().describe("Summary of how the rep answered"),
    handling_rating: z.enum(['Great', 'Okay', 'Bad']),
    coaching_tip: z.string().describe("Specific feedback on this interaction"),
  })),
});

export type ObjectionHandlingData = z.infer<typeof ObjectionHandlingSchema>;

// --- 3b. THE AUDITOR (Strategy & Logic) ---
export const StrategyAuditSchema = z.object({
  strategic_threading: z.object({
    score: z.number().min(0).max(100),
    grade: z.enum(['Pass', 'Fail']),
    strategic_summary: z.string().optional().describe("1-2 sentence TL;DR of strategic alignment quality"),
    score_breakdown: z.object({
      high_pains_addressed: z.number(),
      high_pains_total: z.number(),
      medium_pains_addressed: z.number().optional(),
      medium_pains_total: z.number().optional(),
      spray_and_pray_count: z.number(),
    }).optional().describe("Breakdown of how the score was calculated"),
    relevance_map: z.array(z.object({
      pain_identified: z.string().describe("The specific need/pain quoted from the prospect"),
      pain_type: z.enum(['Explicit', 'Implicit']).optional().describe("Whether pain was directly stated or inferred from context"),
      pain_severity: z.enum(['High', 'Medium', 'Low']).optional().describe("Business impact severity of the pain"),
      feature_pitched: z.string().describe("The feature the rep pitched in response"),
      is_relevant: z.boolean(),
      reasoning: z.string().describe("Why this was a strategic match or mismatch"),
    })),
    // Enhanced missed opportunities with actionable talk tracks
    missed_opportunities: z.array(z.union([
      z.string(), // Legacy: simple strings
      z.object({  // New: structured with talk tracks
        pain: z.string(),
        severity: z.enum(['High', 'Medium']),
        suggested_pitch: z.string(),
        talk_track: z.string().describe("Exact words rep could use to address this pain"),
      })
    ])).describe("Pains mentioned that were ignored - either strings or structured objects"),
  }),
  // Required fields from pipeline (merged from Skeptic and Negotiator agents)
  critical_gaps: z.array(z.object({
    category: z.enum(['Budget', 'Authority', 'Need', 'Timeline', 'Competition', 'Technical']),
    description: z.string().describe("Specific description of what is missing in this deal"),
    impact: z.enum(['High', 'Medium', 'Low']),
    suggested_question: z.string().describe("The exact question the rep should ask to close this gap"),
  })).describe("3-5 critical pieces of information blocking the deal."),
  objection_handling: ObjectionHandlingSchema,
  // Competitive intelligence from Spy agent
  competitive_intel: z.array(z.object({
    competitor_name: z.string().describe("Name of the competitor, vendor, or 'Status Quo' for internal solutions"),
    usage_status: z.enum(['Current Vendor', 'Past Vendor', 'Evaluating', 'Mentioned']),
    strengths_mentioned: z.array(z.string()).describe("Positive things said about the competitor"),
    weaknesses_mentioned: z.array(z.string()).describe("Negative things said about the competitor"),
    evidence_quote: z.string().optional().describe("Verbatim quote from transcript proving this competitor intel"),
    competitive_position: z.enum(['Winning', 'Losing', 'Neutral', 'At Risk']).optional().describe("Our position relative to this competitor"),
    positioning_strategy: z.string().optional().describe("1-2 sentences: how to de-position this competitor"),
    silver_bullet_question: z.string().describe("A specific 'Trap Setting' question to de-position this competitor"),
    question_timing: z.string().optional().describe("When to use the silver bullet question"),
  })).optional().describe("Competitive intelligence gathered from the call"),
});

export type StrategyAudit = z.infer<typeof StrategyAuditSchema>;

// --- 4. THE COPYWRITER (Sales Assets) ---
export const SalesAssetsSchema = z.object({
  recap_email: z.object({
    subject_line: z.string().describe("Email subject line"),
    body_html: z.string().describe("HTML formatted email body"),
  }),
  internal_notes_markdown: z.string().describe("CRM-ready internal notes in markdown format"),
});

export type SalesAssets = z.infer<typeof SalesAssetsSchema>;

// --- 5. DEAL HEAT (Deal Temperature Analysis) ---
export const DealHeatSchema = z.object({
  heat_score: z.number().min(0).max(100).describe("Overall deal heat score 0-100"),
  temperature: z.enum(['Hot', 'Warm', 'Lukewarm', 'Cold']).describe("Deal temperature category"),
  trend: z.enum(['Heating Up', 'Cooling Down', 'Stagnant']).describe("Direction the deal is trending"),
  key_factors: z.array(z.object({
    factor: z.string().describe("The factor influencing deal heat (e.g., 'Urgency', 'Authority', 'Budget')"),
    impact: z.enum(['Positive', 'Negative']).describe("Whether this factor helps or hurts the deal"),
    reasoning: z.string().describe("Brief explanation of why this factor has this impact"),
  })).describe("Key factors influencing the deal temperature"),
  winning_probability: z.string().describe("Estimated probability of winning (e.g., 'Low (20%)', 'Medium (50%)')"),
  recommended_action: z.string().describe("The single most important action to take next"),
  estimated_close_date: z.string().describe("Best guess timeframe (e.g., 'Q1 2024', 'End of Jan', 'Late 2025'). Return 'Unknown' if no evidence."),
  close_date_evidence: z.string().describe("The specific quote or logic used to derive this date."),
});

export type DealHeat = z.infer<typeof DealHeatSchema>;

// --- 6. THE PSYCHOLOGIST (Prospect Profiling) ---
export const PsychologyProfileSchema = z.object({
  primary_speaker_name: z.string().describe("Name of the person being profiled (the dominant buying voice)"),
  prospect_persona: z.string().describe("Archetype (e.g., 'The Data-Driven Skeptic', 'The Busy Executive')"),
  disc_profile: z.enum(['D - Dominance', 'I - Influence', 'S - Steadiness', 'C - Compliance', 'Unknown']).describe("Estimated DISC profile based on speech patterns"),
  evidence_quote: z.string().describe("The specific quote or behavior that revealed this profile"),
  communication_style: z.object({
    tone: z.string().describe("e.g., 'Formal', 'Casual', 'Urgent'"),
    preference: z.string().describe("e.g., 'Wants bullet points and ROI', 'Wants rapport and stories'"),
  }),
  dos_and_donts: z.object({
    do: z.array(z.string()).describe("2-3 specific communication tactics to use"),
    dont: z.array(z.string()).describe("2-3 specific tactics to avoid (e.g., 'Don't use fluff')"),
  }),
  suggested_email_subject: z.string().describe("Subject line tailored to this persona for follow-up email"),
});

export type PsychologyProfile = z.infer<typeof PsychologyProfileSchema>;

// --- 8. THE SPY (Competitive Intelligence) ---
export const CompetitiveIntelSchema = z.object({
  competitive_intel: z.array(z.object({
    competitor_name: z.string().describe("Name of the competitor, vendor, or 'Status Quo' for internal solutions"),
    usage_status: z.enum(['Current Vendor', 'Past Vendor', 'Evaluating', 'Mentioned']),
    strengths_mentioned: z.array(z.string()).describe("Positive things said about the competitor"),
    weaknesses_mentioned: z.array(z.string()).describe("Negative things said about the competitor"),
    evidence_quote: z.string().describe("Verbatim quote from transcript proving this competitor intel"),
    competitive_position: z.enum(['Winning', 'Losing', 'Neutral', 'At Risk']).describe("Our position relative to this competitor"),
    positioning_strategy: z.string().describe("1-2 sentences: how to de-position this competitor based on their weakness"),
    silver_bullet_question: z.string().describe("A specific 'Trap Setting' question to de-position this competitor"),
    question_timing: z.string().describe("When to use the silver bullet question"),
  })),
});

export type CompetitiveIntel = z.infer<typeof CompetitiveIntelSchema>;

// --- 7. THE COACH (Coaching Synthesis) ---
export const CoachingSynthesisSchema = z.object({
  overall_grade: z.enum(['A+', 'A', 'B', 'C', 'D', 'F']),
  executive_summary: z.string().describe("A 2-sentence Manager's summary of the rep's performance."),
  
  // The Prioritization Engine
  top_3_strengths: z.array(z.string()),
  top_3_areas_for_improvement: z.array(z.string()),
  
  // The "One Big Thing" (Highest Priority)
  primary_focus_area: z.enum(['Discovery Depth', 'Behavioral Polish', 'Closing/Next Steps', 'Objection Handling', 'Strategic Alignment']),
  coaching_prescription: z.string().describe("The specific actionable advice to fix the primary focus area."),
  
  // The "why" behind the grade
  grade_reasoning: z.string()
});

export type CoachingSynthesis = z.infer<typeof CoachingSynthesisSchema>;
