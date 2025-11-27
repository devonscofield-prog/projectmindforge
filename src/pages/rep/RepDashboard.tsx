import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/ui/kpi-card';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RepPerformanceSnapshot, CoachingSession, ActivityLog, ActivityType } from '@/types/database';
import { DollarSign, Target, Calendar, Activity, Brain, Sparkles, AlertCircle } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { listRecentAiAnalysisForRep, CallAnalysis } from '@/api/aiCallAnalysis';

function getTopStrength(analysis: CallAnalysis): string | null {
  if (analysis.strengths && Array.isArray(analysis.strengths) && analysis.strengths.length > 0) {
    const first = analysis.strengths[0];
    return typeof first === 'string' ? first : (first as Record<string, unknown>).description as string || (first as Record<string, unknown>).title as string || null;
  }
  return null;
}

function getTopOpportunity(analysis: CallAnalysis): string | null {
  if (analysis.opportunities && Array.isArray(analysis.opportunities) && analysis.opportunities.length > 0) {
    const first = analysis.opportunities[0];
    return typeof first === 'string' ? first : (first as Record<string, unknown>).description as string || (first as Record<string, unknown>).title as string || null;
  }
  return null;
}

export default function RepDashboard() {
  const { user, profile } = useAuth();
  const [performance, setPerformance] = useState<RepPerformanceSnapshot | null>(null);
  const [latestCoaching, setLatestCoaching] = useState<CoachingSession | null>(null);
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch last 3 AI call analyses
  const { data: aiAnalyses = [], isLoading: aiLoading } = useQuery({
    queryKey: ['rep-ai-insights', user?.id],
    queryFn: () => listRecentAiAnalysisForRep(user!.id, 3),
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;
      const sevenDaysAgo = format(subDays(now, 7), 'yyyy-MM-dd');

      // Fetch current month performance
      const { data: perfData } = await supabase
        .from('rep_performance_snapshots')
        .select('*')
        .eq('rep_id', user.id)
        .eq('period_year', currentYear)
        .eq('period_month', currentMonth)
        .maybeSingle();

      if (perfData) {
        setPerformance(perfData as unknown as RepPerformanceSnapshot);
      }

      // Fetch latest coaching session
      const { data: coachingData } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('rep_id', user.id)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (coachingData) {
        setLatestCoaching(coachingData as unknown as CoachingSession);
      }

      // Fetch recent activity (last 7 days)
      const { data: activityData } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('rep_id', user.id)
        .gte('activity_date', sevenDaysAgo)
        .order('activity_date', { ascending: false });

      if (activityData) {
        setRecentActivity(activityData as unknown as ActivityLog[]);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  const activitySummary = recentActivity.reduce((acc, log) => {
    acc[log.activity_type] = (acc[log.activity_type] || 0) + log.count;
    return acc;
  }, {} as Record<ActivityType, number>);

  const activityTypeLabels: Record<ActivityType, string> = {
    cold_calls: 'Cold Calls',
    emails: 'Emails',
    linkedin: 'LinkedIn',
    demos: 'Demos',
    meetings: 'Meetings',
    proposals: 'Proposals',
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

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Welcome back, {profile?.name?.split(' ')[0] || 'Rep'}</h1>
          <p className="text-muted-foreground mt-1">
            Here's your performance summary for {format(new Date(), 'MMMM yyyy')}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Revenue Closed"
            value={performance?.revenue_closed || 0}
            goal={performance?.revenue_goal || 0}
            icon={DollarSign}
            format="currency"
          />
          <KPICard
            title="Demos Set"
            value={performance?.demos_set || 0}
            goal={performance?.demo_goal || 0}
            icon={Target}
          />
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Count</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{performance?.pipeline_count || 0}</span>
              <p className="text-xs text-muted-foreground mt-1">Active opportunities</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Last Coaching</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">
                {latestCoaching ? format(new Date(latestCoaching.session_date), 'MMM d') : 'N/A'}
              </span>
              <p className="text-xs text-muted-foreground mt-1">
                {latestCoaching?.focus_area || 'No sessions yet'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Latest Coaching Session */}
          <Card>
            <CardHeader>
              <CardTitle>Latest Coaching Session</CardTitle>
              <CardDescription>
                {latestCoaching 
                  ? `${format(new Date(latestCoaching.session_date), 'MMMM d, yyyy')} • ${latestCoaching.focus_area}`
                  : 'No coaching sessions yet'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latestCoaching ? (
                <div className="space-y-4">
                  {latestCoaching.notes && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Notes</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {latestCoaching.notes.split('\n').slice(0, 3).join('\n')}
                      </p>
                    </div>
                  )}
                  {latestCoaching.action_items && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Action Items</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {latestCoaching.action_items.split('\n').slice(0, 3).join('\n')}
                      </p>
                    </div>
                  )}
                  {latestCoaching.follow_up_date && (
                    <p className="text-sm text-muted-foreground">
                      Follow-up: {format(new Date(latestCoaching.follow_up_date), 'MMMM d, yyyy')}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Your manager hasn't scheduled any coaching sessions yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Activity (Last 7 Days)</CardTitle>
              <CardDescription>Your recent sales activities</CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(activitySummary).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(activitySummary).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm">{activityTypeLabels[type as ActivityType]}</span>
                      <span className="text-sm font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No activity logged in the last 7 days. Start logging your activities!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent AI Coaching Insights */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              Recent AI Coaching Insights
            </CardTitle>
            <CardDescription>
              AI-powered analysis of your recent sales calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {aiLoading ? (
              <div className="flex items-center justify-center h-24">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : aiAnalyses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No AI call analyses yet. Ask your manager to run an analysis on your calls.
              </p>
            ) : (
              <div className="space-y-4">
                {aiAnalyses.map((analysis) => {
                  const topStrength = getTopStrength(analysis);
                  const topOpportunity = getTopOpportunity(analysis);
                  
                  return (
                    <div key={analysis.id} className="border rounded-lg p-4 space-y-3">
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {analysis.call_summary}
                      </p>
                      
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            (analysis.call_effectiveness_score || 0) >= 80 ? 'default' :
                            (analysis.call_effectiveness_score || 0) >= 60 ? 'secondary' : 'destructive'
                          }
                        >
                          Effectiveness: {analysis.call_effectiveness_score ?? 'N/A'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Sparkles className="h-3 w-3" /> Top Strength
                          </span>
                          <p className="line-clamp-1 mt-0.5">
                            {topStrength || 'Not identified'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> Top Opportunity
                          </span>
                          <p className="line-clamp-1 mt-0.5">
                            {topOpportunity || 'Not identified'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
