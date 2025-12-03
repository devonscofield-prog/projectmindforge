import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ==================== Common Schemas ====================

export const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format"
});

export const emailSchema = z.string().email({ message: "Invalid email address" });

export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0)
});

// ==================== Account Research ====================

export const accountResearchSchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(200),
  website: z.string().url("Invalid website URL").optional(),
  industry: z.string().max(100).optional(),
  stakeholders: z.array(
    z.object({
      name: z.string().min(1).max(100),
      title: z.string().max(100).optional()
    })
  ).max(20, "Maximum 20 stakeholders allowed").optional(),
  additional_context: z.string().max(2000, "Context too long (max 2000 chars)").optional(),
  product_pitch: z.string().max(1000, "Pitch too long (max 1000 chars)").optional(),
  deal_stage: z.enum([
    'initial_contact',
    'discovery',
    'demo_scheduled',
    'proposal_sent',
    'negotiation',
    'closed_won',
    'closed_lost'
  ]).optional()
});

export type AccountResearchRequest = z.infer<typeof accountResearchSchema>;

// ==================== Admin Transcript Chat ====================

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1, "Message content cannot be empty").max(50000, "Message too long")
});

export const adminTranscriptChatSchema = z.object({
  transcript_ids: z.array(uuidSchema).min(1, "At least one transcript required").max(50, "Maximum 50 transcripts allowed"),
  messages: z.array(chatMessageSchema).min(1, "At least one message required").max(100, "Too many messages in conversation"),
  analysis_mode: z.enum([
    'coaching',
    'deal_health',
    'competitive_intel',
    'custom'
  ]).optional().default('coaching'),
  use_rag: z.boolean().optional().default(true),
  session_id: uuidSchema.optional()
});

export type AdminTranscriptChatRequest = z.infer<typeof adminTranscriptChatSchema>;

// ==================== Sales Coach Chat ====================

export const salesCoachChatSchema = z.object({
  prospect_id: uuidSchema,
  messages: z.array(chatMessageSchema).min(1, "At least one message required").max(50, "Too many messages")
});

export type SalesCoachChatRequest = z.infer<typeof salesCoachChatSchema>;

// ==================== Generate Account Follow-Ups ====================

export const generateAccountFollowUpsSchema = z.object({
  prospect_id: uuidSchema,
  call_ids: z.array(uuidSchema).min(1, "At least one call required").max(20, "Maximum 20 calls allowed")
});

export type GenerateAccountFollowUpsRequest = z.infer<typeof generateAccountFollowUpsSchema>;

// ==================== Regenerate Account Insights ====================

export const regenerateAccountInsightsSchema = z.object({
  prospect_id: uuidSchema
});

export type RegenerateAccountInsightsRequest = z.infer<typeof regenerateAccountInsightsSchema>;

// ==================== Edit Recap Email ====================

export const editRecapEmailSchema = z.object({
  original_recap_email_draft: z.string().min(10, "Email draft too short").max(10000, "Email draft too long"),
  edit_instructions: z.string().min(1, "Edit instructions required").max(500, "Instructions too long"),
  call_summary: z.string().max(2000, "Call summary too long").optional().nullable()
});

export type EditRecapEmailRequest = z.infer<typeof editRecapEmailSchema>;

// ==================== Analyze Call ====================

export const analyzeCallSchema = z.object({
  transcript_id: uuidSchema
});

export type AnalyzeCallRequest = z.infer<typeof analyzeCallSchema>;

// ==================== Chunk Transcripts ====================

export const chunkTranscriptsSchema = z.object({
  transcript_ids: z.array(uuidSchema).min(1, "At least one transcript required").max(100, "Maximum 100 transcripts allowed")
});

export type ChunkTranscriptsRequest = z.infer<typeof chunkTranscriptsSchema>;

// ==================== Coaching Trends ====================

const frameworkScoresSchema = z.object({
  // MEDDPICC (new primary framework)
  meddpicc: z.object({
    overall_score: z.number().min(0).max(100),
    summary: z.string()
  }).optional(),
  // BANT (legacy - kept for backward compatibility)
  bant: z.object({
    score: z.number().min(0).max(100),
    summary: z.string()
  }).optional(),
  gap_selling: z.object({
    score: z.number().min(0).max(100),
    summary: z.string()
  }),
  active_listening: z.object({
    score: z.number().min(0).max(100),
    summary: z.string()
  })
}).nullable();

const criticalInfoItemSchema = z.union([
  z.string(),
  z.object({
    info: z.string(),
    missed_opportunity: z.string()
  })
]);

const followUpQuestionSchema = z.union([
  z.string(),
  z.object({
    question: z.string(),
    timing_example: z.string()
  })
]);

export const callDataSchema = z.object({
  date: dateStringSchema,
  framework_scores: frameworkScoresSchema,
  meddpicc_improvements: z.array(z.string()).optional(), // New
  bant_improvements: z.array(z.string()).optional(), // Legacy
  gap_selling_improvements: z.array(z.string()),
  active_listening_improvements: z.array(z.string()),
  critical_info_missing: z.array(criticalInfoItemSchema),
  follow_up_questions: z.array(followUpQuestionSchema),
  heat_score: z.number().min(1).max(10).nullable()
});

export const chunkSummarySchema = z.object({
  chunkIndex: z.number().int().nonnegative(),
  dateRange: z.object({
    from: dateStringSchema,
    to: dateStringSchema
  }),
  callCount: z.number().int().positive(),
  avgScores: z.object({
    meddpicc: z.number().min(0).max(100).nullable().optional(), // New
    bant: z.number().min(0).max(100).nullable().optional(), // Legacy
    gapSelling: z.number().min(0).max(100).nullable(),
    activeListening: z.number().min(0).max(100).nullable(),
    heat: z.number().min(1).max(10).nullable()
  }),
  dominantTrends: z.object({
    meddpicc: z.enum(['improving', 'stable', 'declining']).optional(), // New
    bant: z.enum(['improving', 'stable', 'declining']).optional(), // Legacy
    gapSelling: z.enum(['improving', 'stable', 'declining']),
    activeListening: z.enum(['improving', 'stable', 'declining'])
  }),
  topMissingInfo: z.array(z.string()),
  topImprovementAreas: z.array(z.string()),
  keyObservations: z.array(z.string())
});

export const directAnalysisSchema = z.object({
  calls: z.array(callDataSchema).min(1, "At least one call required").max(500, "Too many calls"),
  dateRange: z.object({
    from: dateStringSchema,
    to: dateStringSchema
  }),
  hierarchicalMode: z.literal(false).optional()
});

export const hierarchicalAnalysisSchema = z.object({
  hierarchicalMode: z.literal(true),
  chunkSummaries: z.array(chunkSummarySchema).min(1, "At least one chunk summary required").max(50, "Too many chunks"),
  dateRange: z.object({
    from: dateStringSchema,
    to: dateStringSchema
  }),
  totalCalls: z.number().int().positive()
});

export const generateCoachingTrendsSchema = z.union([
  directAnalysisSchema,
  hierarchicalAnalysisSchema
]);

export type GenerateCoachingTrendsRequest = z.infer<typeof generateCoachingTrendsSchema>;

// ==================== Coaching Chunk Summary ====================

export const generateCoachingChunkSummarySchema = z.object({
  calls: z.array(callDataSchema).min(1, "At least one call required").max(100, "Too many calls in chunk"),
  chunkIndex: z.number().int().nonnegative(),
  dateRange: z.object({
    from: dateStringSchema,
    to: dateStringSchema
  })
});

export type GenerateCoachingChunkSummaryRequest = z.infer<typeof generateCoachingChunkSummarySchema>;

// ==================== Validation Helpers ====================

export interface ValidationResult<T> {
  success: true;
  data: T;
}

export interface ValidationError {
  success: false;
  error: {
    message: string;
    issues?: Array<{
      path: string[];
      message: string;
    }>;
  };
}

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> | ValidationError {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    error: {
      message: "Validation failed",
      issues: result.error.errors.map(err => ({
        path: err.path.map(String),
        message: err.message
      }))
    }
  };
}

export function createValidationErrorResponse(
  validation: ValidationError,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify(validation.error),
    { 
      status: 400, 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json' 
      } 
    }
  );
}
