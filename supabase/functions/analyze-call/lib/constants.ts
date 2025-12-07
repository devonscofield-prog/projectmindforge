/**
 * Constants for analyze-call edge function
 * 
 * ANALYSIS 2.0 CLEANUP:
 * - Legacy system prompt (ANALYSIS_SYSTEM_PROMPT) has been removed
 * - Legacy tool schema (ANALYSIS_TOOL_SCHEMA) has been removed
 * - Only utility constants are retained
 */

// Rate limiting config
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 5;

// AI Gateway timeout (55s to leave buffer before edge function 60s timeout)
export const AI_GATEWAY_TIMEOUT_MS = 55000;

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Required links that must appear in recap_email_draft (retained for future use)
export const REQUIRED_RECAP_LINKS = [
  '[StormWind Website](https://info.stormwind.com/)',
  '[View Sample Courses](https://info.stormwind.com/training-samples)'
];

// Required section headers in call_notes (retained for future use)
export const REQUIRED_CALL_NOTES_SECTIONS = [
  '## Call Overview',
  '## Participants',
  '## Business Context & Pain',
  '## Current State / Environment',
  '## Solution Topics Discussed',
  '## Decision Process & Stakeholders',
  '## Timeline & Urgency',
  '## Budget / Commercials',
  '## Next Steps & Commitments',
  '## Risks & Open Questions',
  '## Competitors Mentioned'
];

// Minimum length for complete call_notes (characters)
export const MIN_CALL_NOTES_LENGTH = 1500;

// Adaptive token limits based on transcript length
export const TOKEN_LIMITS = {
  SHORT: 16384,      // Transcripts < 15,000 chars
  MEDIUM: 24576,     // Transcripts 15,000-25,000 chars
  LONG: 32768,       // Transcripts > 25,000 chars or retry
  MAX_RETRY: 40960   // Maximum for second retry
};

// Transcript length thresholds (characters)
export const TRANSCRIPT_LENGTH_THRESHOLDS = {
  MEDIUM: 15000,
  LONG: 25000
};

// ============================================================
// LEGACY PROMPTS REMOVED - ANALYSIS 2.0 CLEANUP
// 
// The following have been removed:
// - ANALYSIS_SYSTEM_PROMPT (the "God Prompt")
// - ANALYSIS_TOOL_SCHEMA (structured output schema)
// 
// New modular prompts will be added in separate files.
// ============================================================
