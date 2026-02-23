import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Error display logic extracted from SDRTranscriptDetail.tsx, SDRDashboard.tsx,
// SDRHistory.tsx, and queries.ts for unit testing without rendering the full
// component tree (which requires auth, routing, react-query providers, etc.).
// ---------------------------------------------------------------------------

// -- Stuck processing detection --
// From queries.ts lines 96-99 and 148-155.
// Two variants exist: one for transcript list items, one for detail view.
// Both use the same core logic.

const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

interface TranscriptBase {
  processing_status: string;
  updated_at: string;
}

function computeIsStuck(transcript: TranscriptBase | undefined): boolean {
  if (!transcript) return false;
  if (transcript.processing_status !== 'processing') return false;
  const updatedAt = new Date(transcript.updated_at).getTime();
  return Date.now() - updatedAt > STUCK_THRESHOLD_MS;
}

// -- Processing error tooltip visibility --
// From SDRTranscriptDetail.tsx lines 149-162, SDRHistory.tsx lines 201-214.
// A tooltip with the error is shown when status is failed/partial AND processing_error exists.

interface TranscriptForTooltip {
  processing_status: string;
  processing_error: string | null;
}

function shouldShowErrorTooltip(t: TranscriptForTooltip): boolean {
  return (
    (t.processing_status === 'failed' || t.processing_status === 'partial') &&
    !!t.processing_error
  );
}

// -- Failed call breakdown --
// From SDRTranscriptDetail.tsx lines 48, 314.

interface CallForBreakdown {
  id: string;
  analysis_status: string;
  is_meaningful: boolean;
  call_index: number;
  prospect_name: string | null;
  processing_error: string | null;
}

function getFailedCalls(calls: CallForBreakdown[]): CallForBreakdown[] {
  return calls.filter((c) => c.analysis_status === 'failed');
}

function getMeaningfulCalls(calls: CallForBreakdown[]): CallForBreakdown[] {
  return calls.filter((c) => c.is_meaningful);
}

// -- Grading summary text --
// From SDRTranscriptDetail.tsx lines 307-310.

function getGradingSummaryText(
  gradedCount: number,
  meaningfulCount: number,
  failedCount: number,
): string {
  let text = `${gradedCount} of ${meaningfulCount} calls graded successfully`;
  if (failedCount > 0) {
    text += `, ${failedCount} failed`;
  }
  return text;
}

// -- Status badge CSS class --
// From SDRTranscriptDetail.tsx lines 152-153 and SDRHistory.tsx lines 204-205.

function getStatusBadgeClass(status: string): string {
  if (status === 'failed') return 'bg-red-500/10 text-red-500';
  if (status === 'partial') return 'bg-orange-500/10 text-orange-500';
  if (status === 'completed') return 'bg-green-500/10 text-green-500';
  if (status === 'processing') return 'bg-yellow-500/10 text-yellow-500';
  return 'bg-muted text-muted-foreground';
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('error display logic', () => {
  describe('processing error tooltip', () => {
    it('shows tooltip when status is failed and error exists', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'failed',
          processing_error: 'Splitter failed: model refused',
        }),
      ).toBe(true);
    });

    it('shows tooltip when status is partial and error exists', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'partial',
          processing_error: '3/5 calls failed grading',
        }),
      ).toBe(true);
    });

    it('does not show tooltip when status is failed but no error message', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'failed',
          processing_error: null,
        }),
      ).toBe(false);
    });

    it('does not show tooltip when status is completed', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'completed',
          processing_error: null,
        }),
      ).toBe(false);
    });

    it('does not show tooltip when status is processing', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'processing',
          processing_error: null,
        }),
      ).toBe(false);
    });

    it('does not show tooltip for completed even with stale error', () => {
      expect(
        shouldShowErrorTooltip({
          processing_status: 'completed',
          processing_error: 'old error from a previous run',
        }),
      ).toBe(false);
    });
  });

  describe('failed call breakdown', () => {
    const sampleCalls: CallForBreakdown[] = [
      { id: '1', analysis_status: 'completed', is_meaningful: true, call_index: 1, prospect_name: 'Alice', processing_error: null },
      { id: '2', analysis_status: 'failed', is_meaningful: true, call_index: 2, prospect_name: 'Bob', processing_error: 'Grader returned invalid JSON' },
      { id: '3', analysis_status: 'skipped', is_meaningful: false, call_index: 3, prospect_name: null, processing_error: null },
      { id: '4', analysis_status: 'failed', is_meaningful: true, call_index: 4, prospect_name: null, processing_error: 'timeout' },
      { id: '5', analysis_status: 'completed', is_meaningful: true, call_index: 5, prospect_name: 'Carol', processing_error: null },
    ];

    it('returns only calls with analysis_status === "failed"', () => {
      const failed = getFailedCalls(sampleCalls);
      expect(failed).toHaveLength(2);
      expect(failed.map((c) => c.id)).toEqual(['2', '4']);
    });

    it('returns empty array when no calls have failed', () => {
      const noFailed = sampleCalls.filter((c) => c.analysis_status !== 'failed');
      expect(getFailedCalls(noFailed)).toHaveLength(0);
    });

    it('preserves processing_error on failed calls', () => {
      const failed = getFailedCalls(sampleCalls);
      expect(failed[0].processing_error).toBe('Grader returned invalid JSON');
      expect(failed[1].processing_error).toBe('timeout');
    });

    it('displays prospect name or fallback "Call #N"', () => {
      const failed = getFailedCalls(sampleCalls);
      // Mirrors SDRTranscriptDetail.tsx line 328
      const labels = failed.map((c) => c.prospect_name || `Call #${c.call_index}`);
      expect(labels).toEqual(['Bob', 'Call #4']);
    });

    it('meaningful calls are separate from failed calls', () => {
      const meaningful = getMeaningfulCalls(sampleCalls);
      expect(meaningful).toHaveLength(4); // All except the skipped one
      // A meaningful call can also be failed
      expect(meaningful.map((c) => c.analysis_status)).toContain('failed');
    });
  });

  describe('grading summary text', () => {
    it('shows all graded with no failures', () => {
      expect(getGradingSummaryText(5, 5, 0)).toBe(
        '5 of 5 calls graded successfully',
      );
    });

    it('shows graded count with failures', () => {
      expect(getGradingSummaryText(3, 5, 2)).toBe(
        '3 of 5 calls graded successfully, 2 failed',
      );
    });

    it('shows zero graded', () => {
      expect(getGradingSummaryText(0, 3, 3)).toBe(
        '0 of 3 calls graded successfully, 3 failed',
      );
    });
  });

  describe('stuck processing warning', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('returns false when transcript is undefined', () => {
      expect(computeIsStuck(undefined)).toBe(false);
    });

    it('returns false when status is not processing', () => {
      expect(
        computeIsStuck({
          processing_status: 'completed',
          updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }),
      ).toBe(false);
    });

    it('returns false when status is failed', () => {
      expect(
        computeIsStuck({
          processing_status: 'failed',
          updated_at: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        }),
      ).toBe(false);
    });

    it('returns false when processing and updated less than 5 minutes ago', () => {
      vi.setSystemTime(new Date('2026-02-21T12:10:00Z'));
      expect(
        computeIsStuck({
          processing_status: 'processing',
          updated_at: '2026-02-21T12:06:00Z', // 4 minutes ago
        }),
      ).toBe(false);
    });

    it('returns true when processing and updated more than 5 minutes ago', () => {
      vi.setSystemTime(new Date('2026-02-21T12:10:00Z'));
      expect(
        computeIsStuck({
          processing_status: 'processing',
          updated_at: '2026-02-21T12:04:59Z', // 5 min 1 sec ago
        }),
      ).toBe(true);
    });

    it('returns false at exactly 5 minutes (boundary - not exceeded)', () => {
      vi.setSystemTime(new Date('2026-02-21T12:05:00.000Z'));
      expect(
        computeIsStuck({
          processing_status: 'processing',
          updated_at: '2026-02-21T12:00:00.000Z', // exactly 5 min
        }),
      ).toBe(false);
    });

    it('returns true at 5 minutes + 1ms', () => {
      vi.setSystemTime(new Date('2026-02-21T12:05:00.001Z'));
      expect(
        computeIsStuck({
          processing_status: 'processing',
          updated_at: '2026-02-21T12:00:00.000Z',
        }),
      ).toBe(true);
    });
  });

  describe('status badge styling', () => {
    it('returns red classes for failed status', () => {
      expect(getStatusBadgeClass('failed')).toContain('text-red-500');
    });

    it('returns orange classes for partial status', () => {
      expect(getStatusBadgeClass('partial')).toContain('text-orange-500');
    });

    it('returns green classes for completed status', () => {
      expect(getStatusBadgeClass('completed')).toContain('text-green-500');
    });

    it('returns yellow classes for processing status', () => {
      expect(getStatusBadgeClass('processing')).toContain('text-yellow-500');
    });

    it('returns muted classes for pending or unknown status', () => {
      expect(getStatusBadgeClass('pending')).toContain('text-muted-foreground');
      expect(getStatusBadgeClass('unknown')).toContain('text-muted-foreground');
    });
  });
});
