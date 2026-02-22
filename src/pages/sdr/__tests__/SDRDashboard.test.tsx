import { describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Upload form validation logic extracted from SDRDashboard.tsx (lines 115-124).
// The component computes these inline, so we replicate the logic here for
// unit testing without needing to render the full component tree.
// ---------------------------------------------------------------------------

const MIN_LENGTH = 50;
const MAX_LENGTH = 5_000_000;
const SHORT_WARN_LENGTH = 500;

/**
 * Mirrors the `validationError` derivation in SDRDashboard.tsx.
 * Returns an error string or null.
 */
function getValidationError(rawText: string): string | null {
  const charCount = rawText.length;
  if (charCount > 0 && charCount < MIN_LENGTH) {
    return `Transcript must be at least ${MIN_LENGTH} characters (currently ${charCount}).`;
  }
  if (charCount > MAX_LENGTH) {
    return `Transcript exceeds maximum size of 5 MB (~${MAX_LENGTH.toLocaleString()} characters). Current: ${charCount.toLocaleString()}.`;
  }
  return null;
}

/**
 * Mirrors the short-transcript warning check (line 128).
 */
function isShortTranscript(rawText: string): boolean {
  return rawText.length > 0 && rawText.length < SHORT_WARN_LENGTH;
}

/**
 * Mirrors the character count display (line 439).
 */
function getCharCountDisplay(rawText: string): string {
  return `${rawText.length.toLocaleString()} characters`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SDRDashboard upload validation logic', () => {
  describe('character count display', () => {
    it('shows 0 characters for empty input', () => {
      expect(getCharCountDisplay('')).toBe('0 characters');
    });

    it('shows correct count for non-empty input', () => {
      expect(getCharCountDisplay('hello world')).toBe('11 characters');
    });

    it('formats large numbers with locale separators', () => {
      const longText = 'a'.repeat(10_000);
      expect(getCharCountDisplay(longText)).toBe('10,000 characters');
    });
  });

  describe('min length validation (< 50 chars)', () => {
    it('returns error when text is 1 character', () => {
      const error = getValidationError('x');
      expect(error).toMatch(/at least 50 characters/);
      expect(error).toContain('currently 1');
    });

    it('returns error when text is 49 characters', () => {
      const error = getValidationError('a'.repeat(49));
      expect(error).toMatch(/at least 50 characters/);
      expect(error).toContain('currently 49');
    });

    it('returns null when text is exactly 50 characters', () => {
      expect(getValidationError('a'.repeat(50))).toBeNull();
    });

    it('returns null for empty input (no error shown until user types)', () => {
      expect(getValidationError('')).toBeNull();
    });
  });

  describe('max size validation (> 5MB)', () => {
    it('returns error when text exceeds 5,000,000 characters', () => {
      const error = getValidationError('a'.repeat(5_000_001));
      expect(error).toMatch(/exceeds maximum size/);
      expect(error).toContain('5 MB');
    });

    it('returns null when text is exactly 5,000,000 characters', () => {
      expect(getValidationError('a'.repeat(5_000_000))).toBeNull();
    });
  });

  describe('short transcript warning (< 500 chars)', () => {
    it('returns true for text shorter than 500 chars', () => {
      expect(isShortTranscript('a'.repeat(100))).toBe(true);
    });

    it('returns true for text at 499 chars', () => {
      expect(isShortTranscript('a'.repeat(499))).toBe(true);
    });

    it('returns false for text at exactly 500 chars', () => {
      expect(isShortTranscript('a'.repeat(500))).toBe(false);
    });

    it('returns false for text longer than 500 chars', () => {
      expect(isShortTranscript('a'.repeat(1000))).toBe(false);
    });

    it('returns false for empty string (no warning when nothing entered)', () => {
      expect(isShortTranscript('')).toBe(false);
    });
  });

  describe('drag-and-drop file reading', () => {
    it('FileReader reads text file content', async () => {
      const fileContent = 'Speaker 1 | 09:15 | Hello this is a test transcript content for drag and drop';
      const file = new File([fileContent], 'transcript.txt', { type: 'text/plain' });

      const result = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve((ev.target?.result as string) || '');
        };
        reader.readAsText(file);
      });

      expect(result).toBe(fileContent);
    });

    it('FileReader handles empty file', async () => {
      const file = new File([''], 'empty.txt', { type: 'text/plain' });

      const result = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          resolve((ev.target?.result as string) || '');
        };
        reader.readAsText(file);
      });

      expect(result).toBe('');
    });
  });

  describe('upload button disabled state', () => {
    it('is disabled when rawText is empty', () => {
      const rawText = '';
      const validationError = getValidationError(rawText);
      const isPending = false;
      const disabled = isPending || !rawText.trim() || !!validationError;
      expect(disabled).toBe(true);
    });

    it('is disabled when rawText is only whitespace', () => {
      const rawText = '   \n\t  ';
      const validationError = getValidationError(rawText);
      const isPending = false;
      // Note: validationError would be non-null here since 7 chars < 50
      const disabled = isPending || !rawText.trim() || !!validationError;
      expect(disabled).toBe(true);
    });

    it('is disabled when validation error exists', () => {
      const rawText = 'too short';
      const validationError = getValidationError(rawText);
      const isPending = false;
      const disabled = isPending || !rawText.trim() || !!validationError;
      expect(disabled).toBe(true);
    });

    it('is disabled when mutation is pending', () => {
      const rawText = 'a'.repeat(100);
      const validationError = getValidationError(rawText);
      const isPending = true;
      const disabled = isPending || !rawText.trim() || !!validationError;
      expect(disabled).toBe(true);
    });

    it('is enabled when text is valid and not pending', () => {
      const rawText = 'a'.repeat(100);
      const validationError = getValidationError(rawText);
      const isPending = false;
      const disabled = isPending || !rawText.trim() || !!validationError;
      expect(disabled).toBe(false);
    });
  });
});
