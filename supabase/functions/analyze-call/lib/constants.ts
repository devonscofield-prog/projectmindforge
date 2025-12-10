/**
 * Constants for analyze-call edge function
 */

// Rate limiting config
export const RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_MAX_REQUESTS = 5;

// AI Gateway timeout (55s to leave buffer before edge function 60s timeout)
export const AI_GATEWAY_TIMEOUT_MS = 55000;

// UUID validation regex
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
