import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  normalizeCallListParams,
  normalizeTeamGradeSummaryParams,
  normalizeTranscriptListParams,
  sdrKeys,
} from './keys';
import type {
  SDRCallDetail,
  SDRCallListParams,
  SDRCallListItem,
  SDRCoachingPrompt,
  SDRProcessingStatus,
  SDRStatsSummary,
  SDRTeam,
  SDRTeamGradeSummary,
  SDRTeamGradeSummaryParams,
  SDRTeamMemberWithProfile,
  SDRTranscriptDetail,
  SDRTranscriptListItem,
  SDRTranscriptListParams,
} from './types';

// Exported for query-contract tests.
export const SDR_TRANSCRIPT_LIST_SELECT = [
  'id',
  'sdr_id',
  'transcript_date',
  'processing_status',
  'processing_error',
  'total_calls_detected',
  'meaningful_calls_count',
  'upload_method',
  'audio_file_path',
  'created_at',
  'updated_at',
].join(', ');

const CALL_LIST_GRADE_SELECT = [
  'id',
  'call_id',
  'sdr_id',
  'overall_grade',
  'opener_score',
  'engagement_score',
  'objection_handling_score',
  'appointment_setting_score',
  'professionalism_score',
  'call_summary',
  'meeting_scheduled',
  'created_at',
].join(', ');

// Exported for query-contract tests.
export const SDR_CALL_LIST_SELECT = [
  'id',
  'daily_transcript_id',
  'sdr_id',
  'call_index',
  'call_type',
  'is_meaningful',
  'prospect_name',
  'prospect_company',
  'duration_estimate_seconds',
  'start_timestamp',
  'analysis_status',
  'processing_error',
  'created_at',
  'updated_at',
  `sdr_call_grades(${CALL_LIST_GRADE_SELECT})`,
].join(', ');

// Exported for query-contract tests.
export const SDR_CALL_DETAIL_SELECT = [
  'id',
  'daily_transcript_id',
  'sdr_id',
  'call_index',
  'raw_text',
  'call_type',
  'is_meaningful',
  'prospect_name',
  'prospect_company',
  'duration_estimate_seconds',
  'start_timestamp',
  'analysis_status',
  'processing_error',
  'created_at',
  'updated_at',
  'sdr_call_grades(id, call_id, sdr_id, overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, call_summary, strengths, improvements, key_moments, coaching_notes, coaching_feedback_helpful, coaching_feedback_note, coaching_feedback_at, meeting_scheduled, model_name, raw_json, created_at)',
].join(', ');

export function isTranscriptStuck(t: SDRTranscriptListItem): boolean {
  if (t.processing_status !== 'processing') return false;
  return Date.now() - new Date(t.updated_at).getTime() > 5 * 60 * 1000;
}

function hasPendingTranscriptStatus(items: SDRTranscriptListItem[] | undefined): boolean {
  if (!items || items.length === 0) return false;
  return items.some(
    (item) => item.processing_status === 'pending' || item.processing_status === 'processing',
  );
}

function hasPendingCallStatus(items: SDRCallListItem[] | undefined): boolean {
  if (!items || items.length === 0) return false;
  return items.some(
    (item) => item.analysis_status === 'pending' || item.analysis_status === 'processing',
  );
}

export function useSDRTranscriptList(params: SDRTranscriptListParams = {}) {
  const normalized = normalizeTranscriptListParams(params);

  return useQuery({
    queryKey: sdrKeys.transcripts.list(params),
    queryFn: async () => {
      let query = supabase.from('sdr_daily_transcripts')
        .select(SDR_TRANSCRIPT_LIST_SELECT)
        .order('transcript_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (normalized.sdrId) query = query.eq('sdr_id', normalized.sdrId);
      if (normalized.sdrIds.length > 0) query = query.in('sdr_id', normalized.sdrIds);
      if (normalized.statuses.length > 0) query = query.in('processing_status', normalized.statuses);
      if (normalized.dateFrom) query = query.gte('transcript_date', normalized.dateFrom);
      if (normalized.dateTo) query = query.lte('transcript_date', normalized.dateTo);
      if (normalized.limit) query = query.limit(normalized.limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as SDRTranscriptListItem[];
    },
    enabled: params.enabled ?? true,
    refetchInterval: (query) => {
      if (params.pollWhileProcessing === false) return false;
      const rows = query.state.data as SDRTranscriptListItem[] | undefined;
      return hasPendingTranscriptStatus(rows) ? 10_000 : false;
    },
    staleTime: 15_000,
    gcTime: 10 * 60 * 1000,
  });
}

const STUCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function computeIsStuck(transcript: SDRTranscriptDetail | undefined): boolean {
  if (!transcript) return false;
  if (transcript.processing_status !== 'processing') return false;
  const updatedAt = new Date(transcript.updated_at).getTime();
  return Date.now() - updatedAt > STUCK_THRESHOLD_MS;
}

export function useSDRTranscriptDetail(transcriptId: string | undefined) {
  const query = useQuery({
    queryKey: transcriptId ? sdrKeys.transcripts.detail(transcriptId) : [...sdrKeys.transcripts.all(), 'detail', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_daily_transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();

      if (error) throw error;
      return data as SDRTranscriptDetail;
    },
    enabled: !!transcriptId,
    refetchInterval: (q) => {
      const status = (q.state.data as SDRTranscriptDetail | undefined)?.processing_status;
      return status === 'pending' || status === 'processing' ? 3_000 : false;
    },
    staleTime: 5_000,
    gcTime: 10 * 60 * 1000,
  });

  const isStuck = computeIsStuck(query.data);

  // Detect processing -> failed transition and show toast
  const prevStatusRef = useRef<string | undefined>();
  useEffect(() => {
    const currentStatus = query.data?.processing_status;
    if (
      prevStatusRef.current === 'processing' &&
      currentStatus === 'failed'
    ) {
      toast.error(
        query.data?.processing_error || 'Transcript processing failed',
      );
    }
    prevStatusRef.current = currentStatus;
  }, [query.data?.processing_status, query.data?.processing_error]);

  return { ...query, isStuck };
}

export function useSDRCallList(params: SDRCallListParams = {}) {
  const normalized = normalizeCallListParams(params);
  const inferredEnabled = Boolean(
    normalized.transcriptId || normalized.sdrId || normalized.sdrIds.length > 0,
  );

  return useQuery({
    queryKey: sdrKeys.calls.list(params),
    queryFn: async () => {
      let query = supabase.from('sdr_calls').select(SDR_CALL_LIST_SELECT);

      if (normalized.transcriptId) query = query.eq('daily_transcript_id', normalized.transcriptId);
      if (normalized.sdrId) query = query.eq('sdr_id', normalized.sdrId);
      if (normalized.sdrIds.length > 0) query = query.in('sdr_id', normalized.sdrIds);
      if (normalized.onlyMeaningful) query = query.eq('is_meaningful', true);

      const shouldUseCallIndexOrder = normalized.orderBy === 'call_index' && !!normalized.transcriptId;
      query = shouldUseCallIndexOrder
        ? query.order('call_index', { ascending: true })
        : query.order('created_at', { ascending: false });

      if (normalized.limit) query = query.limit(normalized.limit);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SDRCallListItem[];
    },
    enabled: params.enabled ?? inferredEnabled,
    refetchInterval: (query) => {
      if (params.pollWhileProcessing === false) return false;
      const rows = query.state.data as SDRCallListItem[] | undefined;
      return hasPendingCallStatus(rows) ? 10_000 : false;
    },
    staleTime: 15_000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSDRCallDetail(callId: string | undefined) {
  return useQuery({
    queryKey: callId ? sdrKeys.calls.detail(callId) : [...sdrKeys.calls.all(), 'detail', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_calls')
        .select(SDR_CALL_DETAIL_SELECT)
        .eq('id', callId)
        .single();

      if (error) throw error;
      return data as SDRCallDetail;
    },
    enabled: !!callId,
    refetchInterval: (query) => {
      const status = (query.state.data as SDRCallDetail | undefined)?.analysis_status;
      return status === 'pending' || status === 'processing' ? 3_000 : false;
    },
    staleTime: 5_000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSDRTeams() {
  return useQuery({
    queryKey: sdrKeys.teams.all(),
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_teams')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data ?? []) as SDRTeam[];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useSDRTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: sdrKeys.teams.members(teamId),
    queryFn: async () => {
      let query = supabase.from('sdr_team_members')
        .select('id, team_id, user_id, created_at, profiles:user_id(id, name, email)')
        .order('created_at', { ascending: false });

      if (teamId) query = query.eq('team_id', teamId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SDRTeamMemberWithProfile[];
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useSDRCoachingPrompts(teamId?: string) {
  return useQuery({
    queryKey: sdrKeys.coachingPrompts.byTeam(teamId),
    queryFn: async () => {
      let query = supabase.from('sdr_coaching_prompts')
        .select('*')
        .order('created_at', { ascending: false });

      if (teamId) query = query.eq('team_id', teamId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SDRCoachingPrompt[];
    },
    staleTime: 60_000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSDRProfile(sdrId: string | undefined) {
  return useQuery({
    queryKey: sdrId ? sdrKeys.profile(sdrId) : ['sdr', 'profile', 'none'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', sdrId!)
        .single();

      if (error) throw error;
      return data as { name: string | null; email: string | null };
    },
    enabled: !!sdrId,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });
}

export function useSDRTeamGradeSummary(params: SDRTeamGradeSummaryParams) {
  const normalized = normalizeTeamGradeSummaryParams(params);

  return useQuery({
    queryKey: sdrKeys.teamGradeSummary.detail(params),
    queryFn: async () => {
      if (normalized.memberIds.length === 0) return null;

      const { data: grades, error } = await supabase.from('sdr_call_grades')
        .select('sdr_id, overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, meeting_scheduled')
        .in('sdr_id', normalized.memberIds)
        .order('created_at', { ascending: false })
        .limit(normalized.lookbackLimit);

      if (error) throw error;
      if (!grades || grades.length === 0) return null;

      type GradeRow = typeof grades[number];
      const avgScore =
        grades.reduce((sum: number, g: GradeRow) => {
          const scores = [
            g.opener_score,
            g.engagement_score,
            g.objection_handling_score,
            g.appointment_setting_score,
            g.professionalism_score,
          ].filter((score): score is number => typeof score === 'number');

          return sum + (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
        }, 0) / grades.length;

      const meetingsSet = grades.filter((g) => g.meeting_scheduled === true).length;

      const gradeDistribution: Record<string, number> = {};
      const memberStats: SDRTeamGradeSummary['memberStats'] = {};

      grades.forEach((g) => {
        gradeDistribution[g.overall_grade] = (gradeDistribution[g.overall_grade] || 0) + 1;

        if (!memberStats[g.sdr_id]) {
          memberStats[g.sdr_id] = { count: 0, totalScore: 0, meetings: 0, grades: {} };
        }

        const stats = memberStats[g.sdr_id];
        stats.count += 1;

        const scores = [
          g.opener_score,
          g.engagement_score,
          g.objection_handling_score,
          g.appointment_setting_score,
          g.professionalism_score,
        ].filter((score): score is number => typeof score === 'number');

        stats.totalScore += scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
        if (g.meeting_scheduled === true) stats.meetings += 1;
        stats.grades[g.overall_grade] = (stats.grades[g.overall_grade] || 0) + 1;
      });

      return {
        avgScore: Math.round(avgScore * 10) / 10,
        meetingsSet,
        totalGraded: grades.length,
        gradeDistribution,
        memberStats,
      } as SDRTeamGradeSummary;
    },
    enabled: params.enabled ?? normalized.memberIds.length > 0,
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useSDRStats(sdrId?: string) {
  return useQuery({
    queryKey: sdrKeys.stats.bySdr(sdrId),
    queryFn: async () => {
      const today = new Date().toLocaleDateString('en-CA');

      let transcriptQuery = supabase.from('sdr_daily_transcripts')
        .select('total_calls_detected, meaningful_calls_count, processing_status')
        .eq('transcript_date', today);

      if (sdrId) transcriptQuery = transcriptQuery.eq('sdr_id', sdrId);

      let gradesQuery = supabase.from('sdr_call_grades')
        .select('overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score');

      if (sdrId) gradesQuery = gradesQuery.eq('sdr_id', sdrId);

      const [transcriptResult, gradesResult] = await Promise.all([
        transcriptQuery,
        gradesQuery.order('created_at', { ascending: false }).limit(50),
      ]);

      if (transcriptResult.error) throw transcriptResult.error;
      if (gradesResult.error) throw gradesResult.error;

      const todayTranscripts = transcriptResult.data || [];
      const recentGrades = gradesResult.data || [];

      const totalCallsToday = todayTranscripts.reduce(
        (sum, transcript) => sum + transcript.total_calls_detected,
        0,
      );
      const meaningfulCallsToday = todayTranscripts.reduce(
        (sum, transcript) => sum + transcript.meaningful_calls_count,
        0,
      );

      const avgGrade =
        recentGrades.length > 0
          ? recentGrades.reduce((sum: number, grade) => {
              const scores = [
                grade.opener_score,
                grade.engagement_score,
                grade.objection_handling_score,
                grade.appointment_setting_score,
                grade.professionalism_score,
              ].filter((score): score is number => typeof score === 'number');

              return sum + (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
            }, 0) / recentGrades.length
          : null;

      const gradeDistribution = recentGrades.reduce<Record<string, number>>((acc, grade) => {
        acc[grade.overall_grade] = (acc[grade.overall_grade] || 0) + 1;
        return acc;
      }, {});

      return {
        totalCallsToday,
        meaningfulCallsToday,
        avgScore: avgGrade === null ? null : Math.round(avgGrade * 10) / 10,
        totalGradedCalls: recentGrades.length,
        gradeDistribution,
        processingStatus: (todayTranscripts[0]?.processing_status || null) as SDRProcessingStatus | null,
      } as SDRStatsSummary;
    },
    staleTime: 30_000,
    gcTime: 10 * 60 * 1000,
  });
}
