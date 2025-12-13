// Edge function for generating coaching trends analysis
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { validateSignedRequest } from "../_shared/hmac.ts";
// Zod schema for Analysis 2.0 Trend Analysis response validation
const FrameworkTrendSchema = z.object({
  trend: z.enum(['improving', 'stable', 'declining']),
  startingAvg: z.number(),
  endingAvg: z.number(),
  keyInsight: z.string(),
  evidence: z.array(z.string()),
  recommendation: z.string(),
});

const PatienceTrendSchema = z.object({
  trend: z.enum(['improving', 'stable', 'declining']),
  startingAvg: z.number(),
  endingAvg: z.number(),
  avgInterruptions: z.number(),
  keyInsight: z.string(),
  evidence: z.array(z.string()),
  recommendation: z.string(),
});

const StrategicThreadingTrendSchema = z.object({
  trend: z.enum(['improving', 'stable', 'declining']),
  startingAvg: z.number(),
  endingAvg: z.number(),
  avgRelevanceRatio: z.number(),
  avgMissedOpportunities: z.number(),
  keyInsight: z.string(),
  evidence: z.array(z.string()),
  recommendation: z.string(),
});

const MonologueTrendSchema = z.object({
  trend: z.enum(['improving', 'stable', 'declining']),
  totalViolations: z.number(),
  avgPerCall: z.number(),
  avgLongestTurn: z.number(),
  keyInsight: z.string(),
  evidence: z.array(z.string()),
  recommendation: z.string(),
});

const PersistentGapSchema = z.object({
  gap: z.string(),
  frequency: z.string(),
  trend: z.enum(['improving', 'stable', 'worse']),
});

const TrendAnalysisSchema = z.object({
  summary: z.string(),
  periodAnalysis: z.object({
    totalCalls: z.number(),
    averageHeatScore: z.number(),
    heatScoreTrend: z.enum(['improving', 'stable', 'declining']),
  }),
  trendAnalysis: z.object({
    patience: PatienceTrendSchema,
    strategicThreading: StrategicThreadingTrendSchema,
    monologueViolations: MonologueTrendSchema,
    meddpicc: FrameworkTrendSchema,
    gapSelling: FrameworkTrendSchema,
    activeListening: FrameworkTrendSchema,
  }),
  patternAnalysis: z.object({
    criticalInfoMissing: z.object({
      persistentGaps: z.array(PersistentGapSchema),
      newIssues: z.array(z.string()),
      resolvedIssues: z.array(z.string()),
      recommendation: z.string(),
    }),
    followUpQuestions: z.object({
      recurringThemes: z.array(z.string()),
      qualityTrend: z.enum(['improving', 'stable', 'declining']),
      recommendation: z.string(),
    }),
  }),
  topPriorities: z.array(z.object({
    area: z.string(),
    reason: z.string(),
    actionItem: z.string(),
  })),
});


function getCorsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigins = ['https://lovable.dev', 'https://www.lovable.dev'];
  const devPatterns = [/^https?:\/\/localhost(:\d+)?$/, /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/, /^https:\/\/[a-z0-9-]+\.lovable\.app$/];
  
  // Allow custom domain from environment variable
  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
    allowedOrigins.push(`https://www.${customDomain}`);
  }
  
  // Allow StormWind domain from environment variable
  const stormwindDomain = Deno.env.get('STORMWIND_DOMAIN');
  if (stormwindDomain) {
    allowedOrigins.push(`https://${stormwindDomain}`);
    allowedOrigins.push(`https://www.${stormwindDomain}`);
  }
  
  const requestOrigin = origin || '';
  const isAllowed = allowedOrigins.includes(requestOrigin) || devPatterns.some(pattern => pattern.test(requestOrigin));
  return {
    'Access-Control-Allow-Origin': isAllowed ? requestOrigin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  
  if (!entry || now >= entry.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  entry.count++;
  return { allowed: true };
}

// Structured logging helper
function createLogger(correlationId: string) {
  const startTime = Date.now();
  return {
    info: (phase: string, message: string, data?: Record<string, unknown>) => {
      console.log(JSON.stringify({
        level: 'info',
        correlationId,
        phase,
        message,
        elapsed: Date.now() - startTime,
        ...data,
      }));
    },
    warn: (phase: string, message: string, data?: Record<string, unknown>) => {
      console.warn(JSON.stringify({
        level: 'warn',
        correlationId,
        phase,
        message,
        elapsed: Date.now() - startTime,
        ...data,
      }));
    },
    error: (phase: string, message: string, error?: unknown, data?: Record<string, unknown>) => {
      console.error(JSON.stringify({
        level: 'error',
        correlationId,
        phase,
        message,
        error: error instanceof Error ? error.message : String(error),
        elapsed: Date.now() - startTime,
        ...data,
      }));
    },
  };
}

// Analysis 2.0 types for behavioral and strategy data
interface BehaviorScore {
  overall_score: number;
  grade: 'Pass' | 'Fail';
  coaching_tip: string;
  metrics: {
    patience: { score: number; missed_acknowledgment_count: number; status: string };
    question_quality: { 
      score: number; 
      explanation: string;
      average_question_length: number;
      average_answer_length: number;
      high_leverage_count: number;
      low_leverage_count: number;
    };
    monologue: { score: number; longest_turn_word_count: number; violation_count: number };
    talk_listen_ratio: { score: number; rep_talk_percentage: number };
    next_steps: { score: number; secured: boolean; details: string };
  };
}

interface StrategyAudit {
  strategic_threading: {
    score: number;
    grade: 'Pass' | 'Fail';
    relevance_map: Array<{
      pain_identified: string;
      feature_pitched: string;
      is_relevant: boolean;
      reasoning: string;
    }>;
    missed_opportunities: string[];
  };
  meddpicc: {
    overall_score: number;
    breakdown: Record<string, { score: number; evidence?: string | null; missing_info?: string | null }>;
  };
}

interface CallData {
  date: string;
  // Analysis 2.0 fields
  analysis_behavior?: BehaviorScore | null;
  analysis_strategy?: StrategyAudit | null;
  // Legacy fields (fallback)
  framework_scores: {
    meddpicc?: { overall_score: number; summary: string };
    bant?: { score: number; summary: string };
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  } | null;
  meddpicc_improvements?: string[];
  bant_improvements?: string[];
  gap_selling_improvements: string[];
  active_listening_improvements: string[];
  critical_info_missing: Array<{ info: string; missed_opportunity: string }> | string[];
  follow_up_questions: Array<{ question: string; timing_example: string }> | string[];
  heat_score: number | null;
}

interface ChunkSummary {
  chunkIndex: number;
  dateRange: { from: string; to: string };
  callCount: number;
  avgScores: {
    meddpicc: number | null;
    bant?: number | null;
    gapSelling: number | null;
    activeListening: number | null;
    heat: number | null;
    // Analysis 2.0 aggregate scores
    patienceAvg?: number | null;
    strategicThreadingAvg?: number | null;
    monologueViolationsTotal?: number | null;
  };
  dominantTrends: {
    meddpicc: 'improving' | 'stable' | 'declining';
    bant?: 'improving' | 'stable' | 'declining';
    gapSelling: 'improving' | 'stable' | 'declining';
    activeListening: 'improving' | 'stable' | 'declining';
    // Analysis 2.0 trends
    patience?: 'improving' | 'stable' | 'declining';
    strategicThreading?: 'improving' | 'stable' | 'declining';
    monologue?: 'improving' | 'stable' | 'declining';
  };
  topMissingInfo: string[];
  topImprovementAreas: string[];
  keyObservations: string[];
}

interface DirectAnalysisRequest {
  calls: CallData[];
  dateRange: { from: string; to: string };
  hierarchicalMode?: false;
}

interface HierarchicalAnalysisRequest {
  hierarchicalMode: true;
  chunkSummaries: ChunkSummary[];
  dateRange: { from: string; to: string };
  totalCalls: number;
}

type TrendAnalysisRequest = DirectAnalysisRequest | HierarchicalAnalysisRequest;

const TREND_ANALYSIS_SYSTEM_PROMPT = `You are an expert sales coaching analyst. Your job is to analyze a collection of call analyses from a sales rep and identify TRENDS in their performance over time.

**ANALYSIS 2.0 METRICS (Primary - use when available):**
1. **Patience Score** (from Behavior analysis) - Are they interrupting less? Lower interruption counts = better patience.
2. **Strategic Threading Score** (from Strategy analysis) - Are they connecting prospect pains to relevant solutions? Higher = better alignment.
3. **Monologue Violations** (from Behavior analysis) - How many times did they talk too long without letting prospect respond?
4. **MEDDPICC Score** (from Strategy analysis) - How well are they qualifying deals?
5. **Next Steps Secured** (from Behavior analysis) - Are they consistently securing specific next steps?

**LEGACY METRICS (Fallback - use when Analysis 2.0 not available):**
- Gap Selling score - current state vs future state gap identification
- Active Listening score - follow-up questions and acknowledgment
- Critical Information Missing patterns

For each metric, you must:
- Identify whether performance is IMPROVING, STABLE, or DECLINING
- Provide specific evidence from the calls
- Give actionable recommendations

Be direct and specific. Don't use vague language. If something is declining, say so clearly.

**CRITICAL:** The Analysis 2.0 metrics (Patience, Strategic Threading, Monologue Violations) are OBJECTIVE numbers calculated from the transcript, not subjective scores. Track these numbers precisely over time.`;

const HIERARCHICAL_SYNTHESIS_PROMPT = `You are an expert sales coaching analyst. Your job is to SYNTHESIZE multiple chunk summaries into a comprehensive trend analysis.

You are receiving pre-analyzed summaries of call batches, organized chronologically. Your task is to:
1. Identify overall trends across all chunks
2. Note how patterns evolved over time (early chunks vs recent chunks)
3. Aggregate the most common issues and improvements
4. Provide actionable recommendations based on the full picture
5. Track Analysis 2.0 metrics: Patience Score, Strategic Threading Score, Monologue Violations

Focus on the big picture while noting specific evidence from the chunk summaries.`;

// Tool schema for structured output - Updated for Analysis 2.0
const TREND_ANALYSIS_TOOL = {
  type: 'function',
  function: {
    name: 'provide_trend_analysis',
    description: 'Provide structured trend analysis of the sales rep coaching data using Analysis 2.0 metrics',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: '2-3 sentence executive summary of overall performance trends'
        },
        periodAnalysis: {
          type: 'object',
          properties: {
            totalCalls: { type: 'number' },
            averageHeatScore: { type: 'number', description: 'Average heat score across all calls' },
            heatScoreTrend: { type: 'string', enum: ['improving', 'stable', 'declining'] }
          },
          required: ['totalCalls', 'averageHeatScore', 'heatScoreTrend']
        },
        trendAnalysis: {
          type: 'object',
          properties: {
            // Analysis 2.0: Patience Score (from Behavior)
            patience: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                startingAvg: { type: 'number', description: 'Average patience score from first half (0-30)' },
                endingAvg: { type: 'number', description: 'Average patience score from second half (0-30)' },
                avgInterruptions: { type: 'number', description: 'Average interruption count per call' },
                keyInsight: { type: 'string', description: 'One sentence insight about patience trend' },
                evidence: { type: 'array', items: { type: 'string' }, description: 'Specific examples from calls' },
                recommendation: { type: 'string', description: 'Specific actionable advice' }
              },
              required: ['trend', 'startingAvg', 'endingAvg', 'avgInterruptions', 'keyInsight', 'evidence', 'recommendation']
            },
            // Analysis 2.0: Strategic Threading Score (from Strategy)
            strategicThreading: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                startingAvg: { type: 'number', description: 'Average strategic threading score from first half (0-100)' },
                endingAvg: { type: 'number', description: 'Average strategic threading score from second half (0-100)' },
                avgRelevanceRatio: { type: 'number', description: 'Average % of pitches that were relevant to pains' },
                avgMissedOpportunities: { type: 'number', description: 'Average missed opportunities per call' },
                keyInsight: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' }
              },
              required: ['trend', 'startingAvg', 'endingAvg', 'avgRelevanceRatio', 'avgMissedOpportunities', 'keyInsight', 'evidence', 'recommendation']
            },
            // Analysis 2.0: Monologue Violations (from Behavior)
            monologueViolations: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                totalViolations: { type: 'number', description: 'Total monologue violations across all calls' },
                avgPerCall: { type: 'number', description: 'Average violations per call' },
                avgLongestTurn: { type: 'number', description: 'Average longest turn word count' },
                keyInsight: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' }
              },
              required: ['trend', 'totalViolations', 'avgPerCall', 'avgLongestTurn', 'keyInsight', 'evidence', 'recommendation']
            },
            // MEDDPICC (from Strategy)
            meddpicc: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                startingAvg: { type: 'number', description: 'Average score from first half of period' },
                endingAvg: { type: 'number', description: 'Average score from second half of period' },
                keyInsight: { type: 'string', description: 'One sentence insight about this trend' },
                evidence: { type: 'array', items: { type: 'string' }, description: 'Specific examples from calls' },
                recommendation: { type: 'string', description: 'Specific actionable advice' }
              },
              required: ['trend', 'startingAvg', 'endingAvg', 'keyInsight', 'evidence', 'recommendation']
            },
            // Legacy: Gap Selling (fallback)
            gapSelling: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                startingAvg: { type: 'number' },
                endingAvg: { type: 'number' },
                keyInsight: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' }
              },
              required: ['trend', 'startingAvg', 'endingAvg', 'keyInsight', 'evidence', 'recommendation']
            },
            // Legacy: Active Listening (fallback)
            activeListening: {
              type: 'object',
              properties: {
                trend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                startingAvg: { type: 'number' },
                endingAvg: { type: 'number' },
                keyInsight: { type: 'string' },
                evidence: { type: 'array', items: { type: 'string' } },
                recommendation: { type: 'string' }
              },
              required: ['trend', 'startingAvg', 'endingAvg', 'keyInsight', 'evidence', 'recommendation']
            }
          },
          required: ['patience', 'strategicThreading', 'monologueViolations', 'meddpicc', 'gapSelling', 'activeListening']
        },
        patternAnalysis: {
          type: 'object',
          properties: {
            criticalInfoMissing: {
              type: 'object',
              properties: {
                persistentGaps: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      gap: { type: 'string' },
                      frequency: { type: 'string', description: 'e.g., "5 of 12 calls"' },
                      trend: { type: 'string', enum: ['improving', 'stable', 'worse'] }
                    },
                    required: ['gap', 'frequency', 'trend']
                  }
                },
                newIssues: { type: 'array', items: { type: 'string' }, description: 'Issues that appeared recently' },
                resolvedIssues: { type: 'array', items: { type: 'string' }, description: 'Issues that stopped appearing' },
                recommendation: { type: 'string' }
              },
              required: ['persistentGaps', 'newIssues', 'resolvedIssues', 'recommendation']
            },
            followUpQuestions: {
              type: 'object',
              properties: {
                recurringThemes: { type: 'array', items: { type: 'string' } },
                qualityTrend: { type: 'string', enum: ['improving', 'stable', 'declining'] },
                recommendation: { type: 'string' }
              },
              required: ['recurringThemes', 'qualityTrend', 'recommendation']
            }
          },
          required: ['criticalInfoMissing', 'followUpQuestions']
        },
        topPriorities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              area: { type: 'string', description: 'Area to focus on' },
              reason: { type: 'string', description: 'Why this is a priority' },
              actionItem: { type: 'string', description: 'Specific thing to do' }
            },
            required: ['area', 'reason', 'actionItem']
          },
          description: 'Top 3 priority areas to focus on'
        }
      },
      required: ['summary', 'periodAnalysis', 'trendAnalysis', 'patternAnalysis', 'topPriorities']
    }
  }
};

function formatCallsForPrompt(calls: CallData[]): string {
  return calls.map((call, idx) => {
    const callNum = idx + 1;
    let summary = `\n### Call ${callNum} (${call.date})\n`;
    
    // === ANALYSIS 2.0 METRICS (Primary) ===
    if (call.analysis_behavior) {
      const behavior = call.analysis_behavior;
      summary += `**Behavior Analysis (Analysis 2.0):**\n`;
      summary += `- Overall Behavior Score: ${behavior.overall_score}/100 (${behavior.grade})\n`;
      
      if (behavior.metrics) {
        summary += `- Acknowledgment Score: ${behavior.metrics.patience?.score ?? 'N/A'}/30 (${behavior.metrics.patience?.missed_acknowledgment_count ?? 0} missed acknowledgments)\n`;
        const qm = behavior.metrics.question_quality;
        const yieldRatio = qm?.average_question_length ? (qm.average_answer_length / qm.average_question_length).toFixed(1) : 'N/A';
        summary += `- Question Yield: ${qm?.average_answer_length ?? 0} words per answer vs ${qm?.average_question_length ?? 0} words per question (${yieldRatio}:1 ratio, ${qm?.high_leverage_count ?? 0} high leverage, ${qm?.low_leverage_count ?? 0} low leverage)\n`;
        summary += `- Monologue Score: ${behavior.metrics.monologue?.score ?? 'N/A'}/20 (${behavior.metrics.monologue?.violation_count ?? 0} violations, longest: ${behavior.metrics.monologue?.longest_turn_word_count ?? 0} words)\n`;
        summary += `- Talk Ratio: ${behavior.metrics.talk_listen_ratio?.rep_talk_percentage ?? 'N/A'}% rep talk time\n`;
        summary += `- Next Steps: ${behavior.metrics.next_steps?.secured ? '✓ SECURED' : '✗ NOT SECURED'}\n`;
      }
      
      if (behavior.coaching_tip) {
        summary += `- Coaching Tip: ${behavior.coaching_tip}\n`;
      }
    }
    
    if (call.analysis_strategy) {
      const strategy = call.analysis_strategy;
      summary += `**Strategy Analysis (Analysis 2.0):**\n`;
      summary += `- Strategic Threading Score: ${strategy.strategic_threading?.score ?? 'N/A'}/100 (${strategy.strategic_threading?.grade || 'N/A'})\n`;
      summary += `- MEDDPICC Score: ${strategy.meddpicc?.overall_score ?? 'N/A'}/100\n`;
      
      // Count relevance stats
      if (strategy.strategic_threading?.relevance_map) {
        const relevant = strategy.strategic_threading.relevance_map.filter(r => r.is_relevant).length;
        const total = strategy.strategic_threading.relevance_map.length;
        summary += `- Pitch Relevance: ${relevant}/${total} solutions matched pains\n`;
      }
      
      if (strategy.strategic_threading?.missed_opportunities?.length) {
        summary += `- Missed Opportunities: ${strategy.strategic_threading.missed_opportunities.length} pains not addressed\n`;
      }
    }
    
    // === LEGACY METRICS (Fallback) ===
    if (!call.analysis_behavior && !call.analysis_strategy && call.framework_scores) {
      summary += `**Framework Scores (Legacy):**\n`;
      if (call.framework_scores.meddpicc) {
        summary += `- MEDDPICC: ${call.framework_scores.meddpicc.overall_score ?? 'N/A'}/100 - ${call.framework_scores.meddpicc.summary || 'No summary'}\n`;
      } else if (call.framework_scores.bant) {
        summary += `- BANT (legacy): ${call.framework_scores.bant.score ?? 'N/A'}/100 - ${call.framework_scores.bant.summary || 'No summary'}\n`;
      }
      summary += `- Gap Selling: ${call.framework_scores.gap_selling?.score ?? 'N/A'}/100 - ${call.framework_scores.gap_selling?.summary || 'No summary'}\n`;
      summary += `- Active Listening: ${call.framework_scores.active_listening?.score ?? 'N/A'}/100 - ${call.framework_scores.active_listening?.summary || 'No summary'}\n`;
    }
    
    if (call.heat_score) {
      summary += `Heat Score: ${call.heat_score}/10\n`;
    }

    // Legacy improvements (only if no Analysis 2.0)
    if (!call.analysis_behavior && !call.analysis_strategy) {
      if (call.meddpicc_improvements?.length) {
        summary += `MEDDPICC Improvements Needed: ${call.meddpicc_improvements.join('; ')}\n`;
      } else if (call.bant_improvements?.length) {
        summary += `BANT Improvements Needed (legacy): ${call.bant_improvements.join('; ')}\n`;
      }
      if (call.gap_selling_improvements?.length) {
        summary += `Gap Selling Improvements Needed: ${call.gap_selling_improvements.join('; ')}\n`;
      }
      if (call.active_listening_improvements?.length) {
        summary += `Active Listening Improvements Needed: ${call.active_listening_improvements.join('; ')}\n`;
      }

      if (call.critical_info_missing?.length) {
        const missing = call.critical_info_missing.map(item => 
          typeof item === 'object' ? item.info : item
        ).join('; ');
        summary += `Critical Info Missing: ${missing}\n`;
      }

      if (call.follow_up_questions?.length) {
        const questions = call.follow_up_questions.map(item => 
          typeof item === 'object' ? item.question : item
        ).join('; ');
        summary += `Recommended Follow-ups: ${questions}\n`;
      }
    }

    return summary;
  }).join('\n');
}

function formatChunkSummariesForPrompt(chunks: ChunkSummary[]): string {
  return chunks.map((chunk, idx) => {
    let summary = `\n### Period ${idx + 1}: ${chunk.dateRange.from} to ${chunk.dateRange.to} (${chunk.callCount} calls)\n`;
    
    // === Analysis 2.0 Metrics (Primary) ===
    const hasAnalysis2_0 = chunk.avgScores.patienceAvg != null || chunk.avgScores.strategicThreadingAvg != null;
    if (hasAnalysis2_0) {
      summary += `**Analysis 2.0 Metrics:**\n`;
      summary += `- Patience Score: ${chunk.avgScores.patienceAvg?.toFixed(1) ?? 'N/A'}/30\n`;
      summary += `- Strategic Threading Score: ${chunk.avgScores.strategicThreadingAvg?.toFixed(1) ?? 'N/A'}/100\n`;
      summary += `- Total Monologue Violations: ${chunk.avgScores.monologueViolationsTotal ?? 'N/A'}\n`;
      
      if (chunk.dominantTrends.patience || chunk.dominantTrends.strategicThreading || chunk.dominantTrends.monologue) {
        summary += `\nAnalysis 2.0 Trends:\n`;
        if (chunk.dominantTrends.patience) summary += `- Patience: ${chunk.dominantTrends.patience}\n`;
        if (chunk.dominantTrends.strategicThreading) summary += `- Strategic Threading: ${chunk.dominantTrends.strategicThreading}\n`;
        if (chunk.dominantTrends.monologue) summary += `- Monologue Discipline: ${chunk.dominantTrends.monologue}\n`;
      }
    }
    
    // === Legacy Metrics ===
    summary += `\n**Framework Scores:**\n`;
    // Prefer MEDDPICC, fall back to BANT for legacy data
    if (chunk.avgScores.meddpicc != null) {
      summary += `- MEDDPICC: ${chunk.avgScores.meddpicc.toFixed(1)}/100\n`;
    } else if (chunk.avgScores.bant != null) {
      summary += `- BANT (legacy): ${chunk.avgScores.bant.toFixed(1)}/100\n`;
    }
    summary += `- Gap Selling: ${chunk.avgScores.gapSelling?.toFixed(1) ?? 'N/A'}/100\n`;
    summary += `- Active Listening: ${chunk.avgScores.activeListening?.toFixed(1) ?? 'N/A'}/100\n`;
    summary += `- Heat: ${chunk.avgScores.heat?.toFixed(1) ?? 'N/A'}/10\n`;
    
    summary += `\nFramework Trends:\n`;
    // Prefer MEDDPICC trends, fall back to BANT for legacy
    if (chunk.dominantTrends.meddpicc) {
      summary += `- MEDDPICC: ${chunk.dominantTrends.meddpicc}\n`;
    } else if (chunk.dominantTrends.bant) {
      summary += `- BANT (legacy): ${chunk.dominantTrends.bant}\n`;
    }
    summary += `- Gap Selling: ${chunk.dominantTrends.gapSelling}\n`;
    summary += `- Active Listening: ${chunk.dominantTrends.activeListening}\n`;
    
    if (chunk.topMissingInfo?.length) {
      summary += `\nTop Missing Information: ${chunk.topMissingInfo.join('; ')}\n`;
    }
    
    if (chunk.topImprovementAreas?.length) {
      summary += `Top Improvement Areas: ${chunk.topImprovementAreas.join('; ')}\n`;
    }
    
    if (chunk.keyObservations?.length) {
      summary += `Key Observations: ${chunk.keyObservations.join('; ')}\n`;
    }
    
    return summary;
  }).join('\n');
}

Deno.serve(async (req) => {
  // Use correlation ID from request if provided (for inter-function tracing), else generate new
  let correlationId = crypto.randomUUID().slice(0, 8);
  
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Read body once for both HMAC validation and processing
  const bodyText = await req.text();
  
  // Validate HMAC signature if present (service-to-service call)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (serviceRoleKey && req.headers.has('X-Request-Signature')) {
    const validation = await validateSignedRequest(req.headers, bodyText, serviceRoleKey);
    if (!validation.valid) {
      console.warn('[generate-coaching-trends] Invalid HMAC signature:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request signature', details: validation.error }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }

  // Parse body
  let requestBody: TrendAnalysisRequest & { correlationId?: string };
  try {
    requestBody = JSON.parse(bodyText);
    // Use passed correlation ID if available (for log tracing across functions)
    if (requestBody.correlationId) {
      correlationId = requestBody.correlationId;
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const log = createLogger(correlationId);

  // Extract user ID from JWT for rate limiting
  const authHeader = req.headers.get('Authorization');
  let userId = 'anonymous';
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '');
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub || 'anonymous';
    } catch {
      // Use anonymous if token parsing fails
    }
  }

  log.info('request_received', 'Coaching trends request received', { userId: userId.slice(0, 8) });

  // Check rate limit
  const rateLimitResult = checkRateLimit(userId);
  if (!rateLimitResult.allowed) {
    log.warn('rate_limit', 'Rate limit exceeded', { userId: userId.slice(0, 8) });
    return new Response(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { 
        status: 429, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': String(rateLimitResult.retryAfter || 60)
        } 
      }
    );
  }

  try {
    // requestBody already parsed above with HMAC validation
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt: string;
    let userPrompt: string;
    let totalCalls: number;
    let analysisMode: 'direct' | 'hierarchical';

    if ('hierarchicalMode' in requestBody && requestBody.hierarchicalMode) {
      // Hierarchical mode: synthesize chunk summaries
      const { chunkSummaries, dateRange, totalCalls: total } = requestBody;
      
      if (!chunkSummaries || chunkSummaries.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No chunk summaries provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      analysisMode = 'hierarchical';
      log.info('mode_determined', 'Hierarchical mode activated', { 
        chunks: chunkSummaries.length, 
        totalCalls: total,
        dateRange 
      });
      
      totalCalls = total;
      systemPrompt = HIERARCHICAL_SYNTHESIS_PROMPT;
      const formattedChunks = formatChunkSummariesForPrompt(chunkSummaries);
      
      userPrompt = `Synthesize the following ${chunkSummaries.length} period summaries covering ${total} total calls from ${dateRange.from} to ${dateRange.to}:

${formattedChunks}

Provide a comprehensive trend analysis that identifies patterns across all periods, noting how performance evolved over time.`;

    } else {
      // Direct mode: analyze calls directly
      const { calls, dateRange } = requestBody as DirectAnalysisRequest;
      
      if (!calls || calls.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No call data provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      analysisMode = 'direct';
      log.info('mode_determined', 'Direct mode activated', { 
        callCount: calls.length,
        dateRange 
      });
      
      totalCalls = calls.length;
      systemPrompt = TREND_ANALYSIS_SYSTEM_PROMPT;
      const formattedCalls = formatCallsForPrompt(calls);
      
      userPrompt = `Analyze the following ${calls.length} call analyses from ${dateRange.from} to ${dateRange.to} and identify trends:

${formattedCalls}

Provide a comprehensive trend analysis with specific evidence and actionable recommendations.`;
    }

    log.info('ai_request_started', 'Sending request to AI Gateway', { mode: analysisMode, totalCalls });

    // Timeout controller for AI request (55 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);
    
    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          temperature: 0.3,
          max_tokens: 8192,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          tools: [TREND_ANALYSIS_TOOL],
          tool_choice: { type: 'function', function: { name: 'provide_trend_analysis' } }
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        log.error('ai_timeout', 'AI request timed out after 55 seconds', fetchError);
        throw new Error('AI analysis timed out. Try with fewer calls.');
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        log.warn('ai_rate_limit', 'AI Gateway rate limit hit');
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        log.warn('ai_payment_required', 'AI Gateway payment required');
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      log.error('ai_error', 'AI Gateway error', null, { status: aiResponse.status, errorText });
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    log.info('ai_response_received', 'AI response received, processing');

    const aiData = await aiResponse.json();

    // Extract the function call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'provide_trend_analysis') {
      log.error('ai_format_error', 'Unexpected AI response format', null, { response: JSON.stringify(aiData).slice(0, 500) });
      throw new Error('Unexpected AI response format');
    }

    let trendAnalysis;
    try {
      const parsed = JSON.parse(toolCall.function.arguments);
      
      // Validate with Zod schema
      const validationResult = TrendAnalysisSchema.safeParse(parsed);
      
      if (!validationResult.success) {
        log.warn('validation_warning', 'Schema validation failed', { errors: validationResult.error.format() });
        trendAnalysis = parsed;
      } else {
        trendAnalysis = validationResult.data;
        log.info('validation_complete', 'Schema validation passed');
      }
    } catch (parseError) {
      log.error('parse_error', 'Failed to parse AI response', parseError);
      throw new Error('Failed to parse AI analysis');
    }

    // Ensure required fields exist with defaults for backward compatibility
    if (!trendAnalysis.periodAnalysis) {
      trendAnalysis.periodAnalysis = {
        totalCalls: totalCalls,
        averageHeatScore: 0,
        heatScoreTrend: 'stable'
      };
    }
    
    // Ensure Analysis 2.0 trend fields have defaults if missing
    if (!trendAnalysis.trendAnalysis?.patience) {
      trendAnalysis.trendAnalysis = trendAnalysis.trendAnalysis || {};
      trendAnalysis.trendAnalysis.patience = {
        trend: 'stable',
        startingAvg: 0,
        endingAvg: 0,
        avgInterruptions: 0,
        keyInsight: 'No patience data available',
        evidence: [],
        recommendation: 'Submit more calls with Analysis 2.0 data'
      };
    }
    
    if (!trendAnalysis.trendAnalysis?.strategicThreading) {
      trendAnalysis.trendAnalysis.strategicThreading = {
        trend: 'stable',
        startingAvg: 0,
        endingAvg: 0,
        avgRelevanceRatio: 0,
        avgMissedOpportunities: 0,
        keyInsight: 'No strategic threading data available',
        evidence: [],
        recommendation: 'Submit more calls with Analysis 2.0 data'
      };
    }
    
    if (!trendAnalysis.trendAnalysis?.monologueViolations) {
      trendAnalysis.trendAnalysis.monologueViolations = {
        trend: 'stable',
        totalViolations: 0,
        avgPerCall: 0,
        avgLongestTurn: 0,
        keyInsight: 'No monologue data available',
        evidence: [],
        recommendation: 'Submit more calls with Analysis 2.0 data'
      };
    }

    log.info('complete', 'Trend analysis complete', { totalCalls, mode: analysisMode });

    return new Response(
      JSON.stringify(trendAnalysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    log.error('fatal', 'Unhandled error', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
