import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useDateRangeSelector } from '@/hooks/useDateRangeSelector';
import { 
  fetchBackgroundJob, 
  fetchActiveJob, 
  cancelBackgroundJob, 
  cancelStalledJob,
  startEmbeddingsBackfillJob,
  startFullReindexJob,
  isJobStalled,
  processNERBatch,
  NERBatchResult
} from '@/api/backgroundJobs';

const log = createLogger('transcriptAnalysis');
import { useTeams, useReps } from '@/hooks';
import { Transcript, TranscriptAnalysisStatus } from './constants';

interface UseTranscriptAnalysisOptions {
  scope?: 'org' | 'team' | 'self';
}

export function useTranscriptAnalysis(options: UseTranscriptAnalysisOptions = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role, user } = useAuth();
  
  // Determine scope based on role if not explicitly set
  const scope = options.scope ?? (
    role === 'admin' ? 'org' : 
    role === 'manager' ? 'team' : 
    'self'
  );
  const isTeamScoped = scope === 'team';
  const isSelfScoped = scope === 'self';
  
  // Date range hook
  const {
    dateRange,
    selectedPreset,
    handlePresetChange: onPresetChange,
    handleFromDateChange: onFromDateChange,
    handleToDateChange: onToDateChange,
  } = useDateRangeSelector({ initialPreset: '30' });
  
  // Filter state
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [selectedCallTypes, setSelectedCallTypes] = useState<string[]>([]);
  const [selectedAnalysisStatus, setSelectedAnalysisStatus] = useState<'all' | TranscriptAnalysisStatus>('all');
  
  // Selection state
  const [selectedTranscriptIds, setSelectedTranscriptIds] = useState<Set<string>>(new Set());
  const [currentSelectionId, setCurrentSelectionId] = useState<string | null>(null);
  
  // Chat panel state
  const [chatOpen, setChatOpen] = useState(false);
  
  // Dialog states
  const [saveSelectionOpen, setSaveSelectionOpen] = useState(false);
  const [savedSelectionsOpen, setSavedSelectionsOpen] = useState(false);
  const [savedInsightsOpen, setSavedInsightsOpen] = useState(false);
  
  // Background job state for embeddings/reindex (still uses database polling)
  const [activeEmbeddingsJobId, setActiveEmbeddingsJobId] = useState<string | null>(null);
  const [activeReindexJobId, setActiveReindexJobId] = useState<string | null>(null);
  
  // Frontend-driven NER backfill state (using useRef to avoid stale closure issues)
  const [isNERBackfillRunning, setIsNERBackfillRunning] = useState(false);
  const [nerProgress, setNerProgress] = useState<{ processed: number; total: number } | null>(null);
  const [nerLastUpdateTime, setNerLastUpdateTime] = useState<number | null>(null);
  const shouldStopNERRef = useRef(false);
  const nerRetryCountRef = useRef(0);
  const nerBatchCountRef = useRef(0);
  const MAX_NER_RETRIES = 3;
  const TOKEN_REFRESH_INTERVAL = 10; // Refresh token every 10 batches
  
  // Pre-indexing state
  const [isIndexing, setIsIndexing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState<string | null>(null);
  const [isSelectingAll, setIsSelectingAll] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50;

  // Handle shared selection/insight from URL params
  useEffect(() => {
    const shareToken = searchParams.get('share');
    const insightToken = searchParams.get('insight');
    
    if (shareToken) {
      loadSharedSelection(shareToken);
    }
    if (insightToken) {
      setSavedInsightsOpen(true);
    }
  }, [searchParams]);

  const loadSharedSelection = async (shareToken: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_transcript_selections')
        .select('*')
        .eq('share_token', shareToken)
        .maybeSingle(); // Use maybeSingle - token may be invalid
      
      if (error || !data) {
        toast.error('Shared selection not found or access denied');
        setSearchParams({});
        return;
      }
      
      handleLoadSelection(data);
      toast.success(`Loaded shared selection: ${data.name}`);
      setSearchParams({});
    } catch (err) {
      log.error('Error loading shared selection', { error: err });
      toast.error('Failed to load shared selection');
      setSearchParams({});
    }
  };

  const handleLoadSelection = (selection: { id: string; transcript_ids: string[]; filters?: Json | null }) => {
    setSelectedTranscriptIds(new Set(selection.transcript_ids || []));
    setCurrentSelectionId(selection.id);
    
    if (selection.filters && typeof selection.filters === 'object' && !Array.isArray(selection.filters)) {
      const f = selection.filters as {
        dateRange?: { from: string; to: string };
        selectedTeamId?: string;
        selectedRepId?: string;
        accountSearch?: string;
        selectedCallTypes?: string[];
      };
      if (f.dateRange) {
        onPresetChange('custom');
      }
      if (f.selectedTeamId) setSelectedTeamId(f.selectedTeamId);
      if (f.selectedRepId) setSelectedRepId(f.selectedRepId);
      if (f.accountSearch) setAccountSearch(f.accountSearch);
      if (f.selectedCallTypes) setSelectedCallTypes(f.selectedCallTypes);
    }
  };

  // Get manager's team ID for team-scoped view
  const { data: managerTeam } = useQuery({
    queryKey: ['manager-team', user?.id],
    queryFn: async () => {
      if (!user?.id || !isTeamScoped) return null;
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .eq('manager_id', user.id)
        .maybeSingle(); // Use maybeSingle to return null instead of error when no team found
      if (error) throw error;
      if (!data) {
        log.warn('Manager has no team assigned', { userId: user.id });
      }
      return data;
    },
    enabled: !!user?.id && isTeamScoped,
  });

  // For self-scoped view (reps), we use the current user's ID
  const selfRepId = isSelfScoped ? user?.id : null;

  // Use reusable hooks for teams and reps
  const { data: teams, isLoading: isLoadingTeams } = useTeams();
  
  // For team-scoped view, auto-filter to manager's team
  const effectiveTeamId = isTeamScoped && managerTeam ? managerTeam.id : selectedTeamId;
  
  const { data: reps, isLoading: isLoadingReps } = useReps({ 
    teamId: effectiveTeamId !== 'all' ? effectiveTeamId : undefined 
  });

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.from, dateRange.to, selectedTeamId, selectedRepId, accountSearch, selectedCallTypes, selectedAnalysisStatus]);

  // Fetch transcripts with filters and server-side pagination using optimized RPC
  const { data: transcriptsData, isLoading } = useQuery({
    queryKey: [
      'admin-transcripts',
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      effectiveTeamId,
      selectedRepId,
      accountSearch,
      selectedCallTypes,
      selectedAnalysisStatus,
      currentPage,
      pageSize,
      isTeamScoped,
      isSelfScoped,
      selfRepId,
    ],
    queryFn: async () => {
      let repIds: string[] | null = null;
      
      // For self-scoped (rep), always filter to only their own transcripts
      if (isSelfScoped && selfRepId) {
        repIds = [selfRepId];
      } else if (selectedRepId !== 'all') {
        repIds = [selectedRepId];
      } else if (effectiveTeamId !== 'all') {
        const { data: teamReps } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', effectiveTeamId);
        repIds = (teamReps || []).map(r => r.id);
      }

      // Determine analysis status filter
      const analysisStatusFilter = selectedAnalysisStatus === 'all' 
        ? ['completed', 'skipped'] 
        : [selectedAnalysisStatus];

      // Use optimized RPC function - single query with JOINs instead of 3 separate queries
      const { data, error } = await (supabase.rpc as Function)(
        'get_admin_transcripts',
        {
          p_from_date: format(dateRange.from, 'yyyy-MM-dd'),
          p_to_date: format(dateRange.to, 'yyyy-MM-dd'),
          p_rep_ids: repIds,
          p_analysis_status: analysisStatusFilter,
          p_account_search: accountSearch.trim() || null,
          p_call_types: selectedCallTypes.length > 0 ? selectedCallTypes : null,
          p_limit: pageSize,
          p_offset: (currentPage - 1) * pageSize,
        }
      );

      if (error) throw error;

      const results = data as Array<{
        id: string;
        call_date: string;
        account_name: string | null;
        call_type: string | null;
        raw_text: string;
        rep_id: string;
        analysis_status: string;
        rep_name: string;
        team_name: string;
        total_count: number;
      }>;

      const totalCount = results.length > 0 ? results[0].total_count : 0;

      const transcripts = results.map(t => ({
        id: t.id,
        call_date: t.call_date,
        account_name: t.account_name,
        call_type: t.call_type,
        raw_text: t.raw_text,
        rep_id: t.rep_id,
        analysis_status: t.analysis_status,
        rep_name: t.rep_name,
        team_name: t.team_name,
      })) as Transcript[];

      return {
        transcripts,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    },
    enabled: isSelfScoped ? !!selfRepId : (!isTeamScoped || !!managerTeam),
  });

  const transcripts = transcriptsData?.transcripts || [];
  const totalCount = transcriptsData?.totalCount || 0;
  const totalPages = transcriptsData?.totalPages || 1;
  // Query to check which transcripts are already chunked (for current selection)
  // Optimized: Uses server-side aggregation via RPC function instead of fetching all transcript_ids
  const { data: chunkStatus, refetch: refetchChunkStatus } = useQuery({
    queryKey: ['chunk-status', transcripts?.map(t => t.id).sort().join(',')],
    queryFn: async () => {
      if (!transcripts?.length) return { indexed: 0, total: 0 };
      const ids = transcripts.map(t => t.id);
      
      // Use optimized RPC function for server-side counting
      // Reduces data transfer from ~50KB to ~100 bytes
      const { data, error } = await (supabase.rpc as Function)(
        'get_chunk_status_for_transcripts',
        { transcript_ids: ids }
      );
      
      if (error) throw error;
      
      const result = data as { indexed_count: number; total_count: number };
      return { indexed: result.indexed_count || 0, total: ids.length };
    },
    enabled: !!transcripts?.length,
    staleTime: 30 * 1000, // 30 seconds - chunk status can change during indexing
  });

  // Query for global chunk status using efficient server-side aggregation
  // This replaces 3 separate queries with 1 RPC call, reducing data transfer from ~5MB to ~100 bytes
  const { data: globalChunkStatus, refetch: refetchGlobalChunkStatus } = useQuery({
    queryKey: ['global-chunk-status'],
    queryFn: async () => {
      // Cast to any because the function was just added and types haven't regenerated yet
      const { data, error } = await (supabase.rpc as Function)('get_rag_health_stats');
      
      if (error) throw error;
      
      const stats = data as Record<string, number>;
      
      return { 
        indexed: stats.unique_transcripts || 0, 
        total: stats.total_eligible_transcripts || 0,
        totalChunks: stats.total_chunks || 0,
        withEmbeddings: stats.with_embeddings || 0,
        missingEmbeddings: (stats.total_chunks || 0) - (stats.with_embeddings || 0),
        nerCompleted: stats.ner_completed || 0,
        nerPending: stats.ner_pending || 0
      };
    },
    enabled: role === 'admin',
    staleTime: 2 * 60 * 1000, // 2 minutes - stats don't change frequently
  });

  // Check for existing active embeddings job on page load
  const { data: existingEmbeddingsJob } = useQuery({
    queryKey: ['active-job', 'embedding_backfill'],
    queryFn: () => fetchActiveJob('embedding_backfill'),
    enabled: role === 'admin' && !activeEmbeddingsJobId,
    staleTime: 0,
  });

  useEffect(() => {
    if (existingEmbeddingsJob && !activeEmbeddingsJobId) {
      setActiveEmbeddingsJobId(existingEmbeddingsJob.id);
      toast.info('Found active embeddings backfill job, resuming tracking...');
    }
  }, [existingEmbeddingsJob, activeEmbeddingsJobId]);

  // Check for existing active reindex job on page load
  const { data: existingReindexJob } = useQuery({
    queryKey: ['active-job', 'full_reindex'],
    queryFn: () => fetchActiveJob('full_reindex'),
    enabled: role === 'admin' && !activeReindexJobId,
    staleTime: 0,
  });

  // Resume tracking existing reindex job
  useEffect(() => {
    if (existingReindexJob && !activeReindexJobId) {
      setActiveReindexJobId(existingReindexJob.id);
      toast.info('Found active full reindex job, resuming tracking...');
    }
  }, [existingReindexJob, activeReindexJobId]);

  // Poll embeddings job status
  const { data: embeddingsJobStatus } = useQuery({
    queryKey: ['background-job', 'embeddings', activeEmbeddingsJobId],
    queryFn: () => fetchBackgroundJob(activeEmbeddingsJobId!),
    enabled: !!activeEmbeddingsJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

  // Poll reindex job status
  const { data: reindexJobStatus } = useQuery({
    queryKey: ['background-job', 'reindex', activeReindexJobId],
    queryFn: () => fetchBackgroundJob(activeReindexJobId!),
    enabled: !!activeReindexJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

  // Check if jobs are stalled (no update in 60+ seconds)
  const isEmbeddingsJobStalled = embeddingsJobStatus ? isJobStalled(embeddingsJobStatus) : false;
  const isReindexJobStalled = reindexJobStatus ? isJobStalled(reindexJobStatus) : false;

  // Auto-cancel stalled jobs after 2 minutes of no updates
  useEffect(() => {
    if (isEmbeddingsJobStalled && embeddingsJobStatus && activeEmbeddingsJobId) {
      const stalledMs = Date.now() - new Date(embeddingsJobStatus.updated_at).getTime();
      if (stalledMs > 120000) { // 2 minutes
        cancelStalledJob(activeEmbeddingsJobId).then(cancelled => {
          if (cancelled) {
            toast.warning('Embeddings job was stalled and has been cancelled. You can restart it.');
            setActiveEmbeddingsJobId(null);
            refetchGlobalChunkStatus();
          }
        });
      }
    }
  }, [isEmbeddingsJobStalled, embeddingsJobStatus, activeEmbeddingsJobId, refetchGlobalChunkStatus]);

  useEffect(() => {
    if (isReindexJobStalled && reindexJobStatus && activeReindexJobId) {
      const stalledMs = Date.now() - new Date(reindexJobStatus.updated_at).getTime();
      if (stalledMs > 120000) { // 2 minutes
        cancelStalledJob(activeReindexJobId).then(cancelled => {
          if (cancelled) {
            toast.warning('Reindex job was stalled and has been cancelled. You can restart it.');
            setActiveReindexJobId(null);
            setIsResetting(false);
            setResetProgress(null);
            refetchGlobalChunkStatus();
          }
        });
      }
    }
  }, [isReindexJobStalled, reindexJobStatus, activeReindexJobId, refetchGlobalChunkStatus]);

  // Handle embeddings job status changes
  useEffect(() => {
    if (embeddingsJobStatus) {
      if (embeddingsJobStatus.status === 'completed') {
        toast.success('Embeddings backfill complete!');
        setActiveEmbeddingsJobId(null);
        refetchGlobalChunkStatus();
      } else if (embeddingsJobStatus.status === 'failed') {
        toast.error(`Embeddings backfill failed: ${embeddingsJobStatus.error || 'Unknown error'}`);
        setActiveEmbeddingsJobId(null);
      } else if (embeddingsJobStatus.status === 'cancelled') {
        toast.info('Embeddings backfill cancelled');
        setActiveEmbeddingsJobId(null);
        refetchGlobalChunkStatus();
      }
    }
  }, [embeddingsJobStatus?.status, embeddingsJobStatus?.error, refetchGlobalChunkStatus]);

  // Handle reindex job status changes
  useEffect(() => {
    if (reindexJobStatus) {
      const progress = reindexJobStatus.progress as { message?: string; overall_percent?: number } | null;
      setResetProgress(progress?.message || null);
      
      if (reindexJobStatus.status === 'completed') {
        toast.success('Full reindex complete!');
        setActiveReindexJobId(null);
        setIsResetting(false);
        setResetProgress(null);
        refetchGlobalChunkStatus();
      } else if (reindexJobStatus.status === 'failed') {
        toast.error(`Full reindex failed: ${reindexJobStatus.error || 'Unknown error'}`);
        setActiveReindexJobId(null);
        setIsResetting(false);
        setResetProgress(null);
      } else if (reindexJobStatus.status === 'cancelled') {
        toast.info('Full reindex cancelled');
        setActiveReindexJobId(null);
        setIsResetting(false);
        setResetProgress(null);
        refetchGlobalChunkStatus();
      }
    }
  }, [reindexJobStatus?.status, reindexJobStatus?.error, reindexJobStatus?.progress, refetchGlobalChunkStatus]);

  // Derived state from job polling and frontend state
  const isBackfillingEntities = isNERBackfillRunning;
  const isBackfillingEmbeddings = embeddingsJobStatus?.status === 'processing' || embeddingsJobStatus?.status === 'pending';
  const entitiesProgress = nerProgress;
  const embeddingsProgress = embeddingsJobStatus?.progress as { processed: number; total: number } | null;
  const reindexProgress = reindexJobStatus?.progress as { message?: string; overall_percent?: number; stage?: string } | null;

  // Helper to get a fresh access token with session refresh
  const getFreshToken = async (): Promise<string | null> => {
    // Get current session
    let { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return null;
    }
    
    // Refresh to ensure token is valid
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError || !refreshData.session) {
      log.warn('Session refresh failed', { error: refreshError });
      return null;
    }
    
    return refreshData.session.access_token;
  };

  // Pre-index handler (for selected transcripts on current page)
  const handlePreIndex = async () => {
    if (!transcripts?.length) return;
    setIsIndexing(true);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ transcript_ids: transcripts.map(t => t.id) }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to pre-index transcripts');
      }
      
      const result = await response.json();
      toast.success(`Indexed ${result.new_chunks || 0} new chunks`);
      refetchChunkStatus();
      refetchGlobalChunkStatus();
    } catch (err) {
      log.error('Pre-index error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to pre-index transcripts');
    } finally {
      setIsIndexing(false);
    }
  };

  // Backfill all handler (admin only - indexes ALL unchunked transcripts)
  const handleBackfillAll = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill all transcripts');
      return;
    }
    
    setIsBackfilling(true);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      toast.info('Starting backfill of all unchunked transcripts...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ backfill_all: true }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to backfill transcripts');
      }
      
      const result = await response.json();
      
      if (result.new_chunks === 0) {
        toast.success('All transcripts are already indexed');
      } else {
        toast.success(`Backfill complete: ${result.new_chunks} chunks created from ${result.indexed - (globalChunkStatus?.indexed || 0)} transcripts`);
      }
      
      refetchChunkStatus();
      refetchGlobalChunkStatus();
    } catch (err) {
      log.error('Backfill error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to backfill transcripts');
    } finally {
      setIsBackfilling(false);
    }
  };

  // Start embeddings backfill - now uses background job system
  const handleBackfillEmbeddings = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill embeddings');
      return;
    }
    
    // Check if already running
    if (activeEmbeddingsJobId) {
      toast.info('Embeddings backfill is already in progress');
      return;
    }
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      const { jobId } = await startEmbeddingsBackfillJob(token);
      setActiveEmbeddingsJobId(jobId);
      toast.success('Embeddings backfill started in background');
    } catch (err) {
      log.error('Failed to start embeddings backfill', { error: err });
      if (err instanceof Error && err.message.includes('already in progress')) {
        toast.info('An embeddings backfill is already in progress');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to start embeddings backfill');
      }
    }
  };

  // Stop embeddings backfill
  const stopEmbeddingsBackfill = async () => {
    if (!activeEmbeddingsJobId) return;
    
    try {
      await cancelBackgroundJob(activeEmbeddingsJobId);
      toast.info('Cancellation requested...');
    } catch (err) {
      log.error('Failed to cancel embeddings backfill', { error: err });
      toast.error('Failed to cancel backfill');
    }
  };

  // Reset and reindex all handler (admin only - now uses background job system)
  const handleResetAndReindex = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can reset the RAG system');
      return;
    }
    
    // Check if already running
    if (activeReindexJobId) {
      toast.info('Full reindex is already in progress');
      return;
    }
    
    if (!confirm('⚠️ FULL RAG RESET\n\nThis will:\n1. Delete ALL existing chunks\n2. Re-chunk all transcripts\n3. Generate embeddings for all chunks\n4. Run NER extraction on all chunks\n\nThis runs in the background and may take 15-30 minutes. Continue?')) {
      return;
    }
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      const { jobId } = await startFullReindexJob(token);
      setActiveReindexJobId(jobId);
      setIsResetting(true);
      setResetProgress('Starting full reindex...');
      toast.success('Full reindex started in background');
    } catch (err) {
      log.error('Failed to start full reindex', { error: err });
      if (err instanceof Error && err.message.includes('already in progress')) {
        toast.info('A full reindex is already in progress');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to start full reindex');
      }
    }
  };

  // Stop full reindex
  const stopReindex = async () => {
    if (!activeReindexJobId) return;
    
    try {
      await cancelBackgroundJob(activeReindexJobId);
      toast.info('Cancellation requested...');
    } catch (err) {
      log.error('Failed to cancel full reindex', { error: err });
      toast.error('Failed to cancel reindex');
    }
  };

  // Start NER entities backfill - frontend-driven pattern
  const handleBackfillEntities = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill entities');
      return;
    }
    
    // Check if already running
    if (isNERBackfillRunning) {
      toast.info('NER backfill is already in progress');
      return;
    }
    
    const initialToken = await getFreshToken();
    if (!initialToken) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }
    
    // Reset stop flag, retry count, and batch count
    shouldStopNERRef.current = false;
    nerRetryCountRef.current = 0;
    nerBatchCountRef.current = 0;
    setIsNERBackfillRunning(true);
    
    // Set initial progress immediately so progress bar shows
    const initialPending = globalChunkStatus?.nerPending || 0;
    const initialCompleted = globalChunkStatus?.nerCompleted || 0;
    setNerProgress({
      processed: initialCompleted,
      total: initialCompleted + initialPending
    });
    setNerLastUpdateTime(Date.now());
    
    toast.success('NER extraction started...');
    
    // Frontend-driven loop with token refresh
    const runNERLoop = async () => {
      let currentToken = initialToken;
      
      while (!shouldStopNERRef.current) {
        try {
          // Refresh token every TOKEN_REFRESH_INTERVAL batches to prevent expiration
          if (nerBatchCountRef.current > 0 && nerBatchCountRef.current % TOKEN_REFRESH_INTERVAL === 0) {
            log.info('Refreshing auth token', { batchCount: nerBatchCountRef.current });
            const freshToken = await getFreshToken();
            if (!freshToken) {
              toast.error('Session expired. Please sign in again and restart.');
              break;
            }
            currentToken = freshToken;
          }
          
          const result = await processNERBatch(currentToken, 10);
          nerBatchCountRef.current++;
          
          // Update progress
          setNerProgress({
            processed: result.total - result.remaining,
            total: result.total
          });
          setNerLastUpdateTime(Date.now());
          
          // Reset retry count on success
          nerRetryCountRef.current = 0;
          
          // Check if complete
          if (result.complete || result.remaining === 0) {
            toast.success(`NER extraction complete! Processed ${result.total} chunks`);
            break;
          }
          
          // Small delay between batches to avoid overwhelming the API
          await new Promise(r => setTimeout(r, 500));
          
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : '';
          
          // Check for auth errors specifically
          const isAuthError = errorMessage.includes('[401]') || 
                              errorMessage.includes('[403]') || 
                              errorMessage.toLowerCase().includes('unauthorized') ||
                              errorMessage.toLowerCase().includes('jwt');
          
          if (isAuthError) {
            // Immediate token refresh on auth error
            log.info('Auth error detected, refreshing token');
            const freshToken = await getFreshToken();
            if (freshToken) {
              currentToken = freshToken;
              toast.info('Refreshed authentication, continuing...');
              continue; // Don't count as retry, try again immediately
            } else {
              toast.error('Session expired. Please sign in again.');
              break;
            }
          }
          
          // For non-auth errors, use retry logic with exponential backoff
          nerRetryCountRef.current++;
          log.error('NER batch failed', { error: err, retryCount: nerRetryCountRef.current });
          
          const errMsg = err instanceof Error ? err.message : '';
          const isNetworkError = errMsg.includes('Failed to fetch') || 
                                 errMsg.includes('timed out') ||
                                 errMsg.includes('NetworkError');
          
          // More lenient retry for network errors (they're transient)
          const effectiveMaxRetries = isNetworkError ? MAX_NER_RETRIES * 2 : MAX_NER_RETRIES;
          
          if (nerRetryCountRef.current >= effectiveMaxRetries) {
            toast.error(`NER extraction stopped after ${nerRetryCountRef.current} consecutive failures. Click "Backfill Entities" to resume.`);
            break;
          }
          
          // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
          const backoffDelay = Math.min(2000 * Math.pow(2, nerRetryCountRef.current - 1), 30000);
          toast.warning(`NER batch failed, retrying in ${backoffDelay / 1000}s... (${nerRetryCountRef.current}/${effectiveMaxRetries})`);
          await new Promise(r => setTimeout(r, backoffDelay));
        }
      }
      
      // Cleanup - capture stop state before resetting
      const wasStopped = shouldStopNERRef.current;
      setIsNERBackfillRunning(false);
      shouldStopNERRef.current = false;
      nerBatchCountRef.current = 0;
      refetchGlobalChunkStatus();
      
      if (wasStopped) {
        toast.info('NER extraction stopped');
      }
    };
    
    // Start the loop (don't await - runs in background)
    runNERLoop();
  };

  // Stop NER backfill - frontend-driven pattern
  const stopNERBackfill = () => {
    if (!isNERBackfillRunning) return;
    shouldStopNERRef.current = true;
    toast.info('Stopping NER extraction...');
  };

  const handlePresetChange = (value: string) => {
    onPresetChange(value as any);
  };

  const handleFromDateChange = (date: Date | undefined) => {
    onFromDateChange(date);
  };

  const handleToDateChange = (date: Date | undefined) => {
    onToDateChange(date);
  };

  const toggleTranscript = (id: string) => {
    setSelectedTranscriptIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (transcripts) {
      setSelectedTranscriptIds(new Set(transcripts.map(t => t.id)));
    }
  };

  const selectAllMatching = async () => {
    setIsSelectingAll(true);
    try {
      let repIds: string[] = [];
      
      if (isSelfScoped && selfRepId) {
        repIds = [selfRepId];
      } else if (selectedRepId !== 'all') {
        repIds = [selectedRepId];
      } else if (effectiveTeamId !== 'all') {
        const { data: teamReps } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', effectiveTeamId);
        repIds = (teamReps || []).map(r => r.id);
      }

      let query = supabase
        .from('call_transcripts')
        .select('id')
        .gte('call_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('call_date', format(dateRange.to, 'yyyy-MM-dd'));

      if (selectedAnalysisStatus === 'all') {
        query = query.in('analysis_status', ['completed', 'skipped']);
      } else {
        query = query.eq('analysis_status', selectedAnalysisStatus);
      }

      if (repIds.length > 0) {
        query = query.in('rep_id', repIds);
      }

      if (accountSearch.trim()) {
        query = query.ilike('account_name', `%${accountSearch.trim()}%`);
      }

      if (selectedCallTypes.length > 0) {
        query = query.in('call_type', selectedCallTypes);
      }

      const { data, error } = await query;
      if (error) throw error;

      const allIds = (data || []).map(t => t.id);
      setSelectedTranscriptIds(new Set(allIds));
      toast.success(`Selected ${allIds.length} transcripts`);
    } catch (err) {
      log.error('Error selecting all matching transcripts', { error: err });
      toast.error('Failed to select all matching transcripts');
    } finally {
      setIsSelectingAll(false);
    }
  };

  const deselectAll = () => {
    setSelectedTranscriptIds(new Set());
  };

  const toggleCallType = (callType: string) => {
    setSelectedCallTypes(prev => 
      prev.includes(callType) 
        ? prev.filter(t => t !== callType)
        : [...prev, callType]
    );
  };

  const getAnalysisModeLabel = () => {
    const count = selectedTranscriptIds.size;
    if (count === 0) return { label: 'Select transcripts', color: 'text-muted-foreground', useRag: false };
    if (count <= 20) return { label: 'Direct Analysis Mode', color: 'text-green-500', useRag: false };
    return { label: 'RAG Mode', color: 'text-amber-500', useRag: true };
  };

  const analysisMode = getAnalysisModeLabel();

  // Fetch full transcript data for all selected IDs (handles cross-page selections)
  const { data: selectedTranscripts = [] } = useQuery({
    queryKey: ['selected-transcripts', Array.from(selectedTranscriptIds).sort().join(',')],
    queryFn: async () => {
      if (selectedTranscriptIds.size === 0) return [];
      
      const ids = Array.from(selectedTranscriptIds);
      const { data, error } = await supabase
        .from('call_transcripts')
        .select('id, call_date, account_name, call_type, raw_text, rep_id, analysis_status')
        .in('id', ids);
      
      if (error) throw error;
      
      // Fetch rep names for the transcripts
      const repIdSet = new Set((data || []).map(t => t.rep_id));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .in('id', Array.from(repIdSet));
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const teamMap = new Map((teams || []).map(t => [t.id, t.name]));
      
      return (data || []).map(t => ({
        ...t,
        rep_name: profileMap.get(t.rep_id)?.name || 'Unknown',
        team_name: teamMap.get(profileMap.get(t.rep_id)?.team_id || '') || 'Unknown',
      })) as Transcript[];
    },
    enabled: selectedTranscriptIds.size > 0,
    staleTime: 60000, // 1 minute - selections don't change often
  });

  // Calculate token estimate - uses selectedTranscripts from query (supports cross-page)
  const estimatedTokens = useMemo(() => {
    const totalChars = selectedTranscripts.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0);
    return Math.round(totalChars / 4);
  }, [selectedTranscripts]);

  return {
    // Scope info
    scope,
    isTeamScoped,
    isSelfScoped,
    managerTeam,
    
    // Filter state
    dateRange,
    selectedPreset,
    selectedTeamId,
    setSelectedTeamId,
    selectedRepId,
    setSelectedRepId,
    accountSearch,
    setAccountSearch,
    selectedCallTypes,
    selectedAnalysisStatus,
    setSelectedAnalysisStatus,
    
    // Data
    teams,
    reps,
    isLoadingTeams,
    isLoadingReps,
    transcripts,
    totalCount,
    totalPages,
    isLoading,
    chunkStatus,
    globalChunkStatus,
    
    // Selection
    selectedTranscriptIds,
    currentSelectionId,
    setCurrentSelectionId,
    selectedTranscripts,
    
    // UI state
    chatOpen,
    setChatOpen,
    saveSelectionOpen,
    setSaveSelectionOpen,
    savedSelectionsOpen,
    setSavedSelectionsOpen,
    savedInsightsOpen,
    setSavedInsightsOpen,
    isIndexing,
    isBackfilling,
    isBackfillingEmbeddings,
    isBackfillingEntities,
    isResetting,
    isSelectingAll,
    resetProgress,
    embeddingsProgress,
    entitiesProgress,
    isEmbeddingsJobStalled,
    isNERJobStalled: isNERBackfillRunning && nerLastUpdateTime !== null && (Date.now() - nerLastUpdateTime > 60000),
    isReindexJobStalled,
    
    // Pagination
    currentPage,
    setCurrentPage,
    pageSize,
    
    // Computed
    estimatedTokens,
    analysisMode,
    
    // Handlers
    handlePresetChange,
    handleFromDateChange,
    handleToDateChange,
    toggleTranscript,
    selectAll,
    selectAllMatching,
    deselectAll,
    toggleCallType,
    handlePreIndex,
    handleBackfillAll,
    handleBackfillEmbeddings,
    handleBackfillEntities,
    stopEmbeddingsBackfill,
    stopNERBackfill,
    handleResetAndReindex,
    stopReindex,
    handleLoadSelection,
  };
}
