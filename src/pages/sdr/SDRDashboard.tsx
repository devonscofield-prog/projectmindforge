import { useState, useMemo } from 'react';
import { SDRAssistantChat } from '@/components/SDRAssistantChat';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  useSDRTranscriptList,
  useSDRCallList,
  useRetrySDRTranscript,
  isTranscriptStuck,
} from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Upload, Phone, MessageSquare, TrendingUp, Loader2, RotateCcw, ArrowRight, CalendarCheck, Target, Flame, Trophy, Hash, BarChart3, FileText, AlertTriangle, Headphones } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { TranscriptUploadForm } from '@/components/sdr/TranscriptUploadForm';
import { Link } from 'react-router-dom';
import { format, subDays, parseISO } from 'date-fns';
import { gradeColors } from '@/constants/training';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';


// Grade order for sorting in distribution chart
const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function SDRDashboard() {
  const { user } = useAuth();
  const {
    data: transcripts = [],
  } = useSDRTranscriptList({
    sdrId: user?.id,
    enabled: !!user?.id,
    pollWhileProcessing: false,
  });
  const {
    data: recentTranscripts = [],
    isLoading: recentTranscriptsLoading,
    isError: recentTranscriptsError,
  } = useSDRTranscriptList({
    sdrId: user?.id,
    limit: 5,
    enabled: !!user?.id,
  });
  const { data: recentCalls = [] } = useSDRCallList({
    sdrId: user?.id,
    onlyMeaningful: true,
    orderBy: 'recency',
    limit: 100,
    enabled: !!user?.id,
  });
  const retryMutation = useRetrySDRTranscript();
  const [showUpload, setShowUpload] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Keep dashboard metrics on one consistent "today + recent graded calls" snapshot.
  const todayDate = useMemo(() => new Date().toLocaleDateString('en-CA'), []);
  const todayTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.transcript_date === todayDate),
    [todayDate, transcripts],
  );
  const totalCallsToday = useMemo(
    () => todayTranscripts.reduce((sum, transcript) => sum + transcript.total_calls_detected, 0),
    [todayTranscripts],
  );
  const meaningfulCallsToday = useMemo(
    () => todayTranscripts.reduce((sum, transcript) => sum + transcript.meaningful_calls_count, 0),
    [todayTranscripts],
  );
  const conversationRate = totalCallsToday > 0
    ? Math.round((meaningfulCallsToday / totalCallsToday) * 100)
    : null;

  const gradedCallsWindow = useMemo(
    () => recentCalls.filter((call) => call.sdr_call_grades?.[0]),
    [recentCalls],
  );

  // Grade distribution chart data
  const gradeDistribution = useMemo(() => {
    const gradeCounts = gradedCallsWindow.reduce<Record<string, number>>((acc, call) => {
      const grade = call.sdr_call_grades?.[0]?.overall_grade;
      if (grade) acc[grade] = (acc[grade] || 0) + 1;
      return acc;
    }, {});
    const total = Object.values(gradeCounts).reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return GRADE_ORDER
      .filter((grade) => gradeCounts[grade])
      .map(g => ({
        grade: g,
        count: gradeCounts[g],
        pct: Math.round((gradeCounts[g] / total) * 100),
      }));
  }, [gradedCallsWindow]);

  const avgScore = useMemo(() => {
    if (gradedCallsWindow.length === 0) return null;

    const total = gradedCallsWindow.reduce((sum, call) => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return sum;

      const dimensions = [
        grade.opener_score,
        grade.engagement_score,
        grade.objection_handling_score,
        grade.appointment_setting_score,
        grade.professionalism_score,
      ].filter((score): score is number => typeof score === 'number');

      if (dimensions.length === 0) return sum;
      return sum + dimensions.reduce((a, b) => a + b, 0) / dimensions.length;
    }, 0);

    return Math.round((total / gradedCallsWindow.length) * 10) / 10;
  }, [gradedCallsWindow]);

  // Recent graded calls for quick view
  const recentGradedCalls = useMemo(() => {
    return gradedCallsWindow.slice(0, 5);
  }, [gradedCallsWindow]);

  // Transcript IDs that came from audio uploads (for badge display)
  const audioTranscriptIds = useMemo(() => {
    const ids = new Set<string>();
    transcripts.forEach((t) => {
      if (t.upload_method === 'audio') ids.add(t.id);
    });
    return ids;
  }, [transcripts]);

  // Meetings set count
  const meetingsSet = useMemo(() => {
    return gradedCallsWindow.filter((call) => call.sdr_call_grades?.[0]?.meeting_scheduled === true).length;
  }, [gradedCallsWindow]);

  // --- Personal Stats (Task 1) ---
  const GRADE_SCORE_MAP: Record<string, number> = { 'A+': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'F': 1 };
  const personalStats = useMemo(() => {
    // Upload streak: consecutive days (from today backwards) that have at least one transcript
    const uniqueDates = [...new Set(transcripts.map(t => t.transcript_date))].sort().reverse();
    let streak = 0;
    const checkDate = new Date();
    for (const dateStr of uniqueDates) {
      const expected = checkDate.toLocaleDateString('en-CA');
      if (dateStr === expected) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else if (dateStr < expected) {
        break;
      }
    }

    // Best grade ever
    let bestGrade: string | null = null;
    let bestGradeScore = 0;
    gradedCallsWindow.forEach(call => {
      const grade = call.sdr_call_grades?.[0]?.overall_grade;
      if (grade && (GRADE_SCORE_MAP[grade] ?? 0) > bestGradeScore) {
        bestGradeScore = GRADE_SCORE_MAP[grade] ?? 0;
        bestGrade = grade;
      }
    });

    return {
      streak,
      bestGrade,
      totalGraded: gradedCallsWindow.length,
    };
  }, [transcripts, gradedCallsWindow]);

  // --- Trend Chart Data (Task 4) ---
  const [trendPeriod, setTrendPeriod] = useState<7 | 30>(30);
  const trendData = useMemo(() => {
    const cutoff = subDays(new Date(), trendPeriod).toLocaleDateString('en-CA');
    const byDate: Record<string, { total: number; count: number }> = {};

    gradedCallsWindow.forEach(call => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return;
      // Use created_at date as proxy for the call date
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
  }, [gradedCallsWindow, trendPeriod]);

  // --- Processing progress for transcripts (Task 2) ---
  void useMemo(() => {
    return recentTranscripts.filter(t => t.processing_status === 'processing');
  }, [recentTranscripts]);

  return (
    <AppLayout>
      <main className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">SDR Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">Your cold call performance at a glance</p>
          </div>
          <Button variant="gradient" className="self-start sm:self-auto min-h-[44px] md:min-h-0" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Transcript
          </Button>
        </div>

        {/* Stats Cards */}
        <section aria-label="Today's performance metrics" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalCallsToday}</p>
                  <p className="text-sm text-muted-foreground">Calls Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{meaningfulCallsToday}</p>
                  <p className="text-sm text-muted-foreground">Conversations</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Target className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{conversationRate !== null ? `${conversationRate}%` : '—'}</p>
                  <p className="text-sm text-muted-foreground">Connect Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{meetingsSet}</p>
                  <p className="text-sm text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Personal Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Flame className="h-7 w-7 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">{personalStats.streak}</p>
                  <p className="text-sm text-muted-foreground">Day Upload Streak</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-7 w-7 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{personalStats.bestGrade ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Best Grade Ever</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Hash className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{personalStats.totalGraded}</p>
                  <p className="text-sm text-muted-foreground">Total Calls Graded</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Upload Form */}
        {showUpload && (
          <TranscriptUploadForm onUploadComplete={() => setShowUpload(false)} />
        )}

        {/* Two-column layout: Recent Calls + Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Graded Calls */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Graded Calls</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/sdr/history" className="text-muted-foreground hover:text-foreground">
                    View All <ArrowRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {recentGradedCalls.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No graded calls yet"
                    description="Upload a transcript to get started with call grading."
                  />
                ) : (
                  <div className="space-y-2">
                    {recentGradedCalls.map((call) => {
                      const grade = call.sdr_call_grades?.[0];
                      return (
                        <Link key={call.id} to={`/sdr/calls/${call.id}`} className="block">
                          <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <MessageSquare className="h-5 w-5 text-primary shrink-0" />
                              <div className="min-w-0">
                                <p className="font-medium truncate">{call.prospect_name || `Call #${call.call_index}`}</p>
                                <p className="text-sm text-muted-foreground truncate">
                                  {call.prospect_company && `${call.prospect_company} • `}
                                  {grade?.call_summary?.slice(0, 80)}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {audioTranscriptIds.has(call.daily_transcript_id) && (
                                <Badge variant="outline" className="text-xs gap-1 border-purple-300 text-purple-600">
                                  <Headphones className="h-3 w-3" />
                                  Audio
                                </Badge>
                              )}
                              {grade?.meeting_scheduled === true && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Meeting</span>
                              )}
                              {grade && (
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                                  {grade.overall_grade}
                                </span>
                              )}
                            </div>
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
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Last {gradedCallsWindow.length} graded calls</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistribution.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No grades yet"
                  description="Grade distribution will appear once calls are graded."
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

        {/* Trend Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Grade Trend</CardTitle>
              <CardDescription>Average score over time</CardDescription>
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
            {trendData.length < 2 ? (
              <EmptyState
                icon={TrendingUp}
                title="Not enough data yet"
                description="The trend chart will appear after multiple days of graded calls."
              />
            ) : (
              <div role="img" aria-label={`Grade trend line chart showing average scores over the last ${trendPeriod} days`}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={trendData}>
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="avg" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} name="Avg Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transcripts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Transcripts</CardTitle>
            {transcripts.length > 5 && (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/sdr/history" className="text-muted-foreground hover:text-foreground">
                  View All ({transcripts.length}) <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {recentTranscriptsError ? (
              <p className="text-destructive text-center py-8">Failed to load recent transcripts. Please try refreshing.</p>
            ) : recentTranscriptsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : recentTranscripts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No transcripts yet"
                description="Upload your first transcript above to start tracking your calls."
              />
            ) : (
              <div className="space-y-3">
                {recentTranscripts.map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="block">
                    <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium flex items-center gap-2">
                          {format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}
                          {t.upload_method === 'audio' && (
                            <Badge variant="outline" className="text-xs gap-1 border-purple-300 text-purple-600">
                              <Headphones className="h-3 w-3" />
                              Audio
                            </Badge>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t.total_calls_detected} calls detected • {t.meaningful_calls_count} meaningful
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {(t.processing_status === 'failed' || t.processing_status === 'partial') && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setRetryingId(t.id);
                              retryMutation.mutate(t.id, { onSettled: () => setRetryingId(null) });
                            }}
                            disabled={retryingId === t.id}
                            className="h-7 px-2"
                          >
                            <RotateCcw className={`h-3.5 w-3.5 ${retryingId === t.id ? 'animate-spin' : ''}`} />
                            <span className="ml-1 text-xs">Retry</span>
                          </Button>
                        )}
                        {t.processing_status === 'processing' ? (
                          <div className="flex items-center gap-2 min-w-[140px]">
                            {isTranscriptStuck(t) ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 bg-amber-500/10 text-amber-500">
                                    <AlertTriangle className="h-3 w-3" />
                                    Stuck
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="max-w-xs">
                                  <p>Processing seems stuck. Click to view details and retry.</p>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-yellow-500 shrink-0" />
                                <div className="flex-1">
                                  <p className="text-xs text-yellow-500 font-medium">Processing...</p>
                                  <Progress
                                    value={30}
                                    className="h-1.5 mt-0.5 [&>div]:bg-yellow-500"
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        ) : (t.processing_status === 'failed' || t.processing_status === 'partial') && t.processing_error ? (
                          <Tooltip>
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
                          </Tooltip>
                        ) : (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                            t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                            t.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {t.processing_status}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <SDRAssistantChat />
    </AppLayout>
  );
}

export default SDRDashboard;
