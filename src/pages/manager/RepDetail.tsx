import { useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRepProfile, useCoachingSessions, useCreateCoachingSession, repDetailKeys } from '@/hooks/useRepDetailQueries';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { Plus, AlertCircle, Loader2, Phone, Calendar, Sparkles, ExternalLink, ChevronDown, Brain, Search, RefreshCw, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, subDays, isAfter } from 'date-fns';
import { parseDateOnly } from '@/lib/formatters';
import { PageBreadcrumb } from '@/components/ui/page-breadcrumb';
import { getDashboardUrl } from '@/lib/routes';
import { getRepDetailBreadcrumbs } from '@/lib/breadcrumbConfig';
import { toast } from 'sonner';
import {
  listCallTranscriptsForRep,
  CallTranscript,
} from '@/api/aiCallAnalysis';
import { AICoachingSnapshot } from '@/components/AICoachingSnapshot';
import { CallType, callTypeLabels } from '@/constants/callTypes';

type TimeframeFilter = '7d' | '30d' | '90d' | 'all';
type ManagerFilter = 'all' | 'with_me' | 'without_me';

// Helper functions for display
const getCallDisplayName = (t: CallTranscript) => {
  if (t.primary_stakeholder_name && t.account_name) {
    return `${t.primary_stakeholder_name} - ${t.account_name}`;
  }
  if (t.account_name) {
    return t.account_name;
  }
  if (t.primary_stakeholder_name) {
    return t.primary_stakeholder_name;
  }
  return t.notes || 'Call';
};

const getCallTypeDisplay = (t: CallTranscript) => {
  if (t.call_type === 'other' && t.call_type_other) {
    return t.call_type_other;
  }
  if (t.call_type) {
    return callTypeLabels[t.call_type as CallType] || t.call_type;
  }
  return null;
};

export default function RepDetail() {
  const { repId } = useParams<{ repId: string }>();
  const [searchParams] = useSearchParams();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Get default tab from URL query param
  const defaultTab = searchParams.get('tab') || 'call-history';
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    session_date: format(new Date(), 'yyyy-MM-dd'),
    focus_area: '',
    notes: '',
    action_items: '',
    follow_up_date: '',
  });

  // Call History state
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('30d');
  const [managerFilter, setManagerFilter] = useState<ManagerFilter>('all');
  const [callSearch, setCallSearch] = useState('');

  // AI Coaching Snapshot collapsed state (collapsed by default)
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  // Fetch data using React Query
  const { data: rep, isLoading: isLoadingProfile, error: profileError } = useRepProfile(repId);
  const { data: coaching = [], isLoading: isLoadingCoaching } = useCoachingSessions(repId);
  const { data: transcripts = [], isLoading: isLoadingTranscripts } = useQuery({
    queryKey: ['callTranscripts', repId],
    queryFn: () => listCallTranscriptsForRep(repId!),
    enabled: !!repId,
  });
  
  const createCoachingMutation = useCreateCoachingSession();

  // Combined loading state for critical data
  const loading = isLoadingProfile;

  // Filter transcripts by timeframe, search, and manager presence
  const filteredTranscripts = useMemo(() => {
    let results = transcripts;
    
    // Timeframe filter
    if (timeframe !== 'all') {
      const daysMap: Record<TimeframeFilter, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        'all': 0,
      };
      const cutoffDate = subDays(new Date(), daysMap[timeframe]);
      results = results.filter(t => isAfter(new Date(t.call_date), cutoffDate));
    }
    
    // Manager filter - filter by whether the manager (current user) was on the call
    if (managerFilter === 'with_me' && user) {
      results = results.filter(t => t.manager_id === user.id);
    } else if (managerFilter === 'without_me' && user) {
      results = results.filter(t => !t.manager_id || t.manager_id !== user.id);
    }
    
    // Search filter (account name or stakeholder name)
    if (callSearch.trim()) {
      const searchLower = callSearch.toLowerCase();
      results = results.filter(t => 
        t.account_name?.toLowerCase().includes(searchLower) ||
        t.primary_stakeholder_name?.toLowerCase().includes(searchLower)
      );
    }
    
    return results;
  }, [transcripts, timeframe, managerFilter, callSearch, user]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !repId) return;

    createCoachingMutation.mutate(
      {
        rep_id: repId,
        manager_id: user.id,
        session_date: formData.session_date,
        focus_area: formData.focus_area,
        notes: formData.notes || null,
        action_items: formData.action_items || null,
        follow_up_date: formData.follow_up_date || null,
      },
      {
        onSuccess: () => {
          toast.success('Session Created', { description: 'Coaching session has been recorded.' });
          setDialogOpen(false);
          setFormData({
            session_date: format(new Date(), 'yyyy-MM-dd'),
            focus_area: '',
            notes: '',
            action_items: '',
            follow_up_date: '',
          });
        },
        onError: () => {
          toast.error('Error', { description: 'Failed to create coaching session. Please try again.' });
        },
      }
    );
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: repDetailKeys.all });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'error':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  if (!rep) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            {role === 'manager' 
              ? "This rep is not on your team. You can only view detailed information for reps assigned to your team."
              : "Rep not found or you don't have permission to view this page."}
          </p>
          <Button variant="outline" onClick={() => navigate(getDashboardUrl(role))}>
            Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Breadcrumb Navigation */}
        <PageBreadcrumb items={getRepDetailBreadcrumbs(role, rep.name)} />

        {/* Debug info - only show in development */}
        {import.meta.env.DEV && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
            Viewing rep: <span className="font-mono">{repId}</span> as{' '}
            <span className="font-medium">{profile?.email || 'unknown'}</span>{' '}
            (role: <span className="font-medium">{role || 'unknown'}</span>)
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{rep.name}</h1>
            <p className="text-muted-foreground">{rep.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoadingProfile || isLoadingCoaching || isLoadingTranscripts}
            >
              <RefreshCw className={`h-4 w-4 ${(isLoadingProfile || isLoadingCoaching || isLoadingTranscripts) ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/rep/coaching-summary/${repId}`}>
                <Sparkles className="h-4 w-4 mr-2" />
                Coaching Trends
              </Link>
            </Button>
          </div>
        </div>

        {/* AI Coaching Snapshot - Collapsible, collapsed by default */}
        <Collapsible open={snapshotOpen} onOpenChange={setSnapshotOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">AI Coaching Snapshot</CardTitle>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform duration-200 ${snapshotOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <AICoachingSnapshot repId={repId!} />
            </CollapsibleContent>
          </Card>
        </Collapsible>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="coaching">Coaching ({coaching.length})</TabsTrigger>
            <TabsTrigger value="call-history" className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              Call History ({transcripts.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="coaching" className="mt-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Coaching Sessions</CardTitle>
                  <CardDescription>Track coaching conversations and action items</CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Session
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>New Coaching Session</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="session_date">Session Date</Label>
                        <Input
                          id="session_date"
                          type="date"
                          value={formData.session_date}
                          onChange={(e) => setFormData({ ...formData, session_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="focus_area">Focus Area</Label>
                        <Input
                          id="focus_area"
                          placeholder="e.g., Discovery, Objection Handling, Closing"
                          value={formData.focus_area}
                          onChange={(e) => setFormData({ ...formData, focus_area: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          placeholder="Session notes..."
                          value={formData.notes}
                          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="action_items">Action Items</Label>
                        <Textarea
                          id="action_items"
                          placeholder="List action items..."
                          value={formData.action_items}
                          onChange={(e) => setFormData({ ...formData, action_items: e.target.value })}
                          rows={3}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="follow_up_date">Follow-up Date (Optional)</Label>
                        <Input
                          id="follow_up_date"
                          type="date"
                          value={formData.follow_up_date}
                          onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                        />
                      </div>
                      <Button type="submit" className="w-full">Create Session</Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {coaching.length > 0 ? (
                  <div className="space-y-4">
                    {coaching.map((session) => (
                      <div key={session.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{session.focus_area}</span>
                          <span className="text-sm text-muted-foreground">
                            {format(parseDateOnly(session.session_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                        {session.notes && (
                          <div className="mb-2">
                            <span className="text-sm font-medium">Notes:</span>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.notes}</p>
                          </div>
                        )}
                        {session.action_items && (
                          <div className="mb-2">
                            <span className="text-sm font-medium">Action Items:</span>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{session.action_items}</p>
                          </div>
                        )}
                        {session.follow_up_date && (
                          <p className="text-sm text-muted-foreground">
                            Follow-up: {format(parseDateOnly(session.follow_up_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No coaching sessions yet. Schedule your first one!
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call History Tab - Direct navigation to CallDetailPage */}
          <TabsContent value="call-history" className="mt-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Phone className="h-5 w-5" />
                        Call History
                      </CardTitle>
                      <CardDescription>
                        {filteredTranscripts.length} call{filteredTranscripts.length !== 1 ? 's' : ''} 
                        {timeframe !== 'all' && ` in the last ${timeframe.replace('d', ' days')}`}
                      </CardDescription>
                    </div>
                    <div className="inline-flex rounded-lg border bg-muted p-1">
                      <Button
                        variant={timeframe === '7d' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('7d')}
                        className="px-3"
                      >
                        7 days
                      </Button>
                      <Button
                        variant={timeframe === '30d' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('30d')}
                        className="px-3"
                      >
                        30 days
                      </Button>
                      <Button
                        variant={timeframe === '90d' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('90d')}
                        className="px-3"
                      >
                        90 days
                      </Button>
                      <Button
                        variant={timeframe === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setTimeframe('all')}
                        className="px-3"
                      >
                        All
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative max-w-sm flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by account or stakeholder..."
                        value={callSearch}
                        onChange={(e) => setCallSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {/* Manager presence filter */}
                    <div className="inline-flex rounded-lg border bg-muted p-1">
                      <Button
                        variant={managerFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setManagerFilter('all')}
                        className="px-3 text-xs"
                      >
                        All Calls
                      </Button>
                      <Button
                        variant={managerFilter === 'with_me' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setManagerFilter('with_me')}
                        className="px-3 text-xs"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        I was on
                      </Button>
                      <Button
                        variant={managerFilter === 'without_me' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setManagerFilter('without_me')}
                        className="px-3 text-xs"
                      >
                        I wasn't on
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingTranscripts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredTranscripts.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Stakeholder / Account</TableHead>
                        <TableHead>Call Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTranscripts.map((transcript) => (
                        <TableRow
                          key={transcript.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/calls/${transcript.id}`)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(parseDateOnly(transcript.call_date), 'MMM d, yyyy')}
                              {transcript.manager_id && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Users className="h-4 w-4 text-primary" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {transcript.manager_id === user?.id ? 'You were on this call' : 'Manager was on this call'}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {getCallDisplayName(transcript)}
                          </TableCell>
                          <TableCell>
                            {getCallTypeDisplay(transcript) ? (
                              <Badge variant="outline" className="text-xs">
                                {getCallTypeDisplay(transcript)}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant={getStatusBadgeVariant(transcript.analysis_status)}>
                                {transcript.analysis_status}
                              </Badge>
                              {transcript.analysis_status === 'error' && transcript.analysis_error && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <AlertCircle className="h-4 w-4 text-destructive" />
                                    </TooltipTrigger>
                                    <TooltipContent className="max-w-xs">
                                      <p className="text-sm">{transcript.analysis_error}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/calls/${transcript.id}`);
                              }}
                            >
                              <ExternalLink className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Phone className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">
                      {timeframe === 'all' 
                        ? 'No call transcripts yet.' 
                        : `No calls in the last ${timeframe.replace('d', ' days')}.`}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </AppLayout>
  );
}
