import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
import { ArrowLeft, Plus, AlertCircle, Eye, Loader2, X, Bot, FileText, Mail, ExternalLink, Phone, Calendar } from 'lucide-react';
import { format, subDays, isAfter } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  listCallTranscriptsForRep,
  getAnalysisForCall,
  CallTranscript,
} from '@/api/aiCallAnalysis';
import { AICoachingSnapshot } from '@/components/AICoachingSnapshot';
import { CallType, callTypeLabels } from '@/constants/callTypes';
import ReactMarkdown from 'react-markdown';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const activityTypeLabels: Record<ActivityType, string> = {
  cold_calls: 'Cold Calls',
  emails: 'Emails',
  linkedin: 'LinkedIn',
  demos: 'Demos',
  meetings: 'Meetings',
  proposals: 'Proposals',
};

type TimeframeFilter = '7d' | '30d' | '90d' | 'all';

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
  const { toast } = useToast();
  
  // Get default tab from URL query param
  const defaultTab = searchParams.get('tab') || 'performance';
  
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

  // Call History state
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('30d');

  // Call Coaching (AI) state - read-only for managers
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);

  // Fetch transcripts for rep using React Query
  const { data: transcripts = [], isLoading: isLoadingTranscripts } = useQuery({
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

  // Filter transcripts by timeframe
  const filteredTranscripts = useMemo(() => {
    if (timeframe === 'all') return transcripts;
    
    const daysMap: Record<TimeframeFilter, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90,
      'all': 0,
    };
    
    const cutoffDate = subDays(new Date(), daysMap[timeframe]);
    
    return transcripts.filter(t => {
      const callDate = new Date(t.call_date);
      return isAfter(callDate, cutoffDate);
    });
  }, [transcripts, timeframe]);

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

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="coaching">Coaching ({coaching.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="call-history" className="flex items-center gap-1.5">
              <Phone className="h-4 w-4" />
              Call History ({transcripts.length})
            </TabsTrigger>
            <TabsTrigger value="ai-coaching" className="flex items-center gap-1.5">
              <Bot className="h-4 w-4" />
              AI Coaching
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

          {/* Call History Tab - Direct navigation to CallDetailPage */}
          <TabsContent value="call-history" className="mt-6">
            <Card>
              <CardHeader>
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
                              {format(new Date(transcript.call_date), 'MMM d, yyyy')}
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

          {/* AI Coaching Tab - Read-only for managers with inline panel */}
          <TabsContent value="ai-coaching" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left Column: Transcripts List */}
              <div className="space-y-6">
                {/* Transcripts List */}
                <Card>
                  <CardHeader>
                    <CardTitle>Call Transcripts</CardTitle>
                    <CardDescription>
                      {transcripts.length} transcript{transcripts.length !== 1 ? 's' : ''} submitted by {rep?.name?.split(' ')[0] || 'this rep'}
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
                            <TableHead>Stakeholder / Account</TableHead>
                            <TableHead>Call Type</TableHead>
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
                              <TableCell className="max-w-[150px] truncate">
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
                      <div className="text-center py-8">
                        <Bot className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                        <p className="text-muted-foreground">
                          No call transcripts yet. Reps submit their own transcripts from their dashboard.
                        </p>
                      </div>
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
                          Read-only view of rep's analysis
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/calls/${selectedCallId}`)}
                        >
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Full Details
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedCallId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingAnalysis ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : selectedAnalysis ? (
                        <div className="space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
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

                          {/* Call Notes (Read-only markdown) - Hidden for managers */}
                          {role !== 'manager' && selectedAnalysis.call_notes && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                Call Notes
                              </h4>
                              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 rounded-lg p-4 max-h-[300px] overflow-y-auto">
                                <ReactMarkdown
                                  components={{
                                    p: ({children}) => <p className="mb-2">{children}</p>,
                                    ul: ({children}) => <ul className="list-disc ml-6 mb-2">{children}</ul>,
                                    li: ({children}) => <li className="mb-1">{children}</li>,
                                    strong: ({children}) => <strong className="font-bold">{children}</strong>,
                                  }}
                                >
                                  {selectedAnalysis.call_notes}
                                </ReactMarkdown>
                              </div>
                            </div>
                          )}

                          {/* Recap Email Draft (Read-only) - Hidden for managers */}
                          {role !== 'manager' && selectedAnalysis.recap_email_draft && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                Recap Email Draft
                              </h4>
                              <div className="bg-muted/30 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                                <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
                                  {selectedAnalysis.recap_email_draft}
                                </pre>
                              </div>
                            </div>
                          )}

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
                        Click "View" on a completed transcript to see the AI analysis, call notes, and recap email.
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
