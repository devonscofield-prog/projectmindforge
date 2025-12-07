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
    it_users: z.number().nullable().describe("Number of IT staff mentioned"),
    end_users: z.number().nullable().describe("Number of general employees mentioned"),
    source_quote: z.string().nullable().describe("The exact quote where these numbers were mentioned"),
  }),
});

export type CallMetadata = z.infer<typeof CallMetadataSchema>;

// --- 2. THE REFEREE (Behavioral Math) ---
export const BehaviorScoreSchema = z.object({
  overall_score: z.number().min(0).max(100),
  grade: z.enum(['Pass', 'Fail']),
  coaching_tip: z.string().describe("One high-impact behavioral tip based on the lowest metric."),
  metrics: z.object({
    patience: z.object({
      score: z.number().min(0).max(30),
      interruption_count: z.number(),
      status: z.enum(['Excellent', 'Good', 'Fair', 'Poor']),
    }),
    question_quality: z.object({
      score: z.number().min(0).max(20),
      open_ended_count: z.number(),
      closed_count: z.number(),
      explanation: z.string().describe("Brief note on question types used."),
      open_ended_questions: z.array(z.string()).optional().describe("List of open-ended questions the rep asked"),
      closed_questions: z.array(z.string()).optional().describe("List of closed questions the rep asked"),
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

// --- 3. THE AUDITOR (Strategy & Logic) ---
export const StrategyAuditSchema = z.object({
  strategic_threading: z.object({
    score: z.number().min(0).max(100),
    grade: z.enum(['Pass', 'Fail']),
    relevance_map: z.array(z.object({
      pain_identified: z.string().describe("The specific need/pain quoted from the prospect"),
      feature_pitched: z.string().describe("The feature the rep pitched in response"),
      is_relevant: z.boolean(),
      reasoning: z.string().describe("Why this was a strategic match or mismatch"),
    })),
    missed_opportunities: z.array(z.string()).describe("Pains mentioned that were ignored"),
  }),
  meddpicc: z.object({
    overall_score: z.number().min(0).max(100),
    breakdown: z.object({
      metrics: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      economic_buyer: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      decision_criteria: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      decision_process: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      paper_process: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      implicate_pain: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      champion: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
      competition: z.object({ score: z.number(), evidence: z.string().nullable(), missing_info: z.string().nullable() }),
    }),
  }),
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
