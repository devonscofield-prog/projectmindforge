// Compatibility facade for SDR hooks.
// New code should import from '@/hooks/sdr/queries', '@/hooks/sdr/mutations', and '@/hooks/sdr/keys'.

export { sdrKeys } from './sdr/keys';

export type {
  SDRCallAnalysisStatus,
  SDRCallDetail,
  SDRCallGradeDetail,
  SDRCallGradeListItem,
  SDRCallListItem,
  SDRCallListParams,
  SDRCallType,
  SDRCoachingPrompt,
  SDRMemberGradeStats,
  SDRProcessingStatus,
  SDRStatsSummary,
  SDRTeam,
  SDRTeamGradeSummary,
  SDRTeamGradeSummaryParams,
  SDRTeamMember,
  SDRTeamMemberWithProfile,
  SDRTranscriptDetail,
  SDRTranscriptListItem,
  SDRTranscriptListParams,
} from './sdr/types';

export {
  isTranscriptStuck,
  useSDRCallDetail,
  useSDRCallList,
  useSDRCoachingPrompts,
  useSDRProfile,
  useSDRStats,
  useSDRTeamGradeSummary,
  useSDRTeamMembers,
  useSDRTeams,
  useSDRTranscriptDetail,
  useSDRTranscriptList,
} from './sdr/queries';

export {
  useCreateCoachingPrompt,
  useReGradeCall,
  useRetrySDRTranscript,
  useUpdateCoachingPrompt,
  useUploadSDRTranscript,
  useCreateSDRTeam,
  useUpdateSDRTeam,
  useDeleteSDRTeam,
  useAddSDRTeamMember,
  useRemoveSDRTeamMember,
  useGenerateTeamInviteLink,
  useDeactivateTeamInviteLink,
  useDeleteSDRTranscript,
} from './sdr/mutations';

import {
  useSDRCallList,
  useSDRTranscriptList,
} from './sdr/queries';

import type {
  SDRCallDetail,
  SDRCallGradeDetail,
  SDRCallListItem,
  SDRTranscriptDetail,
} from './sdr/types';

// Legacy type aliases
export type SDRDailyTranscript = SDRTranscriptDetail;
export type SDRCall = SDRCallDetail;
export type SDRCallGrade = SDRCallGradeDetail;
export interface SDRCallWithGrade extends SDRCallListItem {
  sdr_call_grades?: SDRCallGrade[];
}

// Legacy wrapper APIs
export function useSDRDailyTranscripts(sdrId?: string) {
  return useSDRTranscriptList({ sdrId });
}

export function useSDRCalls(transcriptId?: string, sdrId?: string) {
  return useSDRCallList({
    transcriptId,
    sdrId,
    orderBy: transcriptId ? 'call_index' : 'recency',
    enabled: Boolean(transcriptId || sdrId),
  });
}
