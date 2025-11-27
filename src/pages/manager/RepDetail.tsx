import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { ProgressBar } from '@/components/ui/progress-bar';
import { StatusBadge, getPerformanceStatus } from '@/components/ui/status-badge';
import { PerformanceTrendCharts } from '@/components/charts/PerformanceTrendCharts';
import { Profile, RepPerformanceSnapshot, CoachingSession, ActivityLog, ActivityType } from '@/types/database';
import { ArrowLeft, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const activityTypeLabels: Record<ActivityType, string> = {
  cold_calls: 'Cold Calls',
  emails: 'Emails',
  linkedin: 'LinkedIn',
  demos: 'Demos',
  meetings: 'Meetings',
  proposals: 'Proposals',
};

export default function RepDetail() {
  const { repId } = useParams<{ repId: string }>();
  const { user, profile, role } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
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
        <div className="text-center py-8">
          <p className="text-muted-foreground">Rep not found or you don't have access.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate(getBackUrl())}>
            Back to Dashboard
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        {/* Debug info */}
        <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2">
          Viewing rep: <span className="font-mono">{repId}</span> as{' '}
          <span className="font-medium">{profile?.email || 'unknown'}</span>{' '}
          (role: <span className="font-medium">{role || 'unknown'}</span>)
        </div>

        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(getBackUrl())}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{rep.name}</h1>
            <p className="text-muted-foreground">{rep.email}</p>
          </div>
        </div>

        <Tabs defaultValue="performance">
          <TabsList>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="coaching">Coaching ({coaching.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
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
        </Tabs>
      </div>
    </AppLayout>
  );
}
