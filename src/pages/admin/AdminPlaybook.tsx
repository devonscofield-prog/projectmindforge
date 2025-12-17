import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { 
  BookOpen, 
  Shield, 
  Target, 
  Lightbulb, 
  Search, 
  Copy, 
  Check,
  ExternalLink,
  User,
  Calendar,
  Download,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import {
  fetchSuccessfulObjectionHandlers,
  fetchSuccessfulPitches,
  fetchSuggestedTalkTracks,
  getObjectionCategories,
  getSeverityLevels,
  collectAllPains,
  exportPainsToCSV,
  getPainsAsList,
  downloadFile,
  type ObjectionHandler,
  type PitchTrack,
  type TalkTrack,
} from '@/api/playbook';
import { useReps } from '@/hooks/useReps';

function ObjectionHandlerCard({ handler, onCopy }: { handler: ObjectionHandler; onCopy: (text: string) => void }) {
  const navigate = useNavigate();
  
  const categoryColors: Record<string, string> = {
    'Timing': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'Price': 'bg-green-500/10 text-green-500 border-green-500/20',
    'Competitor': 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    'Authority': 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    'Feature': 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    'Need': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Status Quo': 'bg-gray-500/10 text-gray-500 border-gray-500/20',
    'Risk': 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={categoryColors[handler.category] || 'bg-muted'}>
            {handler.category}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {handler.handlingRating}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Objection</p>
          <p className="text-sm italic text-foreground/80">"{handler.objection}"</p>
        </div>
        
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Successful Response</p>
          <p className="text-sm text-foreground">{handler.repResponse}</p>
        </div>

        {handler.coachingTip && (
          <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
            <p className="text-xs font-medium text-primary mb-1">💡 Why it worked</p>
            <p className="text-xs text-muted-foreground">{handler.coachingTip}</p>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {handler.repName}
            </span>
            {handler.callDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(parseDateOnly(handler.callDate), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => onCopy(handler.repResponse)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate(`/calls/${handler.callId}`)}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PitchTrackCard({ pitch, onCopy }: { pitch: PitchTrack; onCopy: (text: string) => void }) {
  const navigate = useNavigate();
  
  const severityColors: Record<string, string> = {
    'High': 'bg-red-500/10 text-red-500 border-red-500/20',
    'Medium': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Low': 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={severityColors[pitch.painSeverity] || 'bg-muted'}>
            {pitch.painSeverity} Severity
          </Badge>
          <Badge variant="secondary" className="text-xs capitalize">
            {pitch.painType}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pain Identified</p>
          <p className="text-sm italic text-foreground/80">"{pitch.painIdentified}"</p>
        </div>
        
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Feature Pitched</p>
          <p className="text-sm text-foreground">{pitch.featurePitched}</p>
        </div>

        <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
          <p className="text-xs font-medium text-primary mb-1">✓ Why it connected</p>
          <p className="text-xs text-muted-foreground">{pitch.reasoning}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {pitch.repName}
            </span>
            {pitch.accountName && (
              <span className="truncate max-w-[120px]">{pitch.accountName}</span>
            )}
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => onCopy(`Pain: ${pitch.painIdentified}\nPitch: ${pitch.featurePitched}`)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate(`/calls/${pitch.callId}`)}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TalkTrackCard({ track, onCopy }: { track: TalkTrack; onCopy: (text: string) => void }) {
  const navigate = useNavigate();
  
  const severityColors: Record<string, string> = {
    'High': 'bg-red-500/10 text-red-500 border-red-500/20',
    'Medium': 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    'Low': 'bg-green-500/10 text-green-500 border-green-500/20',
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <Badge variant="outline" className={severityColors[track.severity] || 'bg-muted'}>
          {track.severity} Priority
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Pain Point</p>
          <p className="text-sm italic text-foreground/80">"{track.pain}"</p>
        </div>
        
        <div className="bg-accent/50 rounded-lg p-3 border">
          <p className="text-xs font-medium text-foreground mb-1">💬 Suggested Talk Track</p>
          <p className="text-sm text-foreground">{track.suggestedTalkTrack}</p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {track.accountName && (
              <span className="truncate max-w-[150px]">{track.accountName}</span>
            )}
          </div>
          <div className="flex gap-1">
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => onCopy(track.suggestedTalkTrack)}
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 px-2"
              onClick={() => navigate(`/calls/${track.callId}`)}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <Skeleton className="h-5 w-24" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-8 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminPlaybook() {
  const [activeTab, setActiveTab] = useState('objections');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: reps } = useReps();

  const { data: objectionHandlers, isLoading: loadingObjections } = useQuery({
    queryKey: ['playbook', 'objections', categoryFilter, repFilter],
    queryFn: () => fetchSuccessfulObjectionHandlers(
      categoryFilter === 'all' ? undefined : categoryFilter,
      repFilter === 'all' ? undefined : repFilter
    ),
  });

  const { data: pitchTracks, isLoading: loadingPitches } = useQuery({
    queryKey: ['playbook', 'pitches', severityFilter, repFilter],
    queryFn: () => fetchSuccessfulPitches(
      severityFilter === 'all' ? undefined : severityFilter,
      repFilter === 'all' ? undefined : repFilter
    ),
  });

  const { data: talkTracks, isLoading: loadingTalkTracks } = useQuery({
    queryKey: ['playbook', 'talkTracks', severityFilter, repFilter],
    queryFn: () => fetchSuggestedTalkTracks(
      severityFilter === 'all' ? undefined : severityFilter,
      repFilter === 'all' ? undefined : repFilter
    ),
  });

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleExportPainsCSV = () => {
    const pains = collectAllPains(pitchTracks || [], talkTracks || []);
    if (pains.length === 0) {
      toast.error('No pains to export');
      return;
    }
    const csv = exportPainsToCSV(pains);
    downloadFile(csv, 'pains-export.csv', 'text/csv');
    toast.success(`Exported ${pains.length} pains to CSV`);
  };

  const handleCopyPainsList = async () => {
    const pains = collectAllPains(pitchTracks || [], talkTracks || []);
    if (pains.length === 0) {
      toast.error('No pains to copy');
      return;
    }
    const list = getPainsAsList(pains);
    await navigator.clipboard.writeText(list);
    toast.success(`Copied ${pains.length} pains to clipboard`);
  };

  // Filter by search query
  const filteredObjections = objectionHandlers?.filter(h => 
    !searchQuery || 
    h.objection.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.repResponse.toLowerCase().includes(searchQuery.toLowerCase()) ||
    h.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredPitches = pitchTracks?.filter(p => 
    !searchQuery || 
    p.painIdentified.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.featurePitched.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const filteredTalkTracks = talkTracks?.filter(t => 
    !searchQuery || 
    t.pain.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.suggestedTalkTrack.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.accountName?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Sales Playbook Library
          </h1>
          <p className="text-muted-foreground mt-1">
            Curated library of successful objection handlers, pitch tracks, and talk tracks extracted from AI analysis
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{objectionHandlers?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Objection Handlers</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pitchTracks?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Successful Pitches</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Lightbulb className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{talkTracks?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Talk Tracks</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="objections" className="gap-2">
                <Shield className="h-4 w-4" />
                Objection Handlers
              </TabsTrigger>
              <TabsTrigger value="pitches" className="gap-2">
                <Target className="h-4 w-4" />
                Pitch Library
              </TabsTrigger>
              <TabsTrigger value="talkTracks" className="gap-2">
                <Lightbulb className="h-4 w-4" />
                Talk Tracks
              </TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-[200px]"
                />
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    <Download className="h-4 w-4" />
                    Export Pains
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportPainsCSV}>
                    <Download className="h-4 w-4 mr-2" />
                    Download as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleCopyPainsList}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps</SelectItem>
                {reps?.map(rep => (
                  <SelectItem key={rep.id} value={rep.id}>{rep.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {activeTab === 'objections' && (
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {getObjectionCategories().map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(activeTab === 'pitches' || activeTab === 'talkTracks') && (
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Severities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  {getSeverityLevels().map(sev => (
                    <SelectItem key={sev} value={sev}>{sev}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Content */}
          <TabsContent value="objections" className="mt-6">
            {loadingObjections ? (
              <LoadingGrid />
            ) : filteredObjections.length === 0 ? (
              <EmptyState
                icon={Shield}
                title="No objection handlers found"
                description="Successful objection handlers will appear here as calls are analyzed"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredObjections.map(handler => (
                  <ObjectionHandlerCard 
                    key={handler.id} 
                    handler={handler} 
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="pitches" className="mt-6">
            {loadingPitches ? (
              <LoadingGrid />
            ) : filteredPitches.length === 0 ? (
              <EmptyState
                icon={Target}
                title="No successful pitches found"
                description="Pain-to-pitch connections will appear here as calls are analyzed"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPitches.map(pitch => (
                  <PitchTrackCard 
                    key={pitch.id} 
                    pitch={pitch} 
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="talkTracks" className="mt-6">
            {loadingTalkTracks ? (
              <LoadingGrid />
            ) : filteredTalkTracks.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="No talk tracks found"
                description="AI-suggested talk tracks will appear here as calls are analyzed"
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTalkTracks.map(track => (
                  <TalkTrackCard 
                    key={track.id} 
                    track={track} 
                    onCopy={handleCopy}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
