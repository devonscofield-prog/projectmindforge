import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge, getPerformanceStatus } from '@/components/ui/status-badge';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PerformanceTrendCharts } from '@/components/charts/PerformanceTrendCharts';
import { Profile, RepPerformanceSnapshot, CoachingSession, ActivityLog, ActivityType } from '@/types/database';
import { ArrowLeft, Plus, AlertCircle, Eye, Loader2, X, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  createCallTranscriptAndAnalyze,
  listCallTranscriptsForRep,
  getAnalysisForCall,
} from '@/api/aiCallAnalysis';
import { AICoachingSnapshot } from '@/components/AICoachingSnapshot';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const activityTypeLabels: Record<ActivityType, string> = {
  cold_calls: 'Cold Calls',
  emails: 'Emails',
  linkedin: 'LinkedIn',
  demos: 'Demos',
  meetings: 'Meetings',
  proposals: 'Proposals',
};

type CallSource = 'zoom' | 'teams' | 'dialer' | 'other';

const sourceLabels: Record<CallSource, string> = {
  zoom: 'Zoom',
  teams: 'Teams',
  dialer: 'Dialer',
  other: 'Other',
};

export default function RepDetail() {
  const { repId } = useParams<{ repId: string }>();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [rep, setRep] = useState<Profile | null>(null);
  const [performance, setPerformance] = useState<RepPerformanceSnapshot[]>([]);
  const [coaching, setCoaching] = useState<CoachingSession[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    session_date: format(new Date(), 'yyyy-MM-dd'),
    focus_area: '',
    notes: '',
    action_items: '',
    follow_up_date: '',
  });

  // Call Coaching (AI) state
  const [transcriptForm, setTranscriptForm] = useState({
    rawText: '',
    callDate: format(new Date(), 'yyyy-MM-dd'),
    source: 'other' as CallSource,
    notes: '',
  });
  const [isSubmittingTranscript, setIsSubmittingTranscript] = useState(false);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // Fetch transcripts for rep using React Query
  const { data: transcripts = [], isLoading: isLoadingTranscripts, refetch: refetchTranscripts } = useQuery({
    queryKey: ['callTranscripts', repId],
    queryFn: () => listCallTranscriptsForRep(repId!),
    enabled: !!repId,
  });

  // Fetch analysis for selected call
  const { data: selectedAnalysis, isLoading: isLoadingAnalysis } = useQuery({
    queryKey: ['callAnalysis', selectedCallId],
    queryFn: () => getAnalysisForCall(selectedCallId!),
    enabled: !!selectedCallId,
  });

  // Determine back navigation based on role
  const getBackUrl = () => {
    if (role === 'admin') return '/admin';
    return '/manager';
  };

  const fetchData = async () => {
    if (!repId) return;

    // Fetch rep profile
    const { data: repData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', repId)
      .maybeSingle();

    if (repData) {
      setRep(repData as unknown as Profile);
    }

    // Fetch performance history
    const { data: perfData } = await supabase
      .from('rep_performance_snapshots')
      .select('*')
      .eq('rep_id', repId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (perfData) {
      setPerformance(perfData as unknown as RepPerformanceSnapshot[]);
    }

    // Fetch coaching sessions
    const { data: coachingData } = await supabase
      .from('coaching_sessions')
      .select('*')
      .eq('rep_id', repId)
      .order('session_date', { ascending: false });

    if (coachingData) {
      setCoaching(coachingData as unknown as CoachingSession[]);
    }

    // Fetch activity logs
    const { data: activityData } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('rep_id', repId)
      .order('activity_date', { ascending: false })
      .limit(30);

    if (activityData) {
      setActivities(activityData as unknown as ActivityLog[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [repId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !repId) return;

    const { error } = await supabase.from('coaching_sessions').insert({
      rep_id: repId,
      manager_id: user.id,
      session_date: formData.session_date,
      focus_area: formData.focus_area,
      notes: formData.notes || null,
      action_items: formData.action_items || null,
      follow_up_date: formData.follow_up_date || null,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to create coaching session. Please try again.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Session Created',
        description: 'Coaching session has been recorded.',
      });
      setDialogOpen(false);
      setFormData({
        session_date: format(new Date(), 'yyyy-MM-dd'),
        focus_area: '',
        notes: '',
        action_items: '',
        follow_up_date: '',
      });
      fetchData();
    }
  };

  const handleTranscriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repId || !transcriptForm.rawText.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter the call transcript.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingTranscript(true);
    try {
      const { transcript, analyzeResponse } = await createCallTranscriptAndAnalyze({
        repId,
        callDate: transcriptForm.callDate,
        source: transcriptForm.source,
        rawText: transcriptForm.rawText,
        notes: transcriptForm.notes || undefined,
      });

      if (analyzeResponse.success) {
        toast({
          title: 'Analysis Complete',
          description: 'Call transcript saved and analysis completed.',
        });
      } else if (analyzeResponse.error) {
        toast({
          title: 'Transcript Saved',
          description: `Transcript saved but analysis had an issue: ${analyzeResponse.error}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Transcript Saved',
          description: 'Call transcript saved. Analysis is processing.',
        });
      }

      // Clear form
      setTranscriptForm({
        rawText: '',
        callDate: format(new Date(), 'yyyy-MM-dd'),
        source: 'other',
        notes: '',
      });

      // Refresh transcripts list
      refetchTranscripts();
    } catch (error) {
      console.error('Error submitting transcript:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save transcript.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingTranscript(false);
    }
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

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

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
          <Button variant="outline" onClick={() => navigate(getBackUrl())}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Debug info - only show in development */}
        {import.meta.env.DEV && (
          <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
            Viewing rep: <span className="font-mono">{repId}</span> as{' '}
            <span className="font-medium">{profile?.email || 'unknown'}</span>{' '}
            (role: <span className="font-medium">{role || 'unknown'}</span>)
          </div>
        )}

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(getBackUrl())}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{rep.name}</h1>
            <p className="text-muted-foreground">{rep.email}</p>
          </div>
        </div>

        {/* AI Coaching Snapshot */}
        <AICoachingSnapshot repId={repId!} />

        <Tabs defaultValue="performance">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="coaching">Coaching ({coaching.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="ai-coaching" className="flex items-center gap-1.5">
              <Bot className="h-4 w-4" />
              Call Coaching (AI)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="performance" className="mt-6 space-y-6">
            {/* Performance Trend Charts */}
            <PerformanceTrendCharts performance={performance} />

            {/* Performance History Table */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Performance History</CardTitle>
                <CardDescription>Detailed breakdown by month</CardDescription>
              </CardHeader>
              <CardContent>
                {performance.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead>Revenue</TableHead>
                        <TableHead className="w-[150px]">Progress</TableHead>
                        <TableHead>Demos</TableHead>
                        <TableHead className="w-[150px]">Progress</TableHead>
                        <TableHead>Pipeline</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.map((perf) => {
                        const revenueStatus = getPerformanceStatus(perf.revenue_closed, perf.revenue_goal);
                        const demoStatus = getPerformanceStatus(perf.demos_set, perf.demo_goal);
                        const overallStatus = revenueStatus === 'off-track' || demoStatus === 'off-track'
                          ? 'off-track'
                          : revenueStatus === 'at-risk' || demoStatus === 'at-risk'
                          ? 'at-risk'
                          : 'on-track';

                        return (
                          <TableRow key={perf.id}>
                            <TableCell className="font-medium">
                              {monthNames[perf.period_month - 1]} {perf.period_year}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(perf.revenue_closed)} / {formatCurrency(perf.revenue_goal)}
                            </TableCell>
                            <TableCell>
                              <ProgressBar value={perf.revenue_closed} goal={perf.revenue_goal} showLabel={false} size="sm" />
                            </TableCell>
                            <TableCell>
                              {perf.demos_set} / {perf.demo_goal}
                            </TableCell>
                            <TableCell>
                              <ProgressBar value={perf.demos_set} goal={perf.demo_goal} showLabel={false} size="sm" />
                            </TableCell>
                            <TableCell>{perf.pipeline_count || '-'}</TableCell>
                            <TableCell>
                              <StatusBadge status={overallStatus}>
                                {overallStatus === 'on-track' ? 'On Track' : overallStatus === 'at-risk' ? 'At Risk' : 'Off Track'}
                              </StatusBadge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No performance data available.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
                            {format(new Date(session.session_date), 'MMM d, yyyy')}
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
                            Follow-up: {format(new Date(session.follow_up_date), 'MMM d, yyyy')}
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

          <TabsContent value="activity" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activities.map((activity) => (
                        <TableRow key={activity.id}>
                          <TableCell>{format(new Date(activity.activity_date), 'MMM d, yyyy')}</TableCell>
                          <TableCell>{activityTypeLabels[activity.activity_type]}</TableCell>
                          <TableCell>{activity.count}</TableCell>
                          <TableCell className="max-w-xs truncate">{activity.notes || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No activity logged.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call Coaching (AI) Tab */}
          <TabsContent value="ai-coaching" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Form + Transcripts List */}
              <div className="space-y-6">
                {/* New Call Analysis Form */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Plus className="h-5 w-5" />
                      New Call Analysis
                    </CardTitle>
                    <CardDescription>
                      Paste a call transcript to get AI-powered coaching insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleTranscriptSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="rawText">Call Transcript *</Label>
                        <Textarea
                          id="rawText"
                          placeholder="Paste the call transcript here..."
                          value={transcriptForm.rawText}
                          onChange={(e) => setTranscriptForm({ ...transcriptForm, rawText: e.target.value })}
                          rows={6}
                          required
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="callDate">Call Date</Label>
                          <Input
                            id="callDate"
                            type="date"
                            value={transcriptForm.callDate}
                            onChange={(e) => setTranscriptForm({ ...transcriptForm, callDate: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="source">Source</Label>
                          <Select
                            value={transcriptForm.source}
                            onValueChange={(value: CallSource) => setTranscriptForm({ ...transcriptForm, source: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="zoom">Zoom</SelectItem>
                              <SelectItem value="teams">Teams</SelectItem>
                              <SelectItem value="dialer">Dialer</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="transcriptNotes">Internal Notes (Optional)</Label>
                        <Textarea
                          id="transcriptNotes"
                          placeholder="Any context or notes about this call..."
                          value={transcriptForm.notes}
                          onChange={(e) => setTranscriptForm({ ...transcriptForm, notes: e.target.value })}
                          rows={2}
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={isSubmittingTranscript}>
                        {isSubmittingTranscript ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          'Save Transcript & Analyze'
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Transcripts List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Call Transcripts</CardTitle>
                    <CardDescription>
                      {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} for this rep
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTranscripts ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : transcripts.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Source</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transcripts.map((transcript) => (
                            <TableRow
                              key={transcript.id}
                              className={selectedCallId === transcript.id ? 'bg-muted/50' : ''}
                            >
                              <TableCell className="font-medium">
                                {format(new Date(transcript.call_date), 'MMM d, yyyy')}
                              </TableCell>
                              <TableCell>{sourceLabels[transcript.source as CallSource] || transcript.source}</TableCell>
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
                                {transcript.analysis_status === 'completed' && (
                                  <Button
                                    variant={selectedCallId === transcript.id ? 'secondary' : 'outline'}
                                    size="sm"
                                    onClick={() => setSelectedCallId(
                                      selectedCallId === transcript.id ? null : transcript.id
                                    )}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    {selectedCallId === transcript.id ? 'Hide' : 'View'}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-muted-foreground text-center py-8">
                        No call transcripts yet. Add your first one above!
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Analysis Panel */}
              <div>
                {selectedCallId ? (
                  <Card className="sticky top-4">
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Bot className="h-5 w-5" />
                          AI Call Analysis
                        </CardTitle>
                        <CardDescription>
                          Insights and coaching recommendations
                        </CardDescription>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedCallId(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAnalysis ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : selectedAnalysis ? (
                        <div className="space-y-6">
                          {/* Call Summary */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2">Summary</h4>
                            <p className="text-sm text-muted-foreground">{selectedAnalysis.call_summary}</p>
                          </div>

                          {/* Score Chips */}
                          <div>
                            <h4 className="text-sm font-semibold mb-3">Scores</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedAnalysis.discovery_score !== null && (
                                <ScoreChip label="Discovery" score={selectedAnalysis.discovery_score} />
                              )}
                              {selectedAnalysis.objection_handling_score !== null && (
                                <ScoreChip label="Objections" score={selectedAnalysis.objection_handling_score} />
                              )}
                              {selectedAnalysis.rapport_communication_score !== null && (
                                <ScoreChip label="Rapport" score={selectedAnalysis.rapport_communication_score} />
                              )}
                              {selectedAnalysis.product_knowledge_score !== null && (
                                <ScoreChip label="Product" score={selectedAnalysis.product_knowledge_score} />
                              )}
                              {selectedAnalysis.deal_advancement_score !== null && (
                                <ScoreChip label="Deal" score={selectedAnalysis.deal_advancement_score} />
                              )}
                              {selectedAnalysis.call_effectiveness_score !== null && (
                                <ScoreChip label="Effectiveness" score={selectedAnalysis.call_effectiveness_score} />
                              )}
                            </div>
                          </div>

                          {/* Deal Gaps */}
                          {selectedAnalysis.deal_gaps && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Deal Gaps</h4>
                              <div className="space-y-3">
                                {(selectedAnalysis.deal_gaps as any).critical_missing_info?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Critical Missing Info</p>
                                    <ul className="text-sm space-y-1">
                                      {(selectedAnalysis.deal_gaps as any).critical_missing_info.map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-destructive">•</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {(selectedAnalysis.deal_gaps as any).unresolved_objections?.length > 0 && (
                                  <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-1">Unresolved Objections</p>
                                    <ul className="text-sm space-y-1">
                                      {(selectedAnalysis.deal_gaps as any).unresolved_objections.map((item: string, i: number) => (
                                        <li key={i} className="flex items-start gap-2">
                                          <span className="text-warning">•</span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Strengths */}
                          {selectedAnalysis.strengths && (selectedAnalysis.strengths as any[]).length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Strengths</h4>
                              <ul className="text-sm space-y-2">
                                {(selectedAnalysis.strengths as any[]).map((item, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-success">✓</span>
                                    <div>
                                      <span className="font-medium">{item.area}:</span>{' '}
                                      <span className="text-muted-foreground">{item.example}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Opportunities */}
                          {selectedAnalysis.opportunities && (selectedAnalysis.opportunities as any[]).length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Opportunities</h4>
                              <ul className="text-sm space-y-2">
                                {(selectedAnalysis.opportunities as any[]).map((item, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <span className="text-primary">→</span>
                                    <div>
                                      <span className="font-medium">{item.area}:</span>{' '}
                                      <span className="text-muted-foreground">{item.example}</span>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* Tags */}
                          <div className="space-y-3">
                            {selectedAnalysis.skill_tags && selectedAnalysis.skill_tags.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Skill Tags</p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedAnalysis.skill_tags.map((tag, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedAnalysis.deal_tags && selectedAnalysis.deal_tags.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Deal Tags</p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedAnalysis.deal_tags.map((tag, i) => (
                                    <Badge key={i} variant="outline" className="text-xs">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedAnalysis.meta_tags && selectedAnalysis.meta_tags.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1.5">Meta Tags</p>
                                <div className="flex flex-wrap gap-1">
                                  {selectedAnalysis.meta_tags.map((tag, i) => (
                                    <Badge key={i} variant="outline" className="text-xs bg-muted">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground text-center py-8">
                          No analysis found for this call.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                      <Bot className="h-12 w-12 text-muted-foreground/50 mb-4" />
                      <h4 className="text-lg font-medium mb-2">No Analysis Selected</h4>
                      <p className="text-sm text-muted-foreground max-w-xs">
                        Click "View" on a completed transcript to see the AI analysis and coaching insights.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// Helper component for score chips
function ScoreChip({ label, score }: { label: string; score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-success/10 text-success border-success/20';
    if (score >= 60) return 'bg-warning/10 text-warning border-warning/20';
    return 'bg-destructive/10 text-destructive border-destructive/20';
  };

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium ${getScoreColor(score)}`}>
      <span>{label}</span>
      <span className="font-bold">{score}</span>
    </div>
  );
}
