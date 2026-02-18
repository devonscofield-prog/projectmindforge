import { describe, expect, it } from 'vitest';
import {
  normalizeCallListParams,
  normalizeTeamGradeSummaryParams,
  normalizeTranscriptListParams,
  sdrKeys,
} from '../keys';

describe('sdr key normalization', () => {
  it('normalizes transcript params with sorted IDs and statuses', () => {
    const normalized = normalizeTranscriptListParams({
      sdrIds: ['rep-b', 'rep-a', 'rep-b'],
      statuses: ['processing', 'completed', 'processing'],
      dateFrom: '2026-02-01',
      dateTo: '2026-02-18',
      limit: 25,
    });

    expect(normalized).toEqual({
      sdrId: null,
      sdrIds: ['rep-a', 'rep-b'],
      statuses: ['completed', 'processing'],
      dateFrom: '2026-02-01',
      dateTo: '2026-02-18',
      limit: 25,
    });
  });

  it('normalizes call params and keeps recency default', () => {
    const normalized = normalizeCallListParams({
      sdrIds: ['rep-2', 'rep-1', 'rep-2'],
      onlyMeaningful: true,
    });

    expect(normalized).toEqual({
      transcriptId: null,
      sdrId: null,
      sdrIds: ['rep-1', 'rep-2'],
      onlyMeaningful: true,
      orderBy: 'recency',
      limit: null,
    });
  });

  it('uses call_index ordering only when explicitly requested', () => {
    const normalized = normalizeCallListParams({
      transcriptId: 'tx-1',
      orderBy: 'call_index',
    });

    expect(normalized.orderBy).toBe('call_index');
  });

  it('builds stable keys when member IDs are passed in different orders', () => {
    const first = sdrKeys.teamGradeSummary.detail({
      memberIds: ['rep-3', 'rep-1', 'rep-2'],
      lookbackLimit: 200,
    });
    const second = sdrKeys.teamGradeSummary.detail({
      memberIds: ['rep-2', 'rep-1', 'rep-3'],
      lookbackLimit: 200,
    });

    expect(first).toEqual(second);
  });

  it('keeps query keys stable when only polling options change', () => {
    const transcriptKeyA = sdrKeys.transcripts.list({
      sdrId: 'rep-1',
      pollWhileProcessing: true,
    });
    const transcriptKeyB = sdrKeys.transcripts.list({
      sdrId: 'rep-1',
      pollWhileProcessing: false,
    });

    const callKeyA = sdrKeys.calls.list({
      sdrId: 'rep-1',
      pollWhileProcessing: true,
    });
    const callKeyB = sdrKeys.calls.list({
      sdrId: 'rep-1',
      pollWhileProcessing: false,
    });

    expect(transcriptKeyA).toEqual(transcriptKeyB);
    expect(callKeyA).toEqual(callKeyB);
  });

  it('normalizes team grade params to sorted IDs and default lookback', () => {
    const normalized = normalizeTeamGradeSummaryParams({
      memberIds: ['rep-z', 'rep-a', 'rep-z'],
    });

    expect(normalized).toEqual({
      memberIds: ['rep-a', 'rep-z'],
      lookbackLimit: 200,
    });
  });
});
