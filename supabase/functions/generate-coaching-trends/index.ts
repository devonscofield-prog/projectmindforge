import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CallData {
  date: string;
  framework_scores: {
    bant: { score: number; summary: string };
    gap_selling: { score: number; summary: string };
    active_listening: { score: number; summary: string };
  } | null;
  bant_improvements: string[];
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
    bant: number | null;
    gapSelling: number | null;
    activeListening: number | null;
    heat: number | null;
  };
  dominantTrends: {
    bant: 'improving' | 'stable' | 'declining';
    gapSelling: 'improving' | 'stable' | 'declining';
    activeListening: 'improving' | 'stable' | 'declining';
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

Focus your analysis on these specific areas:
1. **BANT Framework** - Are they getting better at qualifying budget, authority, need, and timeline?
2. **Gap Selling** - Are they improving at identifying current state vs future state gaps and quantifying business impact?
3. **Active Listening** - Are they asking better follow-up questions and acknowledging prospect concerns?
4. **Critical Information Gathering** - What types of information are they consistently missing? Is this improving or getting worse?
5. **Follow-up Question Quality** - Are the recommended follow-ups showing repeated patterns that indicate systemic issues?

For each area, you must:
- Identify whether performance is IMPROVING, STABLE, or DECLINING
- Provide specific evidence from the calls
- Give actionable recommendations

Be direct and specific. Don't use vague language. If something is declining, say so clearly.`;

const HIERARCHICAL_SYNTHESIS_PROMPT = `You are an expert sales coaching analyst. Your job is to SYNTHESIZE multiple chunk summaries into a comprehensive trend analysis.

You are receiving pre-analyzed summaries of call batches, organized chronologically. Your task is to:
1. Identify overall trends across all chunks
2. Note how patterns evolved over time (early chunks vs recent chunks)
3. Aggregate the most common issues and improvements
4. Provide actionable recommendations based on the full picture

Focus on the big picture while noting specific evidence from the chunk summaries.`;

// Tool schema for structured output
const TREND_ANALYSIS_TOOL = {
  type: 'function',
  function: {
    name: 'provide_trend_analysis',
    description: 'Provide structured trend analysis of the sales rep coaching data',
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
            bant: {
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
          required: ['bant', 'gapSelling', 'activeListening']
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
    
    if (call.framework_scores) {
      summary += `Framework Scores:\n`;
      summary += `- BANT: ${call.framework_scores.bant?.score ?? 'N/A'}/100 - ${call.framework_scores.bant?.summary || 'No summary'}\n`;
      summary += `- Gap Selling: ${call.framework_scores.gap_selling?.score ?? 'N/A'}/100 - ${call.framework_scores.gap_selling?.summary || 'No summary'}\n`;
      summary += `- Active Listening: ${call.framework_scores.active_listening?.score ?? 'N/A'}/100 - ${call.framework_scores.active_listening?.summary || 'No summary'}\n`;
    }
    
    if (call.heat_score) {
      summary += `Heat Score: ${call.heat_score}/10\n`;
    }

    if (call.bant_improvements?.length) {
      summary += `BANT Improvements Needed: ${call.bant_improvements.join('; ')}\n`;
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

    return summary;
  }).join('\n');
}

function formatChunkSummariesForPrompt(chunks: ChunkSummary[]): string {
  return chunks.map((chunk, idx) => {
    let summary = `\n### Period ${idx + 1}: ${chunk.dateRange.from} to ${chunk.dateRange.to} (${chunk.callCount} calls)\n`;
    
    summary += `Average Scores:\n`;
    summary += `- BANT: ${chunk.avgScores.bant?.toFixed(1) ?? 'N/A'}/100\n`;
    summary += `- Gap Selling: ${chunk.avgScores.gapSelling?.toFixed(1) ?? 'N/A'}/100\n`;
    summary += `- Active Listening: ${chunk.avgScores.activeListening?.toFixed(1) ?? 'N/A'}/100\n`;
    summary += `- Heat: ${chunk.avgScores.heat?.toFixed(1) ?? 'N/A'}/10\n`;
    
    summary += `\nTrends in this period:\n`;
    summary += `- BANT: ${chunk.dominantTrends.bant}\n`;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json() as TrendAnalysisRequest;
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    let systemPrompt: string;
    let userPrompt: string;
    let totalCalls: number;

    if ('hierarchicalMode' in requestBody && requestBody.hierarchicalMode) {
      // Hierarchical mode: synthesize chunk summaries
      const { chunkSummaries, dateRange, totalCalls: total } = requestBody;
      
      if (!chunkSummaries || chunkSummaries.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No chunk summaries provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[generate-coaching-trends] Hierarchical mode: synthesizing ${chunkSummaries.length} chunks (${total} total calls)`);
      
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

      console.log(`[generate-coaching-trends] Direct mode: analyzing ${calls.length} calls from ${dateRange.from} to ${dateRange.to}`);
      
      totalCalls = calls.length;
      systemPrompt = TREND_ANALYSIS_SYSTEM_PROMPT;
      const formattedCalls = formatCallsForPrompt(calls);
      
      userPrompt = `Analyze the following ${calls.length} call analyses from ${dateRange.from} to ${dateRange.to} and identify trends:

${formattedCalls}

Provide a comprehensive trend analysis with specific evidence and actionable recommendations.`;
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        tools: [TREND_ANALYSIS_TOOL],
        tool_choice: { type: 'function', function: { name: 'provide_trend_analysis' } }
      })
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again in a moment' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Usage limit reached, please add credits' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await aiResponse.text();
      console.error('[generate-coaching-trends] AI Gateway error:', aiResponse.status, errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    console.log('[generate-coaching-trends] AI response received');

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== 'provide_trend_analysis') {
      console.error('[generate-coaching-trends] Unexpected AI response:', JSON.stringify(aiData));
      throw new Error('AI did not return expected structured output');
    }

    const trendAnalysis = JSON.parse(toolCall.function.arguments);
    
    // Ensure totalCalls is set correctly
    if (trendAnalysis.periodAnalysis) {
      trendAnalysis.periodAnalysis.totalCalls = totalCalls;
    }
    
    return new Response(
      JSON.stringify(trendAnalysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[generate-coaching-trends] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});