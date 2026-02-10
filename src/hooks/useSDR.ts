import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Types
export interface SDRDailyTranscript {
  id: string;
  sdr_id: string;
  transcript_date: string;
  raw_text: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_error: string | null;
  total_calls_detected: number;
  meaningful_calls_count: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

export interface SDRCall {
  id: string;
  daily_transcript_id: string;
  sdr_id: string;
  call_index: number;
  raw_text: string;
  call_type: 'conversation' | 'voicemail' | 'hangup' | 'internal' | 'reminder';
  is_meaningful: boolean;
  prospect_name: string | null;
  prospect_company: string | null;
  duration_estimate_seconds: number | null;
  start_timestamp: string | null;
  analysis_status: 'pending' | 'processing' | 'completed' | 'skipped' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface SDRCallGrade {
  id: string;
  call_id: string;
  sdr_id: string;
  overall_grade: string;
  opener_score: number | null;
  engagement_score: number | null;
  objection_handling_score: number | null;
  appointment_setting_score: number | null;
  professionalism_score: number | null;
  call_summary: string | null;
  strengths: string[];
  improvements: string[];
  key_moments: Array<{ timestamp: string; description: string; sentiment: string }>;
  coaching_notes: string | null;
  model_name: string;
  raw_json: any;
  created_at: string;
}

export interface SDRCallWithGrade extends SDRCall {
  sdr_call_grades?: SDRCallGrade[];
}

export interface SDRCoachingPrompt {
  id: string;
  team_id: string | null;
  created_by: string;
  agent_key: 'splitter' | 'filter' | 'grader';
  prompt_name: string;
  system_prompt: string;
  scoring_weights: Record<string, number> | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SDRTeam {
  id: string;
  name: string;
  manager_id: string;
  created_at: string;
  updated_at: string;
}

export interface SDRTeamMember {
  id: string;
  team_id: string;
  user_id: string;
  created_at: string;
}

// ---- Hooks ----

export function useSDRDailyTranscripts(sdrId?: string) {
  return useQuery({
    queryKey: ['sdr-daily-transcripts', sdrId],
    queryFn: async () => {
      let query = (supabase.from as any)('sdr_daily_transcripts')
        .select('*')
        .order('transcript_date', { ascending: false });
      
      if (sdrId) {
        query = query.eq('sdr_id', sdrId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as SDRDailyTranscript[];
    },
    enabled: true,
  });
}

export function useSDRTranscriptDetail(transcriptId: string | undefined) {
  return useQuery({
    queryKey: ['sdr-transcript-detail', transcriptId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('sdr_daily_transcripts')
        .select('*')
        .eq('id', transcriptId)
        .single();
      if (error) throw error;
      return data as SDRDailyTranscript;
    },
    enabled: !!transcriptId,
    refetchInterval: (query) => {
      const status = query.state.data?.processing_status;
      return status === 'processing' || status === 'pending' ? 3000 : false;
    },
  });
}

export function useSDRCalls(transcriptId?: string, sdrId?: string) {
  return useQuery({
    queryKey: ['sdr-calls', transcriptId, sdrId],
    queryFn: async () => {
      let query = (supabase.from as any)('sdr_calls')
        .select('*, sdr_call_grades(*)')
        .order('call_index', { ascending: true });

      if (transcriptId) query = query.eq('daily_transcript_id', transcriptId);
      if (sdrId) query = query.eq('sdr_id', sdrId);

      const { data, error } = await query;
      if (error) throw error;
      return data as SDRCallWithGrade[];
    },
    enabled: !!(transcriptId || sdrId),
  });
}

export function useSDRCallDetail(callId: string | undefined) {
  return useQuery({
    queryKey: ['sdr-call-detail', callId],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('sdr_calls')
        .select('*, sdr_call_grades(*)')
        .eq('id', callId)
        .single();
      if (error) throw error;
      return data as SDRCallWithGrade;
    },
    enabled: !!callId,
  });
}

export function useUploadSDRTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rawText, transcriptDate, sdrId }: { rawText: string; transcriptDate?: string; sdrId?: string }) => {
      const { data, error } = await supabase.functions.invoke('sdr-process-transcript', {
        body: { raw_text: rawText, transcript_date: transcriptDate, sdr_id: sdrId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-daily-transcripts'] });
      toast.success('Transcript uploaded and processing started');
    },
    onError: (error) => {
      toast.error('Failed to upload transcript: ' + (error as Error).message);
    },
  });
}

export function useRetrySDRTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transcriptId: string) => {
      const { data, error } = await supabase.functions.invoke('sdr-process-transcript', {
        body: { daily_transcript_id: transcriptId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-daily-transcripts'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-transcript-detail'] });
      toast.success('Transcript reprocessing started');
    },
    onError: (error) => {
      toast.error('Failed to retry transcript: ' + (error as Error).message);
    },
  });
}

export function useReGradeCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const { data, error } = await supabase.functions.invoke('sdr-grade-call', {
        body: { call_id: callId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-calls'] });
      queryClient.invalidateQueries({ queryKey: ['sdr-call-detail'] });
      toast.success('Call re-graded successfully');
    },
    onError: (error) => {
      toast.error('Failed to re-grade call: ' + (error as Error).message);
    },
  });
}

// SDR Manager hooks
export function useSDRTeams() {
  return useQuery({
    queryKey: ['sdr-teams'],
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)('sdr_teams').select('*');
      if (error) throw error;
      return data as SDRTeam[];
    },
  });
}

export function useSDRTeamMembers(teamId?: string) {
  return useQuery({
    queryKey: ['sdr-team-members', teamId],
    queryFn: async () => {
      let query = (supabase.from as any)('sdr_team_members').select('*, profiles:user_id(id, name, email)');
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: true,
  });
}

export function useSDRCoachingPrompts(teamId?: string) {
  return useQuery({
    queryKey: ['sdr-coaching-prompts', teamId],
    queryFn: async () => {
      let query = (supabase.from as any)('sdr_coaching_prompts').select('*').order('created_at', { ascending: false });
      if (teamId) query = query.eq('team_id', teamId);
      const { data, error } = await query;
      if (error) throw error;
      return data as SDRCoachingPrompt[];
    },
  });
}

export function useUpdateCoachingPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SDRCoachingPrompt> & { id: string }) => {
      const { error } = await (supabase.from as any)('sdr_coaching_prompts')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-coaching-prompts'] });
      toast.success('Coaching prompt updated');
    },
  });
}

export function useCreateCoachingPrompt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (prompt: Omit<SDRCoachingPrompt, 'id' | 'created_at' | 'updated_at'>) => {
      const { error } = await (supabase.from as any)('sdr_coaching_prompts').insert(prompt);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sdr-coaching-prompts'] });
      toast.success('Coaching prompt created');
    },
  });
}

// Stats helpers
export function useSDRStats(sdrId?: string) {
  return useQuery({
    queryKey: ['sdr-stats', sdrId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get today's transcript
      let transcriptQuery = (supabase.from as any)('sdr_daily_transcripts')
        .select('total_calls_detected, meaningful_calls_count, processing_status')
        .eq('transcript_date', today);
      if (sdrId) transcriptQuery = transcriptQuery.eq('sdr_id', sdrId);

      // Get recent grades
      let gradesQuery = (supabase.from as any)('sdr_call_grades')
        .select('overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score');
      if (sdrId) gradesQuery = gradesQuery.eq('sdr_id', sdrId);

      const [transcriptResult, gradesResult] = await Promise.all([
        transcriptQuery,
        gradesQuery.order('created_at', { ascending: false }).limit(50),
      ]);

      const todayTranscripts = transcriptResult.data || [];
      const recentGrades = gradesResult.data || [];

      const totalCallsToday = todayTranscripts.reduce((sum: number, t: any) => sum + t.total_calls_detected, 0);
      const meaningfulCallsToday = todayTranscripts.reduce((sum: number, t: any) => sum + t.meaningful_calls_count, 0);
      
      const avgGrade = recentGrades.length > 0
        ? recentGrades.reduce((sum: number, g: any) => {
            const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean);
            return sum + (scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
          }, 0) / recentGrades.length
        : null;

      const gradeDistribution = recentGrades.reduce((acc: Record<string, number>, g: any) => {
        acc[g.overall_grade] = (acc[g.overall_grade] || 0) + 1;
        return acc;
      }, {});

      return {
        totalCallsToday,
        meaningfulCallsToday,
        avgScore: avgGrade ? Math.round(avgGrade * 10) / 10 : null,
        totalGradedCalls: recentGrades.length,
        gradeDistribution,
        processingStatus: todayTranscripts[0]?.processing_status || null,
      };
    },
  });
}
