// AI Gateway integration for call analysis

import type { TranscriptRow, AnalysisResult, CoachOutput, ProspectIntel, StakeholderIntel } from './types.ts';
import { ANALYSIS_SYSTEM_PROMPT, ANALYSIS_TOOL_SCHEMA, AI_GATEWAY_TIMEOUT_MS, REQUIRED_RECAP_LINKS } from './constants.ts';
import { calculateMaxTokens, validateCallNotes, validateRecapEmailLinks } from './validation.ts';
import type { Logger } from './logger.ts';

/**
 * Generate real analysis using Lovable AI Gateway with automatic retry on truncation
 */
export async function generateRealAnalysis(
  transcript: TranscriptRow,
  logger: Logger,
  retryCount: number = 0
): Promise<AnalysisResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) {
    logger.error('LOVABLE_API_KEY is not configured');
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const transcriptLength = transcript.raw_text.length;
  const maxTokens = calculateMaxTokens(transcriptLength, retryCount);
  
  const startTime = Date.now();
  logger.info(`Calling Lovable AI Gateway (attempt ${retryCount + 1}, transcript: ${transcriptLength} chars, max_tokens: ${maxTokens})...`);

  // Add timeout via AbortController to prevent hanging requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AI_GATEWAY_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { 
            role: 'user', 
            content: `Please analyze the following sales call transcript and generate the complete analysis including call_notes and recap_email_draft:\n\n---\n${transcript.raw_text}\n---\n\nCall Date: ${transcript.call_date}\nSource: ${transcript.source}` 
          }
        ],
        tools: [ANALYSIS_TOOL_SCHEMA],
        tool_choice: { type: "function", function: { name: "submit_call_analysis" } }
      }),
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      logger.error(`AI Gateway timeout after ${AI_GATEWAY_TIMEOUT_MS}ms`);
      throw new Error('AI analysis timed out. Please try again.');
    }
    throw fetchError;
  } finally {
    clearTimeout(timeoutId);
  }

  const aiDurationMs = Date.now() - startTime;
  logger.info(`AI Gateway response received in ${aiDurationMs}ms`);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('AI Gateway error', { status: response.status, error: errorText });
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    if (response.status === 402) {
      throw new Error('Payment required. Please add credits to your workspace.');
    }
    throw new Error(`AI Gateway error: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract and log finish_reason to detect truncation
  const finishReason = data.choices?.[0]?.finish_reason;
  logger.info(`AI response received (finish_reason: ${finishReason}, transcript: ${transcriptLength} chars)`);

  // Extract the tool call arguments
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function.name !== 'submit_call_analysis') {
    logger.error('No valid tool call in response', { response: JSON.stringify(data).substring(0, 500) });
    throw new Error('AI did not return structured analysis');
  }

  let analysisData: Record<string, unknown>;
  try {
    analysisData = JSON.parse(toolCall.function.arguments);
  } catch (parseError) {
    const argsStr = toolCall.function.arguments || '';
    const argsLength = argsStr.length;
    logger.error('Failed to parse tool arguments', { 
      arguments_start: argsStr.substring(0, 500),
      arguments_end: argsLength > 500 ? argsStr.substring(argsLength - 500) : '(shown above)',
      arguments_length: argsLength,
      transcript_length: transcriptLength,
      parse_error: parseError instanceof Error ? parseError.message : String(parseError)
    });
    throw new Error(`Failed to parse AI analysis response (${argsLength} chars, transcript: ${transcriptLength} chars)`);
  }

  // Validate all required fields
  const requiredFields = [
    'call_summary', 'confidence', 'trend_indicators', 'deal_gaps', 'strengths',
    'opportunities', 'skill_tags', 'deal_tags', 'meta_tags', 'call_notes', 'recap_email_draft',
    'coach_output'
  ];

  for (const field of requiredFields) {
    if (analysisData[field] === undefined) {
      logger.error(`Missing required field: ${field}`);
      throw new Error(`AI analysis missing required field: ${field}`);
    }
  }

  // Validate call_notes is a non-empty string with all required sections
  const callNotes = analysisData.call_notes;
  if (typeof callNotes !== 'string' || callNotes.trim().length === 0) {
    logger.error('call_notes is not a valid string');
    throw new Error('AI analysis call_notes must be a non-empty string');
  }
  
  // Validate call_notes completeness
  const callNotesValidation = validateCallNotes(callNotes as string);
  
  // Check if truncation occurred (finish_reason === 'length' or validation failed)
  const wasTruncated = finishReason === 'length' || !callNotesValidation.valid;
  
  if (wasTruncated) {
    logger.warn('Output truncation detected', {
      finish_reason: finishReason,
      call_notes_length: (callNotes as string).length,
      transcript_length: transcriptLength,
      max_tokens_used: maxTokens,
      validation_issues: callNotesValidation.issues,
      missing_sections: callNotesValidation.missingSections
    });
    
    // Retry with higher max_tokens if we haven't exceeded retry limit
    const MAX_RETRIES = 2;
    if (retryCount < MAX_RETRIES) {
      logger.info(`Retrying with higher max_tokens (attempt ${retryCount + 2} of ${MAX_RETRIES + 1})...`);
      return generateRealAnalysis(transcript, logger, retryCount + 1);
    }
    
    // After all retries, throw error if still invalid
    if (!callNotesValidation.valid) {
      logger.error('Call notes still incomplete after retries', { issues: callNotesValidation.issues });
      throw new Error(`Call notes incomplete after ${MAX_RETRIES + 1} attempts. Missing: ${callNotesValidation.missingSections.join(', ')}`);
    }
  }

  // Validate recap_email_draft is a non-empty string with required links
  const recapEmail = analysisData.recap_email_draft;
  if (typeof recapEmail !== 'string' || recapEmail.trim().length === 0) {
    logger.error('recap_email_draft is not a valid string');
    throw new Error('AI analysis recap_email_draft must be a non-empty string');
  }

  // Auto-append required links if missing instead of failing
  let finalRecapEmail = recapEmail;
  if (!validateRecapEmailLinks(recapEmail)) {
    logger.warn('recap_email_draft missing required links - auto-appending');
    logger.warn('Missing links from:', { required: REQUIRED_RECAP_LINKS });
    
    const linksFooter = `

You can learn more here:
[StormWind Website](https://info.stormwind.com/)

View sample courses here:
[View Sample Courses](https://info.stormwind.com/training-samples)`;
    
    finalRecapEmail = recapEmail.trim() + linksFooter;
    logger.info('Links auto-appended to recap_email_draft');
  }

  // Validate coach_output structure
  const coachOutput = analysisData.coach_output as CoachOutput;
  if (!coachOutput || typeof coachOutput !== 'object') {
    logger.error('coach_output is not a valid object');
    throw new Error('AI analysis coach_output must be a valid object');
  }

  // Extract prospect_intel (optional but expected)
  const prospectIntel = analysisData.prospect_intel as ProspectIntel | undefined;
  
  // Extract stakeholders_intel (optional)
  const stakeholdersIntel = analysisData.stakeholders_intel as StakeholderIntel[] | undefined;

  // Build the result object with analysis metadata for debugging
  const result: AnalysisResult = {
    call_id: transcript.id,
    rep_id: transcript.rep_id,
    model_name: 'google/gemini-2.5-flash',
    prompt_version: 'v4-meddpicc',
    confidence: Number(analysisData.confidence) || 0.5,
    call_summary: String(analysisData.call_summary),
    // Individual scores set to 0 for backward compatibility - no longer generated
    discovery_score: 0,
    objection_handling_score: 0,
    rapport_communication_score: 0,
    product_knowledge_score: 0,
    deal_advancement_score: 0,
    call_effectiveness_score: 0,
    trend_indicators: analysisData.trend_indicators as Record<string, string>,
    deal_gaps: analysisData.deal_gaps as { critical_missing_info: string[]; unresolved_objections: string[] },
    strengths: analysisData.strengths as Array<{ area: string; example: string }>,
    opportunities: analysisData.opportunities as Array<{ area: string; example: string }>,
    skill_tags: analysisData.skill_tags as string[],
    deal_tags: analysisData.deal_tags as string[],
    meta_tags: analysisData.meta_tags as string[],
    call_notes: String(callNotes),
    recap_email_draft: String(finalRecapEmail),
    coach_output: coachOutput,
    raw_json: {
      ...analysisData,
      _analysis_metadata: {
        finish_reason: finishReason,
        retry_count: retryCount,
        transcript_length: transcriptLength,
        max_tokens_used: maxTokens,
        call_notes_length: (callNotes as string).length
      }
    },
    prospect_intel: prospectIntel,
    stakeholders_intel: stakeholdersIntel
  };

  logger.info('AI analysis completed', {
    callNotesLength: (callNotes as string).length,
    stakeholdersCount: stakeholdersIntel?.length || 0,
    heatScore: coachOutput?.heat_signature?.score
  });
  return result;
}
