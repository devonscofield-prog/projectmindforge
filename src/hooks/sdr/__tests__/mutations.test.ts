import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Inline the deduplication logic from mutations.ts (lines 15-23, 30-39)
// since simpleHash and the dedup constants are not exported.
// ---------------------------------------------------------------------------

/** Simple string hash for deduplication (not cryptographic). */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

const DEDUP_WINDOW_MS = 30_000;

/**
 * Mirrors the deduplication guard inside useUploadSDRTranscript's mutationFn.
 * The hook uses a ref to track { hash, time } of the last submission.
 */
interface LastSubmit {
  hash: number;
  time: number;
}

function checkDedup(
  rawText: string,
  lastSubmit: LastSubmit | null,
  now: number,
): { allowed: boolean; newSubmit: LastSubmit } {
  const hash = simpleHash(rawText);
  if (
    lastSubmit &&
    lastSubmit.hash === hash &&
    now - lastSubmit.time < DEDUP_WINDOW_MS
  ) {
    return { allowed: false, newSubmit: lastSubmit };
  }
  return { allowed: true, newSubmit: { hash, time: now } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('simpleHash', () => {
  it('produces consistent results for the same input', () => {
    const input = 'Speaker 1 | 09:15 | Hello, this is John from Acme Corp';
    expect(simpleHash(input)).toBe(simpleHash(input));
  });

  it('produces different results for different inputs', () => {
    const a = simpleHash('transcript A content');
    const b = simpleHash('transcript B content');
    expect(a).not.toBe(b);
  });

  it('returns 0 for an empty string', () => {
    expect(simpleHash('')).toBe(0);
  });

  it('returns a 32-bit integer (bitwise OR forces int32)', () => {
    const hash = simpleHash('a very long string that should still produce a 32-bit integer result');
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(-2_147_483_648);
    expect(hash).toBeLessThanOrEqual(2_147_483_647);
  });

  it('handles single character input', () => {
    const hash = simpleHash('x');
    expect(typeof hash).toBe('number');
    expect(Number.isInteger(hash)).toBe(true);
  });
});

describe('upload deduplication', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first submission (no prior submit)', () => {
    const now = Date.now();
    const result = checkDedup('my transcript text', null, now);
    expect(result.allowed).toBe(true);
  });

  it('rejects same text within 30 seconds', () => {
    const text = 'Speaker 1 | 09:00 | Hello, this is a sales call transcript';
    const firstTime = Date.now();

    // First submission
    const first = checkDedup(text, null, firstTime);
    expect(first.allowed).toBe(true);

    // Same text 10 seconds later
    const second = checkDedup(text, first.newSubmit, firstTime + 10_000);
    expect(second.allowed).toBe(false);
  });

  it('rejects same text at exactly 29,999ms (just under window)', () => {
    const text = 'duplicate transcript text here for testing deduplication';
    const firstTime = Date.now();

    const first = checkDedup(text, null, firstTime);
    const second = checkDedup(text, first.newSubmit, firstTime + 29_999);
    expect(second.allowed).toBe(false);
  });

  it('allows same text after 30 seconds', () => {
    const text = 'Speaker 1 | 09:00 | Hello, this is a sales call transcript';
    const firstTime = Date.now();

    // First submission
    const first = checkDedup(text, null, firstTime);
    expect(first.allowed).toBe(true);

    // Same text exactly 30 seconds later
    const second = checkDedup(text, first.newSubmit, firstTime + 30_000);
    expect(second.allowed).toBe(true);
  });

  it('allows same text well after 30 seconds', () => {
    const text = 'some transcript';
    const firstTime = Date.now();

    const first = checkDedup(text, null, firstTime);
    const second = checkDedup(text, first.newSubmit, firstTime + 60_000);
    expect(second.allowed).toBe(true);
  });

  it('allows different text within 30 seconds', () => {
    const firstTime = Date.now();

    const first = checkDedup('transcript A: call with prospect 1', null, firstTime);
    expect(first.allowed).toBe(true);

    // Different text 5 seconds later
    const second = checkDedup('transcript B: call with prospect 2', first.newSubmit, firstTime + 5_000);
    expect(second.allowed).toBe(true);
  });

  it('updates lastSubmit on each allowed submission', () => {
    const firstTime = Date.now();

    const first = checkDedup('text A', null, firstTime);
    expect(first.newSubmit.hash).toBe(simpleHash('text A'));
    expect(first.newSubmit.time).toBe(firstTime);

    const secondTime = firstTime + 5_000;
    const second = checkDedup('text B', first.newSubmit, secondTime);
    expect(second.allowed).toBe(true);
    expect(second.newSubmit.hash).toBe(simpleHash('text B'));
    expect(second.newSubmit.time).toBe(secondTime);
  });

  it('does not update lastSubmit on rejected submission', () => {
    const text = 'same text for dedup';
    const firstTime = Date.now();

    const first = checkDedup(text, null, firstTime);
    const second = checkDedup(text, first.newSubmit, firstTime + 5_000);

    expect(second.allowed).toBe(false);
    // lastSubmit should remain the original
    expect(second.newSubmit).toBe(first.newSubmit);
  });
});
