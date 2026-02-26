import { useMemo, useState } from 'react';
import { SDRAssistantChat } from '@/components/SDRAssistantChat';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useSDRTeamMembers,
  useSDRTeams,
  useSDRTranscriptList,
  useSDRCallList,
  useSDRTeamGradeSummary,
} from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Phone, TrendingUp, MessageSquare, CalendarCheck, Upload, ArrowRight, BarChart3, FileText, ChevronDown, ChevronRight, Target, ArrowUp, ArrowDown, AlertTriangle } from 'lucide-react';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { SDRLeaderboard } from '@/components/sdr/SDRLeaderboard';
import { TranscriptUploadForm } from '@/components/sdr/TranscriptUploadForm';
import { Link, useSearchParams } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { gradeColors } from '@/constants/training';
import { LineChart, Line, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function SDRManagerDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const uploadForParam = searchParams.get('uploadFor');
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [], isLoading: membersLoading, isError: membersError } = useSDRTeamMembers(myTeam?.id);

  // Upload for rep state
  const [showUpload, setShowUpload] = useState(!!uploadForParam);
  const [selectedSdrId, setSelectedSdrId] = useState<string>(uploadForParam || '');

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);

  const { data: teamTranscripts = [] } = useSDRTranscriptList({
    sdrIds: memberIds,
    enabled: memberIds.length > 0,
    pollWhileProcessing: false,
  });

  const {
    data: recentTeamTranscripts = [],
    isLoading: recentTeamTranscriptsLoading,
    isError: recentTeamTranscriptsError,
  } = useSDRTranscriptList({
    sdrIds: memberIds,
    limit: 5,
    enabled: memberIds.length > 0,
  });

  const { data: teamGradeData } = useSDRTeamGradeSummary({
    memberIds,
    lookbackLimit: 200,
    enabled: memberIds.length > 0,
  });

  const gradeDistribution = useMemo(() => {
    if (!teamGradeData?.gradeDistribution) return [];
    const total = Object.values(teamGradeData.gradeDistribution).reduce((a, b) => a + b, 0);
    return GRADE_ORDER
      .filter(g => teamGradeData.gradeDistribution[g])
      .map(g => ({
        grade: g,
        count: teamGradeData.gradeDistribution[g],
        pct: Math.round((teamGradeData.gradeDistribution[g] / total) * 100),
      }));
  }, [teamGradeData?.gradeDistribution]);

  // Fetch calls for sparklines and trend chart
  const { data: teamCalls = [] } = useSDRCallList({
    sdrIds: memberIds,
    onlyMeaningful: true,
    orderBy: 'recency',
    limit: 500,
    enabled: memberIds.length > 0,
  });

  // Team trend chart data (Task 8)
  const [trendPeriod, setTrendPeriod] = useState<7 | 30>(30);
  const teamTrendData = useMemo(() => {
    const cutoff = subDays(new Date(), trendPeriod).toLocaleDateString('en-CA');
    const byDate: Record<string, { total: number; count: number }> = {};

    teamCalls.forEach(call => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return;
      const dateStr = call.created_at.slice(0, 10);
      if (dateStr < cutoff) return;

      const dims = [
        grade.opener_score,
        grade.engagement_score,
        grade.objection_handling_score,
        grade.appointment_setting_score,
        grade.professionalism_score,
      ].filter((s): s is number => typeof s === 'number');
      if (dims.length === 0) return;
      const avg = dims.reduce((a, b) => a + b, 0) / dims.length;

      if (!byDate[dateStr]) byDate[dateStr] = { total: 0, count: 0 };
      byDate[dateStr].total += avg;
      byDate[dateStr].count += 1;
    });

    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, count }]) => ({
        date: format(parseISO(date), 'MMM d'),
        avg: Math.round((total / count) * 10) / 10,
      }));
  }, [teamCalls, trendPeriod]);

  // Per-member sparkline data (Task 5)
  const memberSparklines = useMemo(() => {
    const cutoff = subDays(new Date(), 30).toLocaleDateString('en-CA');
    const byMember: Record<string, Record<string, { total: number; count: number }>> = {};

    teamCalls.forEach(call => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return;
      const dateStr = call.created_at.slice(0, 10);
      if (dateStr < cutoff) return;

      const dims = [
        grade.opener_score,
        grade.engagement_score,
        grade.objection_handling_score,
        grade.appointment_setting_score,
        grade.professionalism_score,
      ].filter((s): s is number => typeof s === 'number');
      if (dims.length === 0) return;
      const avg = dims.reduce((a, b) => a + b, 0) / dims.length;

      if (!byMember[call.sdr_id]) byMember[call.sdr_id] = {};
      if (!byMember[call.sdr_id][dateStr]) byMember[call.sdr_id][dateStr] = { total: 0, count: 0 };
      byMember[call.sdr_id][dateStr].total += avg;
      byMember[call.sdr_id][dateStr].count += 1;
    });

    const result: Record<string, Array<{ date: string; avg: number }>> = {};
    Object.entries(byMember).forEach(([sdrId, dateMap]) => {
      result[sdrId] = Object.entries(dateMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, { total, count }]) => ({ date: '', avg: Math.round((total / count) * 10) / 10 }));
    });
    return result;
  }, [teamCalls]);

  // Performance Analytics state
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // Per-SDR comparison data for bar chart
  const perSdrComparison = useMemo(() => {
    if (!teamGradeData?.memberStats) return [];
    return members
      .map(m => {
        const stats = teamGradeData.memberStats[m.user_id];
        if (!stats || stats.count === 0) return null;
        return {
          name: m.profiles?.name || m.profiles?.email || 'Unknown',
          avg: Math.round((stats.totalScore / stats.count) * 10) / 10,
          count: stats.count,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.avg - a.avg);
  }, [members, teamGradeData?.memberStats]);

  // Meeting conversion rate
  const meetingConversion = useMemo(() => {
    const totalGraded = teamGradeData?.totalGraded ?? 0;
    const meetings = teamGradeData?.meetingsSet ?? 0;
    if (totalGraded === 0) return { rate: 0, meetings, totalGraded };
    return {
      rate: Math.round((meetings / totalGraded) * 1000) / 10,
      meetings,
      totalGraded,
    };
  }, [teamGradeData]);

  // Improvement tracking: current 30d vs previous 30d per SDR
  const improvementTracking = useMemo(() => {
    const now = new Date();
    const cutoff30 = subDays(now, 30).toLocaleDateString('en-CA');
    const cutoff60 = subDays(now, 60).toLocaleDateString('en-CA');

    return members
      .map(m => {
        const memberCalls = teamCalls.filter(c => c.sdr_id === m.user_id);

        const currentGrades = memberCalls
          .filter(c => c.created_at.slice(0, 10) >= cutoff30)
          .flatMap(c => c.sdr_call_grades ?? []);

        const prevGrades = memberCalls
          .filter(c => {
            const d = c.created_at.slice(0, 10);
            return d >= cutoff60 && d < cutoff30;
          })
          .flatMap(c => c.sdr_call_grades ?? []);

        const avgForGrades = (grades: typeof currentGrades) => {
          if (grades.length === 0) return null;
          let total = 0;
          let count = 0;
          for (const g of grades) {
            const dims = [
              g.opener_score,
              g.engagement_score,
              g.objection_handling_score,
              g.appointment_setting_score,
              g.professionalism_score,
            ].filter((s): s is number => typeof s === 'number');
            if (dims.length > 0) {
              total += dims.reduce((a, b) => a + b, 0) / dims.length;
              count += 1;
            }
          }
          return count > 0 ? total / count : null;
        };

        const currentAvg = avgForGrades(currentGrades);
        const prevAvg = avgForGrades(prevGrades);

        if (currentAvg === null) return null;

        const change = prevAvg !== null ? Math.round((currentAvg - prevAvg) * 10) / 10 : null;

        return {
          name: m.profiles?.name || m.profiles?.email || 'Unknown',
          userId: m.user_id,
          currentAvg: Math.round(currentAvg * 10) / 10,
          prevAvg: prevAvg !== null ? Math.round(prevAvg * 10) / 10 : null,
          change,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => (b.change ?? -999) - (a.change ?? -999));
  }, [members, teamCalls]);

  const selectedMember = members.find(m => m.user_id === selectedSdrId);

  if (teamsLoading || membersLoading || recentTeamTranscriptsLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (teamsError || membersError || recentTeamTranscriptsError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load team members and transcripts. Please try refreshing.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SDR Manager Dashboard</h1>
            <p className="text-muted-foreground">{myTeam?.name || 'Team overview'}</p>
          </div>
          <Button variant="gradient" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload for Rep
          </Button>
        </div>

        {/* Top-level stats */}
        <section aria-label="Team performance metrics" className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamTranscripts.length}</p>
                  <p className="text-sm text-muted-foreground">Transcripts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamGradeData?.avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Team Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamGradeData?.totalGraded ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Graded Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{teamGradeData?.meetingsSet ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Upload for Rep form */}
        {showUpload && (
          <TranscriptUploadForm
            sdrId={selectedSdrId || undefined}
            uploadForName={selectedMember?.profiles?.name || selectedMember?.profiles?.email || (selectedSdrId ? 'Rep' : undefined)}
            onUploadComplete={() => { setShowUpload(false); setSelectedSdrId(''); }}
          >
            <div className="space-y-2">
              <Label htmlFor="sdr-member-select">Team Member</Label>
              <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
                <SelectTrigger id="sdr-member-select">
                  <SelectValue placeholder="Select SDR..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.profiles?.name || m.profiles?.email || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TranscriptUploadForm>
        )}

        {/* Two-column: Team Members + Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members with per-rep stats */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <EmptyState
                    icon={Users}
                    title="No team members assigned yet"
                    description="Invite SDRs to your team to see their performance here."
                  />
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => {
                      const ms = teamGradeData?.memberStats?.[m.user_id];
                      const memberAvg = ms ? Math.round((ms.totalScore / ms.count) * 10) / 10 : null;
                      // Find most common grade for this member
                      const topGrade = ms ? Object.entries(ms.grades).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
                      const memberTranscriptCount = teamTranscripts.filter(t => t.sdr_id === m.user_id).length;

                      return (
                        <Link key={m.id} to={`/sdr-manager/rep/${m.user_id}`} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                              <span className="text-sm font-semibold text-primary">
                                {(m.profiles?.name || '?').charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium">{m.profiles?.name || 'Unknown'}</p>
                              <p className="text-sm text-muted-foreground">{m.profiles?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-right hidden md:block">
                              <p className="text-muted-foreground">{memberTranscriptCount} transcripts</p>
                              <p className="text-muted-foreground">{ms?.count ?? 0} graded calls</p>
                            </div>
                            {/* Sparkline */}
                            {memberSparklines[m.user_id] && memberSparklines[m.user_id].length >= 2 && (
                              <div className="hidden md:block w-20 h-8" role="img" aria-label={`Score trend sparkline for ${m.profiles?.name || 'member'}`} title={`Score trend for ${m.profiles?.name || 'member'}`}>
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={memberSparklines[m.user_id]}>
                                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            )}
                            {ms?.meetings ? (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                                {ms.meetings} mtg{ms.meetings > 1 ? 's' : ''}
                              </span>
                            ) : null}
                            {memberAvg !== null && (
                              <div className="text-right">
                                <p className="font-bold">{memberAvg}</p>
                                <p className="text-xs text-muted-foreground">avg</p>
                              </div>
                            )}
                            {topGrade && (
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[topGrade] || 'bg-muted'}`}>
                                {topGrade}
                              </span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Team Grade Distribution</CardTitle>
              <CardDescription>Last {teamGradeData?.totalGraded ?? 0} graded calls</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistribution.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No grades yet"
                  description="Grade distribution will appear once team calls are graded."
                />
              ) : (
                <div className="space-y-3">
                  {gradeDistribution.map(({ grade, count, pct }) => (
                    <div key={grade} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{grade}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${GRADE_BAR_COLORS[grade] || 'bg-muted-foreground'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Leaderboard */}
        <SDRLeaderboard members={members} teamCalls={teamCalls} />

        {/* Performance Analytics (collapsible) */}
        <Card>
          <CardHeader
            className="cursor-pointer select-none"
            role="button"
            aria-expanded={analyticsOpen}
            onClick={() => setAnalyticsOpen(!analyticsOpen)}
          >
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Performance Analytics
                </CardTitle>
                <CardDescription>Detailed performance comparisons and trends</CardDescription>
              </div>
              {analyticsOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
          {analyticsOpen && (
            <CardContent className="space-y-6">
              {/* Per-SDR Comparison Bar Chart */}
              {perSdrComparison.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold mb-3">Average Score per SDR</h3>
                  <div role="img" aria-label="Horizontal bar chart comparing average scores per SDR" style={{ height: Math.max(200, perSdrComparison.length * 48) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={perSdrComparison} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                        <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                        <RTooltip
                          formatter={(value: number) => [`${value}/10`, 'Avg Score']}
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        />
                        <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                          {perSdrComparison.map((entry, idx) => (
                            <Cell
                              key={idx}
                              fill={entry.avg >= 8 ? '#22c55e' : entry.avg >= 6 ? '#3b82f6' : entry.avg >= 4 ? '#f59e0b' : '#ef4444'}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No graded calls yet"
                  description="Per-SDR comparison will appear once calls are graded."
                />
              )}

              {/* Meeting Conversion + Improvement Tracking row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meeting Conversion Rate */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-500" />
                    <h3 className="text-sm font-semibold">Meeting Conversion Rate</h3>
                  </div>
                  <div className="text-center py-4">
                    <p className="text-4xl font-bold text-green-500">{meetingConversion.rate}%</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {meetingConversion.meetings} meetings from {meetingConversion.totalGraded} graded calls
                    </p>
                  </div>
                </div>

                {/* Improvement Tracking */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Score Change (30d vs prev 30d)</h3>
                  {improvementTracking.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No data available</p>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {improvementTracking.map(item => (
                        <div key={item.userId} className="flex items-center justify-between text-sm">
                          <span className="truncate mr-2">{item.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-muted-foreground">{item.currentAvg}</span>
                            {item.change !== null ? (
                              <span className={`flex items-center gap-0.5 font-medium ${
                                item.change > 0 ? 'text-green-500' : item.change < 0 ? 'text-red-500' : 'text-muted-foreground'
                              }`}>
                                {item.change > 0 ? <ArrowUp className="h-3 w-3" /> : item.change < 0 ? <ArrowDown className="h-3 w-3" /> : null}
                                {item.change > 0 ? '+' : ''}{item.change}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">new</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Recent Team Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Team Transcripts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sdr-manager/transcripts" className="text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTeamTranscripts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No transcripts uploaded yet"
                description="Team transcripts will appear here once SDRs upload their daily calls."
              />
            ) : (
              <div className="space-y-2">
                {recentTeamTranscripts.map((t) => {
                  const member = members.find((m) => m.user_id === t.sdr_id);
                  return (
                    <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{format(new Date(t.transcript_date), 'MMM d, yyyy')}</p>
                        <p className="text-sm text-muted-foreground">
                          {member?.profiles?.name || 'Unknown'} • {t.total_calls_detected} calls • {t.meaningful_calls_count} meaningful
                        </p>
                      </div>
                      {(t.processing_status === 'failed' || t.processing_status === 'partial') && t.processing_error ? (
                        <UITooltip>
                          <TooltipTrigger asChild>
                            <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${
                              t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'
                            }`}>
                              <AlertTriangle className="h-3 w-3" />
                              {t.processing_status}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-xs">
                            <p>{t.processing_error}</p>
                          </TooltipContent>
                        </UITooltip>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                          t.processing_status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                          t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                          t.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {t.processing_status}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Team Grade Trend</CardTitle>
              <CardDescription>Average score across all SDRs over time</CardDescription>
            </div>
            <div className="flex gap-1">
              <Button
                variant={trendPeriod === 7 ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTrendPeriod(7)}
              >
                7d
              </Button>
              <Button
                variant={trendPeriod === 30 ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setTrendPeriod(30)}
              >
                30d
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {teamTrendData.length < 2 ? (
              <EmptyState
                icon={TrendingUp}
                title="Not enough data yet"
                description="The trend chart will appear after multiple days of graded calls."
              />
            ) : (
              <div role="img" aria-label={`Team grade trend line chart over the last ${trendPeriod} days`}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={teamTrendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <RTooltip />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Avg Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to="/sdr-manager/coaching">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <p className="font-medium">Coaching Prompts</p>
                <p className="text-sm text-muted-foreground mt-1">Customize how calls are graded and analyzed for your team</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/sdr-manager/transcripts">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <p className="font-medium">All Team Transcripts</p>
                <p className="text-sm text-muted-foreground mt-1">Browse and filter all transcripts uploaded by your team</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/sdr-manager/invite">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <p className="font-medium">Invite Team Members</p>
                <p className="text-sm text-muted-foreground mt-1">Send invitations or generate a signup link for new SDRs</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
      <SDRAssistantChat />
    </AppLayout>
  );
}

export default SDRManagerDashboard;
