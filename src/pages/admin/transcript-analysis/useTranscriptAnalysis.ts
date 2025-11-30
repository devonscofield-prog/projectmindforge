import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { createLogger } from '@/lib/logger';
import { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';

const log = createLogger('transcriptAnalysis');
import { useTeams, useReps } from '@/hooks';
import { createDateRange, Transcript } from './constants';

export function useTranscriptAnalysis() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Filter state
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => createDateRange(30));
  const [selectedPreset, setSelectedPreset] = useState<string>('30');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('all');
  const [selectedRepId, setSelectedRepId] = useState<string>('all');
  const [accountSearch, setAccountSearch] = useState<string>('');
  const [selectedCallTypes, setSelectedCallTypes] = useState<string[]>([]);
  
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
        .single();
      
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
        setDateRange({
          from: new Date(f.dateRange.from),
          to: new Date(f.dateRange.to),
        });
        setSelectedPreset('custom');
      }
      if (f.selectedTeamId) setSelectedTeamId(f.selectedTeamId);
      if (f.selectedRepId) setSelectedRepId(f.selectedRepId);
      if (f.accountSearch) setAccountSearch(f.accountSearch);
      if (f.selectedCallTypes) setSelectedCallTypes(f.selectedCallTypes);
    }
  };

  // Use reusable hooks for teams and reps
  const { data: teams } = useTeams();
  const { data: reps } = useReps({ 
    teamId: selectedTeamId !== 'all' ? selectedTeamId : undefined 
  });

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [dateRange.from, dateRange.to, selectedTeamId, selectedRepId, accountSearch, selectedCallTypes]);

  // Fetch transcripts with filters and server-side pagination
  const { data: transcriptsData, isLoading } = useQuery({
    queryKey: [
      'admin-transcripts',
      dateRange.from.toISOString(),
      dateRange.to.toISOString(),
      selectedTeamId,
      selectedRepId,
      accountSearch,
      selectedCallTypes,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      let repIds: string[] = [];
      
      if (selectedRepId !== 'all') {
        repIds = [selectedRepId];
      } else if (selectedTeamId !== 'all') {
        const { data: teamReps } = await supabase
          .from('profiles')
          .select('id')
          .eq('team_id', selectedTeamId);
        repIds = (teamReps || []).map(r => r.id);
      }

      let query = supabase
        .from('call_transcripts')
        .select('id, call_date, account_name, call_type, raw_text, rep_id', { count: 'exact' })
        .eq('analysis_status', 'completed')
        .gte('call_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('call_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('call_date', { ascending: false });

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
    enabled: true,
  });

  const transcripts = transcriptsData?.transcripts || [];
  const totalCount = transcriptsData?.totalCount || 0;
  const totalPages = transcriptsData?.totalPages || 1;

  // Query to check which transcripts are already chunked
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

  // Pre-index handler
  const handlePreIndex = async () => {
    if (!transcripts?.length) return;
    setIsIndexing(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please sign in to pre-index transcripts');
        return;
      }
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chunk-transcripts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ transcript_ids: transcripts.map(t => t.id) }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to pre-index transcripts');
      }
      
      const result = await response.json();
      toast.success(`Indexed ${result.new_chunks || 0} new chunks from ${result.transcripts_chunked || 0} transcripts`);
      refetchChunkStatus();
    } catch (err) {
      log.error('Pre-index error', { error: err });
      toast.error(err instanceof Error ? err.message : 'Failed to pre-index transcripts');
    } finally {
      setIsIndexing(false);
    }
  };

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value);
    if (value !== 'custom') {
      setDateRange(createDateRange(parseInt(value)));
    }
  };

  const handleFromDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(0, 0, 0, 0);
      setDateRange(prev => ({ ...prev, from: date }));
      setSelectedPreset('custom');
    }
  };

  const handleToDateChange = (date: Date | undefined) => {
    if (date) {
      date.setHours(23, 59, 59, 999);
      setDateRange(prev => ({ ...prev, to: date }));
      setSelectedPreset('custom');
    }
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

  // Calculate token estimate
  const estimatedTokens = useMemo(() => {
    if (!transcripts) return 0;
    const selected = transcripts.filter(t => selectedTranscriptIds.has(t.id));
    const totalChars = selected.reduce((sum, t) => sum + (t.raw_text?.length || 0), 0);
    return Math.round(totalChars / 4);
  }, [transcripts, selectedTranscriptIds]);

  const getAnalysisModeLabel = () => {
    const count = selectedTranscriptIds.size;
    if (count === 0) return { label: 'Select transcripts', color: 'text-muted-foreground', useRag: false };
    if (count <= 20) return { label: 'Direct Analysis Mode', color: 'text-green-500', useRag: false };
    return { label: 'RAG Mode', color: 'text-amber-500', useRag: true };
  };

  const analysisMode = getAnalysisModeLabel();
  const selectedTranscripts = useMemo(() => 
    transcripts?.filter(t => selectedTranscriptIds.has(t.id)) || [],
    [transcripts, selectedTranscriptIds]
  );

  return {
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
    
    // Data
    teams,
    reps,
    transcripts,
    totalCount,
    totalPages,
    isLoading,
    chunkStatus,
    
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
    deselectAll,
    toggleCallType,
    handlePreIndex,
    handleLoadSelection,
  };
}
