import { describe, expect, it } from 'vitest';

// Inline the validation logic from index.ts since it's not exported (Deno edge function).
// This mirrors the validateGradeOutput() function and VALID_GRADES constant from
// supabase/functions/sdr-process-transcript/index.ts lines 1049-1076.

const VALID_GRADES = ['A+', 'A', 'B', 'C', 'D', 'F'] as const;

function validateGradeOutput(parsed: any): void {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Grade output is not an object');
  }
  if (!VALID_GRADES.includes(parsed.overall_grade)) {
    throw new Error(
      `Invalid overall_grade: ${JSON.stringify(parsed.overall_grade)}. Must be one of ${VALID_GRADES.join(', ')}`,
    );
  }
  for (const key of [
    'opener_score',
    'engagement_score',
    'objection_handling_score',
    'appointment_setting_score',
    'professionalism_score',
  ]) {
    const val = parsed[key];
    if (typeof val !== 'number' || val < 1 || val > 10) {
      throw new Error(
        `Invalid ${key}: ${JSON.stringify(val)}. Must be a number between 1 and 10`,
      );
    }
  }
  if (!Array.isArray(parsed.strengths)) {
    throw new Error('strengths must be an array');
  }
  if (!Array.isArray(parsed.improvements)) {
    throw new Error('improvements must be an array');
  }
  if (!Array.isArray(parsed.key_moments)) {
    throw new Error('key_moments must be an array');
  }
  if (typeof parsed.call_summary !== 'string') {
    throw new Error('call_summary must be a string');
  }
}

// ---------------------------------------------------------------------------
// Helper: build a valid grade output object. Tests override individual fields.
// ---------------------------------------------------------------------------
function validGrade(overrides: Record<string, unknown> = {}) {
  return {
    overall_grade: 'B',
    opener_score: 7,
    engagement_score: 6,
    objection_handling_score: 5,
    appointment_setting_score: 8,
    professionalism_score: 9,
    call_summary: 'A solid cold call with good engagement.',
    strengths: ['Good opener', 'Built rapport'],
    improvements: ['Ask more discovery questions'],
    key_moments: [{ timestamp: '01:23', description: 'Handled objection well', sentiment: 'positive' }],
    ...overrides,
  };
}

describe('validateGradeOutput', () => {
  // ---- Happy path ----

  it('accepts a valid grade output with all correct fields', () => {
    expect(() => validateGradeOutput(validGrade())).not.toThrow();
  });

  it('accepts A+ as a valid overall_grade', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: 'A+' }))).not.toThrow();
  });

  it('accepts all valid letter grades', () => {
    for (const grade of VALID_GRADES) {
      expect(() => validateGradeOutput(validGrade({ overall_grade: grade }))).not.toThrow();
    }
  });

  it('accepts boundary score of 1 (minimum)', () => {
    expect(() =>
      validateGradeOutput(
        validGrade({
          opener_score: 1,
          engagement_score: 1,
          objection_handling_score: 1,
          appointment_setting_score: 1,
          professionalism_score: 1,
        }),
      ),
    ).not.toThrow();
  });

  it('accepts boundary score of 10 (maximum)', () => {
    expect(() =>
      validateGradeOutput(
        validGrade({
          opener_score: 10,
          engagement_score: 10,
          objection_handling_score: 10,
          appointment_setting_score: 10,
          professionalism_score: 10,
        }),
      ),
    ).not.toThrow();
  });

  it('accepts empty arrays for strengths, improvements, and key_moments', () => {
    expect(() =>
      validateGradeOutput(validGrade({ strengths: [], improvements: [], key_moments: [] })),
    ).not.toThrow();
  });

  // ---- Invalid overall_grade ----

  it('throws for invalid grade letter "E"', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: 'E' }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  it('throws for grade with modifier "A-"', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: 'A-' }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  it('throws when overall_grade is null', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: null }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  it('throws when overall_grade is undefined', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: undefined }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  it('throws when overall_grade is a number', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: 5 }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  it('throws for lowercase grade "b"', () => {
    expect(() => validateGradeOutput(validGrade({ overall_grade: 'b' }))).toThrow(
      /Invalid overall_grade/,
    );
  });

  // ---- Scores out of range ----

  it('throws when a score is 0 (below minimum)', () => {
    expect(() => validateGradeOutput(validGrade({ opener_score: 0 }))).toThrow(
      /Invalid opener_score/,
    );
  });

  it('throws when a score is 11 (above maximum)', () => {
    expect(() => validateGradeOutput(validGrade({ engagement_score: 11 }))).toThrow(
      /Invalid engagement_score/,
    );
  });

  it('throws when a score is negative', () => {
    expect(() => validateGradeOutput(validGrade({ objection_handling_score: -1 }))).toThrow(
      /Invalid objection_handling_score/,
    );
  });

  it('throws when a score is null', () => {
    expect(() => validateGradeOutput(validGrade({ appointment_setting_score: null }))).toThrow(
      /Invalid appointment_setting_score/,
    );
  });

  it('throws when a score is a string', () => {
    expect(() => validateGradeOutput(validGrade({ professionalism_score: '7' }))).toThrow(
      /Invalid professionalism_score/,
    );
  });

  it('throws when a score is undefined (missing)', () => {
    expect(() => validateGradeOutput(validGrade({ opener_score: undefined }))).toThrow(
      /Invalid opener_score/,
    );
  });

  // ---- Missing required fields ----

  it('throws when parsed is null', () => {
    expect(() => validateGradeOutput(null)).toThrow(/Grade output is not an object/);
  });

  it('throws when parsed is undefined', () => {
    expect(() => validateGradeOutput(undefined)).toThrow(/Grade output is not an object/);
  });

  it('throws when parsed is a string', () => {
    expect(() => validateGradeOutput('some string')).toThrow(
      /Grade output is not an object/,
    );
  });

  it('throws when parsed is an empty object', () => {
    expect(() => validateGradeOutput({})).toThrow(/Invalid overall_grade/);
  });

  // ---- Non-array values for array fields ----

  it('throws when strengths is a string', () => {
    expect(() => validateGradeOutput(validGrade({ strengths: 'good opener' }))).toThrow(
      /strengths must be an array/,
    );
  });

  it('throws when improvements is null', () => {
    expect(() => validateGradeOutput(validGrade({ improvements: null }))).toThrow(
      /improvements must be an array/,
    );
  });

  it('throws when key_moments is an object', () => {
    expect(() =>
      validateGradeOutput(validGrade({ key_moments: { timestamp: '01:00' } })),
    ).toThrow(/key_moments must be an array/);
  });

  // ---- Non-string call_summary ----

  it('throws when call_summary is a number', () => {
    expect(() => validateGradeOutput(validGrade({ call_summary: 42 }))).toThrow(
      /call_summary must be a string/,
    );
  });

  it('throws when call_summary is null', () => {
    expect(() => validateGradeOutput(validGrade({ call_summary: null }))).toThrow(
      /call_summary must be a string/,
    );
  });

  it('throws when call_summary is undefined', () => {
    expect(() => validateGradeOutput(validGrade({ call_summary: undefined }))).toThrow(
      /call_summary must be a string/,
    );
  });
});
