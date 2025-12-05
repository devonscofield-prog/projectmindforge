// Validation utilities for analyze-call

import {
  REQUIRED_RECAP_LINKS,
  REQUIRED_CALL_NOTES_SECTIONS,
  MIN_CALL_NOTES_LENGTH,
  TOKEN_LIMITS,
  TRANSCRIPT_LENGTH_THRESHOLDS,
} from './constants.ts';

/**
 * Calculate adaptive max_tokens based on transcript length and retry count
 */
export function calculateMaxTokens(transcriptLength: number, retryCount: number): number {
  // On retry, use higher limits
  if (retryCount >= 2) return TOKEN_LIMITS.MAX_RETRY;
  if (retryCount === 1) return TOKEN_LIMITS.LONG;
  
  // First attempt - base on transcript length
  // FIXED: Long transcripts (>25k chars) now correctly get TOKEN_LIMITS.LONG
  if (transcriptLength > TRANSCRIPT_LENGTH_THRESHOLDS.LONG) {
    return TOKEN_LIMITS.LONG;
  }
  if (transcriptLength > TRANSCRIPT_LENGTH_THRESHOLDS.MEDIUM) {
    return TOKEN_LIMITS.MEDIUM;
  }
  return TOKEN_LIMITS.SHORT;
}

/**
 * Validate that recap_email_draft contains required links
 */
export function validateRecapEmailLinks(recapEmail: string): boolean {
  return REQUIRED_RECAP_LINKS.every(link => recapEmail.includes(link));
}

/**
 * Validate call_notes for completeness and detect truncation
 */
export function validateCallNotes(callNotes: string): { 
  valid: boolean; 
  issues: string[]; 
  missingSections: string[] 
} {
  const issues: string[] = [];
  
  // Check minimum length
  if (callNotes.length < MIN_CALL_NOTES_LENGTH) {
    issues.push(`Call notes too short (${callNotes.length} chars, minimum ${MIN_CALL_NOTES_LENGTH})`);
  }
  
  // Check for required sections - this is the most reliable indicator
  const missingSections = REQUIRED_CALL_NOTES_SECTIONS.filter(
    section => !callNotes.includes(section)
  );
  if (missingSections.length > 0) {
    issues.push(`Missing sections: ${missingSections.join(', ')}`);
  }
  
  // Check for obvious truncation indicators
  // Only flag as truncated if content is clearly cut off mid-word or mid-sentence
  const trimmed = callNotes.trim();
  const lastLine = trimmed.split('\n').pop()?.trim() || '';
  
  // Check if the last line looks like it was cut off mid-word
  // Signs of real truncation: ends with incomplete word, orphan punctuation, or very short fragment
  const clearTruncationPatterns = [
    /\s\w{1,2}$/, // Ends with 1-2 letter word (likely cut off)
    /[,;:]$/, // Ends with continuation punctuation
    /\s(the|a|an|to|of|and|or|in|on|at|for|is|was|are|were|be|been|have|has|had|will|would|could|should|may|might|must|can|do|does|did)$/i, // Ends with common article/preposition/aux verb
  ];
  
  const isClearlyTruncated = clearTruncationPatterns.some(pattern => pattern.test(lastLine));
  
  if (isClearlyTruncated) {
    issues.push(`Possible truncation detected (last line: "${lastLine.slice(-30)}")`);
  }
  
  // Only mark as invalid if there are missing sections (reliable indicator)
  // Truncation warnings are logged but don't fail validation if all sections present
  const hasHardFailure = missingSections.length > 0 || callNotes.length < MIN_CALL_NOTES_LENGTH;
  
  return { valid: !hasHardFailure, issues, missingSections };
}
