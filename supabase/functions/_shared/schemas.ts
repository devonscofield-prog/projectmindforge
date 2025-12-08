import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// ==================== Security Constants ====================

// Maximum lengths for user-generated content
const MAX_TRANSCRIPT_LENGTH = 500_000; // 500KB - large transcripts
const MAX_CHAT_MESSAGE_LENGTH = 50_000; // 50KB per message
const MAX_EMAIL_BODY_LENGTH = 100_000; // 100KB for emails
const MAX_SHORT_TEXT_LENGTH = 500; // Short inputs like instructions
const MAX_MEDIUM_TEXT_LENGTH = 5_000; // Medium inputs like descriptions
const MAX_LONG_TEXT_LENGTH = 50_000; // Long inputs like email drafts

// Patterns for detecting potential injection attempts
const SCRIPT_INJECTION_PATTERN = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_PATTERN = /\bon\w+\s*=/gi;
const SQL_INJECTION_KEYWORDS = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE|EXEC)\b.*\b(FROM|INTO|WHERE|TABLE|DATABASE)\b)/gi;

// ==================== Sanitization Utilities ====================

/**
 * Sanitizes user input by removing potentially dangerous content
 * while preserving legitimate text content
 */
export function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // Remove script tags (for any HTML that might be rendered)
  sanitized = sanitized.replace(SCRIPT_INJECTION_PATTERN, '[REMOVED]');
  
  // Remove event handlers
  sanitized = sanitized.replace(EVENT_HANDLER_PATTERN, '[REMOVED]=');
  
  // Normalize whitespace (collapse multiple spaces/newlines but preserve structure)
  sanitized = sanitized.replace(/[\t\r]+/g, ' ');
  
  return sanitized.trim();
}

/**
 * Validates that content doesn't contain suspicious patterns
 * Returns validation result with specific warning if detected
 */
export function detectSuspiciousPatterns(input: string): { safe: boolean; warning?: string } {
  if (SQL_INJECTION_KEYWORDS.test(input)) {
    return { safe: false, warning: 'Content contains SQL-like patterns that may indicate injection attempt' };
  }
  
  // Check for excessive special characters that might indicate encoded attacks
  const specialCharRatio = (input.match(/[<>{}[\]\\]/g) || []).length / Math.max(input.length, 1);
  if (specialCharRatio > 0.3) {
    return { safe: false, warning: 'Content contains suspicious character patterns' };
  }
  
  return { safe: true };
}

// ==================== Common Schemas ====================

export const uuidSchema = z.string().uuid({ message: "Invalid UUID format" });

export const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
  message: "Date must be in YYYY-MM-DD format"
});

export const emailSchema = z.string().email({ message: "Invalid email address" }).max(255);

export const paginationSchema = z.object({
  limit: z.number().int().positive().max(100).optional().default(50),
  offset: z.number().int().nonnegative().optional().default(0)
});

// Sanitized string schemas for user content
export const sanitizedShortTextSchema = z.string()
  .min(1, "Text cannot be empty")
  .max(MAX_SHORT_TEXT_LENGTH, `Text too long (max ${MAX_SHORT_TEXT_LENGTH} chars)`)
  .transform(sanitizeUserInput);

export const sanitizedMediumTextSchema = z.string()
  .min(1, "Text cannot be empty")
  .max(MAX_MEDIUM_TEXT_LENGTH, `Text too long (max ${MAX_MEDIUM_TEXT_LENGTH} chars)`)
  .transform(sanitizeUserInput);

export const sanitizedLongTextSchema = z.string()
  .min(1, "Text cannot be empty")
  .max(MAX_LONG_TEXT_LENGTH, `Text too long (max ${MAX_LONG_TEXT_LENGTH} chars)`)
  .transform(sanitizeUserInput);

export const transcriptTextSchema = z.string()
  .min(100, "Transcript too short (min 100 chars)")
  .max(MAX_TRANSCRIPT_LENGTH, `Transcript too long (max ${MAX_TRANSCRIPT_LENGTH} chars)`)
  .transform(sanitizeUserInput);

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
  content: z.string()
    .min(1, "Message content cannot be empty")
    .max(MAX_CHAT_MESSAGE_LENGTH, `Message too long (max ${MAX_CHAT_MESSAGE_LENGTH} chars)`)
    .transform(sanitizeUserInput)
    .refine(
      (val) => detectSuspiciousPatterns(val).safe,
      (val) => ({ message: detectSuspiciousPatterns(val).warning || 'Suspicious content detected' })
    )
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
  original_recap_email_draft: z.string()
    .min(10, "Email draft too short")
    .max(MAX_EMAIL_BODY_LENGTH, `Email draft too long (max ${MAX_EMAIL_BODY_LENGTH} chars)`)
    .transform(sanitizeUserInput),
  edit_instructions: sanitizedShortTextSchema,
  call_summary: z.string()
    .max(MAX_MEDIUM_TEXT_LENGTH, `Call summary too long (max ${MAX_MEDIUM_TEXT_LENGTH} chars)`)
    .transform(sanitizeUserInput)
    .optional()
    .nullable()
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

// ==================== Bulk Upload Transcripts ====================

export const bulkTranscriptItemSchema = z.object({
  fileName: z.string().min(1, "File name required").max(255, "File name too long"),
  rawText: transcriptTextSchema,
  repId: uuidSchema,
  callDate: dateStringSchema.optional(),
  callType: z.string().max(50).optional(),
  callTypeOther: z.string().max(100).transform(sanitizeUserInput).optional(),
  accountName: z.string().max(200).transform(sanitizeUserInput).optional(),
  stakeholderName: z.string().max(200).transform(sanitizeUserInput).optional(),
  salesforceLink: z.string().url("Invalid Salesforce URL").max(500).optional().or(z.literal(''))
});

export const bulkUploadTranscriptsSchema = z.object({
  transcripts: z.array(bulkTranscriptItemSchema)
    .min(1, "At least one transcript required")
    .max(100, "Maximum 100 transcripts per upload"),
  processingMode: z.enum(['analyze', 'index_only']).optional().default('analyze')
});

export type BulkUploadTranscriptsRequest = z.infer<typeof bulkUploadTranscriptsSchema>;

// ==================== Generate Sales Assets ====================

export const generateSalesAssetsSchema = z.object({
  transcript: transcriptTextSchema,
  strategic_context: z.object({
    strategic_threading: z.object({
      relevance_map: z.array(z.object({
        pain_identified: z.string(),
        feature_pitched: z.string(),
        is_relevant: z.boolean(),
        reasoning: z.string()
      })).optional(),
      missed_opportunities: z.array(z.string()).optional()
    }).optional(),
    critical_gaps: z.array(z.object({
      category: z.string(),
      description: z.string(),
      impact: z.string(),
      suggested_question: z.string()
    })).optional()
  }).optional(),
  psychology_context: z.object({
    prospect_persona: z.string().optional(),
    disc_profile: z.string().optional(),
    communication_style: z.object({
      tone: z.string().optional(),
      preference: z.string().optional()
    }).optional(),
    dos_and_donts: z.object({
      do: z.array(z.string()).optional(),
      dont: z.array(z.string()).optional()
    }).optional()
  }).optional(),
  account_name: z.string().max(200).transform(sanitizeUserInput).optional(),
  stakeholder_name: z.string().max(200).transform(sanitizeUserInput).optional()
});

export type GenerateSalesAssetsRequest = z.infer<typeof generateSalesAssetsSchema>;

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
