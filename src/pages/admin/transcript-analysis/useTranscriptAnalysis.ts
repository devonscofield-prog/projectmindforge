import { useState, useMemo, useEffect } from 'react';
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
  startNERBackfillJob, 
  startEmbeddingsBackfillJob 
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
  
  // Background job state - now drives UI from database polling
  const [activeNERJobId, setActiveNERJobId] = useState<string | null>(null);
  const [activeEmbeddingsJobId, setActiveEmbeddingsJobId] = useState<string | null>(null);
  
  // Pre-indexing state
  const [isIndexing, setIsIndexing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetProgress, setResetProgress] = useState<string | null>(null);
  
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

  // Fetch transcripts with filters and server-side pagination
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
      let repIds: string[] = [];
      
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

      let query = supabase
        .from('call_transcripts')
        .select('id, call_date, account_name, call_type, raw_text, rep_id, analysis_status', { count: 'exact' })
        .gte('call_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('call_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('call_date', { ascending: false });

      // Filter by analysis status
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

      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const repIdSet = new Set((data || []).map(t => t.rep_id));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, team_id')
        .in('id', Array.from(repIdSet));

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      const teamMap = new Map((teams || []).map(t => [t.id, t.name]));

      const transcripts = (data || []).map(t => ({
        ...t,
        rep_name: profileMap.get(t.rep_id)?.name || 'Unknown',
        team_name: teamMap.get(profileMap.get(t.rep_id)?.team_id || '') || 'Unknown',
      })) as Transcript[];

      return {
        transcripts,
        totalCount: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / pageSize),
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

  // Check for existing active NER job on page load
  const { data: existingNERJob } = useQuery({
    queryKey: ['active-job', 'ner_backfill'],
    queryFn: () => fetchActiveJob('ner_backfill'),
    enabled: role === 'admin' && !activeNERJobId,
    staleTime: 0,
  });

  // Check for existing active embeddings job on page load
  const { data: existingEmbeddingsJob } = useQuery({
    queryKey: ['active-job', 'embedding_backfill'],
    queryFn: () => fetchActiveJob('embedding_backfill'),
    enabled: role === 'admin' && !activeEmbeddingsJobId,
    staleTime: 0,
  });

  // Set active job IDs from existing jobs on mount
  useEffect(() => {
    if (existingNERJob && !activeNERJobId) {
      setActiveNERJobId(existingNERJob.id);
      toast.info('Found active NER backfill job, resuming tracking...');
    }
  }, [existingNERJob, activeNERJobId]);

  useEffect(() => {
    if (existingEmbeddingsJob && !activeEmbeddingsJobId) {
      setActiveEmbeddingsJobId(existingEmbeddingsJob.id);
      toast.info('Found active embeddings backfill job, resuming tracking...');
    }
  }, [existingEmbeddingsJob, activeEmbeddingsJobId]);

  // Poll NER job status
  const { data: nerJobStatus } = useQuery({
    queryKey: ['background-job', 'ner', activeNERJobId],
    queryFn: () => fetchBackgroundJob(activeNERJobId!),
    enabled: !!activeNERJobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed' || status === 'cancelled') {
        return false;
      }
      return 3000; // Poll every 3 seconds
    },
  });

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

  // Handle NER job status changes
  useEffect(() => {
    if (nerJobStatus) {
      if (nerJobStatus.status === 'completed') {
        toast.success('NER backfill complete!');
        setActiveNERJobId(null);
        refetchGlobalChunkStatus();
      } else if (nerJobStatus.status === 'failed') {
        toast.error(`NER backfill failed: ${nerJobStatus.error || 'Unknown error'}`);
        setActiveNERJobId(null);
      } else if (nerJobStatus.status === 'cancelled') {
        toast.info('NER backfill cancelled');
        setActiveNERJobId(null);
        refetchGlobalChunkStatus();
      }
    }
  }, [nerJobStatus?.status, nerJobStatus?.error, refetchGlobalChunkStatus]);

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

  // Derived state from job polling
  const isBackfillingEntities = nerJobStatus?.status === 'processing' || nerJobStatus?.status === 'pending';
  const isBackfillingEmbeddings = embeddingsJobStatus?.status === 'processing' || embeddingsJobStatus?.status === 'pending';
  const entitiesProgress = nerJobStatus?.progress as { processed: number; total: number } | null;
  const embeddingsProgress = embeddingsJobStatus?.progress as { processed: number; total: number } | null;

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

  // Reset and reindex all handler (admin only - full RAG system reset)
  const handleResetAndReindex = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can reset the RAG system');
      return;
    }
    
    if (!confirm('⚠️ FULL RAG RESET\n\nThis will:\n1. Delete ALL existing chunks\n2. Re-chunk all transcripts\n3. Generate embeddings for all chunks\n4. Run NER extraction on all chunks\n\nThis may take 15-30 minutes. Continue?')) {
      return;
    }
    
    setIsResetting(true);
    setResetProgress('Deleting existing chunks...');
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      // Step 1: Reset all chunks
      log.info('Starting RAG reset - Step 1: Deleting chunks');
      const resetResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reset_all_chunks: true }),
      });
      
      if (!resetResponse.ok) {
        const errorText = await resetResponse.text();
        throw new Error('Failed to reset chunks: ' + errorText);
      }
      
      const resetResult = await resetResponse.json();
      toast.info(`Deleted ${resetResult.deleted_count} chunks. Starting fresh reindex...`);
      
      // Step 2: Backfill all transcripts (chunking)
      setResetProgress('Re-chunking all transcripts...');
      log.info('RAG reset - Step 2: Re-chunking transcripts');
      
      const backfillResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ backfill_all: true }),
      });
      
      if (!backfillResponse.ok) {
        const errorText = await backfillResponse.text();
        throw new Error('Failed to re-chunk transcripts: ' + errorText);
      }
      
      const backfillResult = await backfillResponse.json();
      toast.info(`Created ${backfillResult.new_chunks || 0} chunks. Starting embeddings...`);
      
      // Step 3: Generate embeddings (auto-continue loop)
      setResetProgress('Generating embeddings...');
      log.info('RAG reset - Step 3: Generating embeddings');
      
      let embeddingsRemaining = 1;
      let totalEmbeddings = 0;
      let consecutiveErrors = 0;
      
      while (embeddingsRemaining > 0 && consecutiveErrors < 3) {
        const embResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ backfill_embeddings: true }),
        });
        
        if (!embResponse.ok) {
          consecutiveErrors++;
          log.warn('Embeddings batch error', { consecutiveErrors });
          if (consecutiveErrors >= 3) {
            throw new Error('Failed to generate embeddings after 3 attempts');
          }
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        consecutiveErrors = 0;
        const embResult = await embResponse.json();
        totalEmbeddings += embResult.success_count || 0;
        embeddingsRemaining = embResult.remaining || 0;
        
        setResetProgress(`Generating embeddings... ${embResult.chunks_with_embeddings}/${embResult.total_chunks}`);
        
        if (embeddingsRemaining > 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      toast.info(`Generated ${totalEmbeddings} embeddings. Starting NER extraction...`);
      
      // Step 4: NER extraction (auto-continue loop)
      setResetProgress('Extracting entities...');
      log.info('RAG reset - Step 4: NER extraction');
      
      let nerRemaining = 1;
      let totalNer = 0;
      consecutiveErrors = 0;
      
      while (nerRemaining > 0 && consecutiveErrors < 3) {
        const nerResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ backfill_entities: true }),
        });
        
        if (!nerResponse.ok) {
          consecutiveErrors++;
          log.warn('NER batch error', { consecutiveErrors });
          if (consecutiveErrors >= 3) {
            throw new Error('Failed to extract entities after 3 attempts');
          }
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        
        consecutiveErrors = 0;
        const nerResult = await nerResponse.json();
        totalNer += nerResult.success_count || 0;
        
        // Use the 'remaining' count from edge function response (now available)
        nerRemaining = nerResult.remaining || 0;
        
        setResetProgress(`Extracting entities... ${nerResult.chunks_with_entities || totalNer} completed`);
        
        if (nerRemaining > 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      toast.success(`Full RAG reset complete! ${backfillResult.new_chunks || 0} chunks, ${totalEmbeddings} embeddings, ${totalNer} entities extracted.`);
      
      refetchChunkStatus();
      refetchGlobalChunkStatus();
    } catch (err) {
      log.error('RAG reset error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to reset RAG system');
    } finally {
      setIsResetting(false);
      setResetProgress(null);
    }
  };

  // Start NER entities backfill - now uses background job system
  const handleBackfillEntities = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill entities');
      return;
    }
    
    // Check if already running
    if (activeNERJobId) {
      toast.info('NER backfill is already in progress');
      return;
    }
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      const { jobId } = await startNERBackfillJob(token);
      setActiveNERJobId(jobId);
      toast.success('NER backfill started in background');
    } catch (err) {
      log.error('Failed to start NER backfill', { error: err });
      if (err instanceof Error && err.message.includes('already in progress')) {
        toast.info('An NER backfill is already in progress');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to start NER backfill');
      }
    }
  };

  // Stop NER backfill
  const stopNERBackfill = async () => {
    if (!activeNERJobId) return;
    
    try {
      await cancelBackgroundJob(activeNERJobId);
      toast.info('Cancellation requested...');
    } catch (err) {
      log.error('Failed to cancel NER backfill', { error: err });
      toast.error('Failed to cancel backfill');
    }
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
    resetProgress,
    embeddingsProgress,
    entitiesProgress,
    
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
    handleLoadSelection,
  };
}
