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
  
  // Check for required sections
  const missingSections = REQUIRED_CALL_NOTES_SECTIONS.filter(
    section => !callNotes.includes(section)
  );
  if (missingSections.length > 0) {
    issues.push(`Missing sections: ${missingSections.join(', ')}`);
  }
  
  // Check for truncation indicators (ends mid-sentence without punctuation)
  const trimmed = callNotes.trim();
  const lastChar = trimmed.charAt(trimmed.length - 1);
  const validEndChars = ['.', ')', ']', '"', "'", '!', '?', '-', '*'];
  if (!validEndChars.includes(lastChar)) {
    issues.push(`Possible truncation detected (ends with: "${lastChar}")`);
  }
  
  return { valid: issues.length === 0, issues, missingSections };
}
