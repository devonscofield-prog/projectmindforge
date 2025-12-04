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
  
  // Pre-indexing state
  const [isIndexing, setIsIndexing] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [isBackfillingEmbeddings, setIsBackfillingEmbeddings] = useState(false);
  const [isBackfillingEntities, setIsBackfillingEntities] = useState(false);
  const [embeddingsProgress, setEmbeddingsProgress] = useState<{ processed: number; total: number } | null>(null);
  const [shouldStopBackfill, setShouldStopBackfill] = useState(false);
  
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
  const { data: teams } = useTeams();
  
  // For team-scoped view, auto-filter to manager's team
  const effectiveTeamId = isTeamScoped && managerTeam ? managerTeam.id : selectedTeamId;
  
  const { data: reps } = useReps({ 
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
  const { data: chunkStatus, refetch: refetchChunkStatus } = useQuery({
    queryKey: ['chunk-status', transcripts?.map(t => t.id).join(',')],
    queryFn: async () => {
      if (!transcripts?.length) return { indexed: 0, total: 0 };
      const ids = transcripts.map(t => t.id);
      
      const { data, error } = await supabase
        .from('transcript_chunks')
        .select('transcript_id')
        .in('transcript_id', ids);
      
      if (error) throw error;
      
      const indexedIds = new Set((data || []).map(c => c.transcript_id));
      return { indexed: indexedIds.size, total: ids.length };
    },
    enabled: !!transcripts?.length,
  });

  // Query for global chunk status (all completed transcripts) with embedding/NER stats
  const { data: globalChunkStatus, refetch: refetchGlobalChunkStatus } = useQuery({
    queryKey: ['global-chunk-status'],
    queryFn: async () => {
      // Get total count of completed or skipped transcripts (both are valid for RAG)
      const { count: totalCount, error: countError } = await supabase
        .from('call_transcripts')
        .select('id', { count: 'exact', head: true })
        .in('analysis_status', ['completed', 'skipped'])
        .is('deleted_at', null);
      
      if (countError) throw countError;
      
      // Get count of distinct indexed transcripts
      const { data: chunkedData, error: chunkedError } = await supabase
        .from('transcript_chunks')
        .select('transcript_id');
      
      if (chunkedError) throw chunkedError;
      
      const uniqueIndexed = new Set((chunkedData || []).map(c => c.transcript_id)).size;
      
      // Get embedding and NER stats
      const { data: chunkStats, error: statsError } = await supabase
        .from('transcript_chunks')
        .select('embedding, extraction_status');
      
      if (statsError) throw statsError;
      
      const totalChunks = chunkStats?.length || 0;
      const withEmbeddings = chunkStats?.filter(c => c.embedding !== null).length || 0;
      const nerCompleted = chunkStats?.filter(c => c.extraction_status === 'completed').length || 0;
      
      return { 
        indexed: uniqueIndexed, 
        total: totalCount || 0,
        totalChunks,
        withEmbeddings,
        missingEmbeddings: totalChunks - withEmbeddings,
        nerCompleted,
        nerPending: totalChunks - nerCompleted
      };
    },
    enabled: role === 'admin',
    staleTime: 30000, // 30 seconds
  });

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

  // Backfill embeddings handler with auto-continue (admin only)
  const handleBackfillEmbeddings = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill embeddings');
      return;
    }
    
    setIsBackfillingEmbeddings(true);
    setShouldStopBackfill(false);
    setEmbeddingsProgress(null);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      toast.info('Starting auto-backfill of embeddings...');
      
      let totalProcessed = 0;
      let remaining = 1; // Start with assumption there's work to do
      let consecutiveErrors = 0;
      
      while (remaining > 0 && !shouldStopBackfill && consecutiveErrors < 3) {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ backfill_embeddings: true }),
        });
        
        if (!response.ok) {
          consecutiveErrors++;
          const errorText = await response.text();
          log.error('Embeddings backfill batch error', { error: errorText, consecutiveErrors });
          if (consecutiveErrors >= 3) {
            throw new Error(errorText || 'Failed to backfill embeddings after 3 attempts');
          }
          await new Promise(r => setTimeout(r, 2000)); // Wait before retry
          continue;
        }
        
        consecutiveErrors = 0;
        const result = await response.json();
        totalProcessed += result.success_count || 0;
        remaining = result.remaining || 0;
        
        setEmbeddingsProgress({
          processed: result.chunks_with_embeddings || 0,
          total: result.total_chunks || 0
        });
        
        log.info('Embeddings batch complete', { 
          batchProcessed: result.success_count, 
          totalProcessed, 
          remaining 
        });
        
        // Small delay between batches to be nice to the API
        if (remaining > 0) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
      
      if (shouldStopBackfill) {
        toast.info(`Backfill stopped. Processed ${totalProcessed} embeddings.`);
      } else {
        toast.success(`Embeddings backfill complete! ${totalProcessed} embeddings generated.`);
      }
      
      refetchGlobalChunkStatus();
    } catch (err) {
      log.error('Embeddings backfill error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to backfill embeddings');
    } finally {
      setIsBackfillingEmbeddings(false);
      setEmbeddingsProgress(null);
      setShouldStopBackfill(false);
    }
  };

  // Stop backfill handler
  const stopEmbeddingsBackfill = () => {
    setShouldStopBackfill(true);
    toast.info('Stopping backfill after current batch...');
  };

  // Backfill NER entities handler (admin only)
  const handleBackfillEntities = async () => {
    if (role !== 'admin') {
      toast.error('Only admins can backfill entities');
      return;
    }
    
    setIsBackfillingEntities(true);
    
    try {
      const token = await getFreshToken();
      if (!token) {
        toast.error('Your session has expired. Please sign in again.');
        return;
      }
      
      toast.info('Starting NER entity extraction backfill (batch of 50)...');
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ backfill_entities: true }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to backfill entities');
      }
      
      const result = await response.json();
      toast.success(`NER backfill: ${result.entities_extracted || 0} extracted, ${result.entities_failed || 0} failed`);
      refetchGlobalChunkStatus();
    } catch (err) {
      log.error('Entities backfill error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to backfill entities');
    } finally {
      setIsBackfillingEntities(false);
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
    embeddingsProgress,
    
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
    handleLoadSelection,
  };
}
