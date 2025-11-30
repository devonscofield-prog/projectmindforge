import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { TranscriptChatPanel } from '@/components/admin/TranscriptChatPanel';
import { SaveSelectionDialog } from '@/components/admin/SaveSelectionDialog';
import { SavedSelectionsSheet } from '@/components/admin/SavedSelectionsSheet';
import { SavedInsightsSheet } from '@/components/admin/SavedInsightsSheet';
import { PaginationControls } from '@/components/ui/pagination-controls';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  CalendarIcon,
  Search,
  FileText,
  MessageSquare,
  CheckSquare,
  Square,
  Users,
  Building2,
  Filter,
  Sparkles,
  Info,
  ChevronDown,
  Save,
  FolderOpen,
  Lightbulb,
  Database,
  Loader2,
} from 'lucide-react';

const TIME_RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
  { value: '365', label: 'Last year' },
];

const CALL_TYPES = [
  { value: 'first_demo', label: 'First Demo' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'closing_call', label: 'Closing Call' },
  { value: 'discovery', label: 'Discovery' },
  { value: 'check_in', label: 'Check In' },
  { value: 'other', label: 'Other' },
];

function createDateRange(daysBack: number): { from: Date; to: Date } {
  const to = new Date();
  to.setHours(23, 59, 59, 999);
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

interface Transcript {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  raw_text: string;
  rep_id: string;
  rep_name?: string;
  team_name?: string;
}

export default function AdminTranscriptAnalysis() {
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
      // Just open insights panel - the insight view will be handled there
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
      
      // Load the selection
      handleLoadSelection(data);
      toast.success(`Loaded shared selection: ${data.name}`);
      setSearchParams({});
    } catch (err) {
      console.error('Error loading shared selection:', err);
      toast.error('Failed to load shared selection');
      setSearchParams({});
    }
  };

  const handleLoadSelection = (selection: { id: string; transcript_ids: string[]; filters?: Json | null }) => {
    setSelectedTranscriptIds(new Set(selection.transcript_ids || []));
    setCurrentSelectionId(selection.id);
    
    // Restore filters if available
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

  // Fetch teams
  const { data: teams } = useQuery({
    queryKey: ['admin-all-teams'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch all reps (filtered by team)
  const { data: reps } = useQuery({
    queryKey: ['admin-all-reps', selectedTeamId],
    queryFn: async () => {
      let query = supabase
        .from('user_with_role')
        .select('id, name, team_id')
        .eq('role', 'rep')
        .eq('is_active', true);
      
      if (selectedTeamId !== 'all') {
        query = query.eq('team_id', selectedTeamId);
      }
      
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data || [];
    },
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
      // First get rep IDs based on team filter
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

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Enrich with rep and team names
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

  // Query to check which transcripts are already chunked (for RAG pre-indexing)
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
      console.error('Pre-index error:', err);
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

  // Calculate token estimate (rough: ~4 chars per token)
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Transcript Analysis
            </h1>
            <p className="text-muted-foreground">
              Select transcripts to analyze with AI across all teams
            </p>
          </div>
          <Badge variant="outline">Admin View</Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-start gap-4">
              {/* Date Range */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Time Period</Label>
                <div className="flex items-center gap-2">
                  <Select value={selectedPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_RANGES.map(r => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom Range</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {selectedPreset === 'custom' && (
                    <>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(dateRange.from, 'MMM d, yy')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.from}
                            onSelect={handleFromDateChange}
                            disabled={(date) => date > dateRange.to || date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <span className="text-muted-foreground text-sm">to</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-[120px] justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {format(dateRange.to, 'MMM d, yy')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={dateRange.to}
                            onSelect={handleToDateChange}
                            disabled={(date) => date < dateRange.from || date > new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </>
                  )}
                </div>
              </div>

              {/* Team Filter */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Team</Label>
                <Select value={selectedTeamId} onValueChange={(v) => { setSelectedTeamId(v); setSelectedRepId('all'); }}>
                  <SelectTrigger className="w-[160px]">
                    <Building2 className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams?.map(team => (
                      <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rep Filter */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Rep</Label>
                <Select value={selectedRepId} onValueChange={setSelectedRepId}>
                  <SelectTrigger className="w-[180px]">
                    <Users className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="All Reps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Reps</SelectItem>
                    {reps?.map(rep => (
                      <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Account Search */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Account</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search accounts..."
                    value={accountSearch}
                    onChange={(e) => setAccountSearch(e.target.value)}
                    className="pl-8 w-[180px]"
                  />
                </div>
              </div>

              {/* Call Type Filter */}
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Call Type</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-[160px] justify-between">
                      {selectedCallTypes.length === 0 ? 'All Types' : `${selectedCallTypes.length} selected`}
                      <ChevronDown className="h-4 w-4 ml-2" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[200px] p-2" align="start">
                    <div className="space-y-1">
                      {CALL_TYPES.map(type => (
                        <div
                          key={type.value}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                          onClick={() => toggleCallType(type.value)}
                        >
                          <Checkbox checked={selectedCallTypes.includes(type.value)} />
                          <span className="text-sm">{type.label}</span>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Selection Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={selectAll} disabled={!transcripts?.length}>
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} disabled={selectedTranscriptIds.size === 0}>
                <Square className="h-4 w-4 mr-1" />
                Deselect All
              </Button>
            </div>
            
            <div className="text-sm">
              <span className="font-medium">{selectedTranscriptIds.size}</span>
              <span className="text-muted-foreground"> of {transcripts?.length || 0} transcripts selected</span>
            </div>

            <div className="text-sm text-muted-foreground">
              ~{estimatedTokens.toLocaleString()} tokens
            </div>

            {/* Pre-Index Status */}
            {chunkStatus && chunkStatus.total > 0 && (
              <Badge 
                variant={chunkStatus.indexed === chunkStatus.total ? 'default' : 'secondary'}
                className={cn(
                  "text-xs",
                  chunkStatus.indexed === chunkStatus.total 
                    ? "bg-green-500/10 text-green-600 border-green-500/20" 
                    : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}
              >
                <Database className="h-3 w-3 mr-1" />
                {chunkStatus.indexed} / {chunkStatus.total} indexed
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Pre-Index & Save/Load Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreIndex}
                disabled={!transcripts?.length || isIndexing || (chunkStatus?.indexed === chunkStatus?.total && chunkStatus?.total > 0)}
                title="Pre-index transcripts for faster RAG queries"
              >
                {isIndexing ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Database className="h-4 w-4 mr-1" />
                )}
                {isIndexing ? 'Indexing...' : 'Pre-Index'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSaveSelectionOpen(true)}
                disabled={selectedTranscriptIds.size === 0}
              >
                <Save className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSavedSelectionsOpen(true)}
              >
                <FolderOpen className="h-4 w-4 mr-1" />
                Load
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSavedInsightsOpen(true)}
              >
                <Lightbulb className="h-4 w-4 mr-1" />
                Insights
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-medium", analysisMode.color)}>
                {analysisMode.label}
              </span>
              <HoverCard>
                <HoverCardTrigger>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </HoverCardTrigger>
                <HoverCardContent className="w-80">
                  <div className="space-y-2 text-sm">
                    <p><strong>Direct Analysis (1-20):</strong> Full transcript text sent to AI for complete context</p>
                    <p><strong>RAG Mode (20+):</strong> AI searches for relevant sections using semantic search, enabling analysis of unlimited transcripts</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>

            <Sheet open={chatOpen} onOpenChange={setChatOpen}>
              <SheetTrigger asChild>
                <Button
                  disabled={selectedTranscriptIds.size === 0}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  Analyze with AI
                  {analysisMode.useRag && (
                    <Badge variant="secondary" className="ml-1">RAG</Badge>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent className="w-full sm:max-w-xl flex flex-col p-0">
                <TranscriptChatPanel
                  selectedTranscripts={selectedTranscripts}
                  useRag={analysisMode.useRag}
                  selectionId={currentSelectionId}
                  onClose={() => setChatOpen(false)}
                />
              </SheetContent>
            </Sheet>
          </div>
        </div>

        {/* Save Selection Dialog */}
        <SaveSelectionDialog
          open={saveSelectionOpen}
          onOpenChange={setSaveSelectionOpen}
          transcriptIds={Array.from(selectedTranscriptIds)}
          filters={{
            dateRange,
            selectedTeamId,
            selectedRepId,
            accountSearch,
            selectedCallTypes,
          }}
          onSaved={(id) => setCurrentSelectionId(id)}
        />

        {/* Saved Selections Sheet */}
        <SavedSelectionsSheet
          open={savedSelectionsOpen}
          onOpenChange={setSavedSelectionsOpen}
          onLoadSelection={handleLoadSelection}
        />

        {/* Saved Insights Sheet */}
        <SavedInsightsSheet
          open={savedInsightsOpen}
          onOpenChange={setSavedInsightsOpen}
        />

        {/* Transcript Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Transcripts ({totalCount} total, showing {transcripts.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : transcripts?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No transcripts found matching your filters
              </div>
            ) : (
              <ScrollArea className="h-[500px]">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background border-b">
                    <tr className="text-left text-sm text-muted-foreground">
                      <th className="p-3 w-10"></th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Account</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Rep</th>
                      <th className="p-3">Team</th>
                      <th className="p-3">Preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transcripts?.map(transcript => (
                      <tr
                        key={transcript.id}
                        className={cn(
                          "border-b hover:bg-muted/50 cursor-pointer transition-colors",
                          selectedTranscriptIds.has(transcript.id) && "bg-primary/5"
                        )}
                        onClick={() => toggleTranscript(transcript.id)}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTranscriptIds.has(transcript.id)}
                            onCheckedChange={() => toggleTranscript(transcript.id)}
                          />
                        </td>
                        <td className="p-3 text-sm">
                          {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-3 text-sm font-medium">
                          {transcript.account_name || 'Unknown'}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-xs">
                            {CALL_TYPES.find(t => t.value === transcript.call_type)?.label || transcript.call_type || 'Call'}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm">{transcript.rep_name}</td>
                        <td className="p-3 text-sm text-muted-foreground">{transcript.team_name}</td>
                        <td className="p-3">
                          <HoverCard>
                            <HoverCardTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-xs">
                                <MessageSquare className="h-3 w-3 mr-1" />
                                Preview
                              </Button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-96" align="end">
                              <div className="space-y-2">
                                <div className="font-medium text-sm">
                                  {transcript.account_name} - {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                                </div>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                                  {transcript.raw_text?.substring(0, 500)}
                                  {(transcript.raw_text?.length || 0) > 500 && '...'}
                                </p>
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            )}
            
            {/* Pagination Controls */}
            {totalCount > pageSize && (
              <div className="p-4 border-t">
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalCount}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  showPageSize={false}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
