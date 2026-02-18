import type {
  SDRCallListParams,
  SDRTeamGradeSummaryParams,
  SDRTranscriptListParams,
} from './types';

function uniqueSortedIds(ids: readonly string[] | undefined): string[] {
  if (!ids || ids.length === 0) return [];
  return Array.from(new Set(ids)).sort();
}

function sortedStatuses(statuses: readonly string[] | undefined): string[] {
  if (!statuses || statuses.length === 0) return [];
  return Array.from(new Set(statuses)).sort();
}

export function normalizeTranscriptListParams(
  params: SDRTranscriptListParams = {},
): {
  sdrId: string | null;
  sdrIds: string[];
  statuses: string[];
  dateFrom: string | null;
  dateTo: string | null;
  limit: number | null;
} {
  return {
    sdrId: params.sdrId ?? null,
    sdrIds: uniqueSortedIds(params.sdrIds),
    statuses: sortedStatuses(params.statuses),
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
    limit: typeof params.limit === 'number' ? params.limit : null,
  };
}

export function normalizeCallListParams(
  params: SDRCallListParams = {},
): {
  transcriptId: string | null;
  sdrId: string | null;
  sdrIds: string[];
  onlyMeaningful: boolean;
  orderBy: 'recency' | 'call_index';
  limit: number | null;
} {
  return {
    transcriptId: params.transcriptId ?? null,
    sdrId: params.sdrId ?? null,
    sdrIds: uniqueSortedIds(params.sdrIds),
    onlyMeaningful: params.onlyMeaningful === true,
    orderBy: params.orderBy === 'call_index' ? 'call_index' : 'recency',
    limit: typeof params.limit === 'number' ? params.limit : null,
  };
}

export function normalizeTeamGradeSummaryParams(
  params: SDRTeamGradeSummaryParams,
): {
  memberIds: string[];
  lookbackLimit: number;
} {
  return {
    memberIds: uniqueSortedIds(params.memberIds),
    lookbackLimit: typeof params.lookbackLimit === 'number' ? params.lookbackLimit : 200,
  };
}

export const sdrKeys = {
  all: () => ['sdr'] as const,
  transcripts: {
    all: () => ['sdr', 'transcripts'] as const,
    list: (params: SDRTranscriptListParams = {}) =>
      ['sdr', 'transcripts', 'list', normalizeTranscriptListParams(params)] as const,
    detail: (transcriptId: string) => ['sdr', 'transcripts', 'detail', transcriptId] as const,
  },
  calls: {
    all: () => ['sdr', 'calls'] as const,
    list: (params: SDRCallListParams = {}) =>
      ['sdr', 'calls', 'list', normalizeCallListParams(params)] as const,
    detail: (callId: string) => ['sdr', 'calls', 'detail', callId] as const,
  },
  stats: {
    all: () => ['sdr', 'stats'] as const,
    bySdr: (sdrId?: string) => ['sdr', 'stats', sdrId ?? 'self'] as const,
  },
  teams: {
    all: () => ['sdr', 'teams'] as const,
    members: (teamId?: string) => ['sdr', 'teams', 'members', teamId ?? 'all'] as const,
  },
  coachingPrompts: {
    all: () => ['sdr', 'coaching-prompts'] as const,
    byTeam: (teamId?: string) => ['sdr', 'coaching-prompts', teamId ?? 'all'] as const,
  },
  teamGradeSummary: {
    all: () => ['sdr', 'team-grade-summary'] as const,
    detail: (params: SDRTeamGradeSummaryParams) =>
      ['sdr', 'team-grade-summary', normalizeTeamGradeSummaryParams(params)] as const,
  },
  profile: (sdrId: string) => ['sdr', 'profile', sdrId] as const,
  teamInviteLinks: (teamId?: string) => ['sdr', 'team-invite-links', teamId ?? 'none'] as const,
};
