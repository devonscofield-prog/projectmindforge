import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  useSDRTranscriptList,
  useSDRCallList,
  useSDRProfile,
  useRetrySDRTranscript,
} from '@/hooks/useSDR';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Loader2, Phone, MessageSquare, TrendingUp, FileText, RotateCcw, CalendarCheck, Upload, ThumbsUp, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { gradeColors } from '@/constants/training';
import { Progress } from '@/components/ui/progress';
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PerformanceTrendChart } from '@/components/dashboard/PerformanceTrendChart';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function SDRManagerRepDetail() {
  const { sdrId } = useParams<{ sdrId: string }>();
  const { role } = useAuth();
  const { data: transcripts = [], isLoading: transcriptsLoading, isError: transcriptsError } = useSDRTranscriptList({
    sdrId,
    enabled: !!sdrId,
  });
  const { data: allCalls = [], isError: callsError } = useSDRCallList({
    sdrId,
    orderBy: 'recency',
    limit: 200,
    enabled: !!sdrId,
  });
  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const { data: sdrProfile } = useSDRProfile(sdrId);

  const meaningfulCalls = allCalls.filter(c => c.is_meaningful);
  const gradedCalls = meaningfulCalls.filter(c => c.sdr_call_grades?.length);
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

  // Meetings count
  const meetingsSet = useMemo(() => {
    return gradedCalls.filter(c => c.sdr_call_grades?.[0]?.meeting_scheduled === true).length;
  }, [gradedCalls]);

  const avgScore = useMemo(() => {
    if (gradedCalls.length === 0) return null;
    const total = gradedCalls.reduce((sum, call) => {
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

    return Math.round((total / gradedCalls.length) * 10) / 10;
  }, [gradedCalls]);

  // Grade distribution from the same graded-call window used across this screen.
  const gradeDistribution = useMemo(() => {
    const gradeCounts = gradedCalls.reduce<Record<string, number>>((acc, call) => {
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
  }, [gradedCalls]);

  // Dimension averages across all graded calls
  const dimensionAverages = useMemo(() => {
    if (gradedCalls.length === 0) return null;
    const dims = { opener: 0, engagement: 0, objection: 0, appointment: 0, professionalism: 0 };
    let count = 0;
    gradedCalls.forEach(c => {
      const g = c.sdr_call_grades?.[0];
      if (!g) return;
      count++;
      dims.opener += g.opener_score || 0;
      dims.engagement += g.engagement_score || 0;
      dims.objection += g.objection_handling_score || 0;
      dims.appointment += g.appointment_setting_score || 0;
      dims.professionalism += g.professionalism_score || 0;
    });
    if (count === 0) return null;
    return {
      opener: Math.round((dims.opener / count) * 10) / 10,
      engagement: Math.round((dims.engagement / count) * 10) / 10,
      objection: Math.round((dims.objection / count) * 10) / 10,
      appointment: Math.round((dims.appointment / count) * 10) / 10,
      professionalism: Math.round((dims.professionalism / count) * 10) / 10,
    };
  }, [gradedCalls]);

  // Grade trend chart data (avg score per day)
  const gradeTrendData = useMemo(() => {
    const byDate: Record<string, { total: number; count: number }> = {};
    gradedCalls.forEach(call => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return;
      const dateStr = call.created_at.slice(0, 10);
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
        score: Math.round((total / count) * 10),
      }));
  }, [gradedCalls]);

  // Dimension breakdown for Recharts horizontal bar chart
  const dimensionBarData = useMemo(() => {
    if (!dimensionAverages) return [];
    return [
      { name: 'Opener', score: dimensionAverages.opener },
      { name: 'Engagement', score: dimensionAverages.engagement },
      { name: 'Objection Handling', score: dimensionAverages.objection },
      { name: 'Appointment Setting', score: dimensionAverages.appointment },
      { name: 'Professionalism', score: dimensionAverages.professionalism },
    ].sort((a, b) => b.score - a.score);
  }, [dimensionAverages]);

  // Fetch recent grades with strengths/improvements
  const { data: recentGradesWithFeedback = [] } = useQuery({
    queryKey: ['sdr', 'grades-feedback', sdrId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sdr_call_grades')
        .select('strengths, improvements')
        .eq('sdr_id', sdrId!)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Array<{ strengths: string[] | null; improvements: string[] | null }>;
    },
    enabled: !!sdrId,
    staleTime: 30_000,
  });

  // Aggregate strengths and improvements with frequency
  const { topStrengths, topImprovements } = useMemo(() => {
    const strengthCounts: Record<string, number> = {};
    const improvementCounts: Record<string, number> = {};

    recentGradesWithFeedback.forEach(g => {
      if (Array.isArray(g.strengths)) {
        g.strengths.forEach(s => {
          if (typeof s === 'string' && s.trim()) {
            strengthCounts[s.trim()] = (strengthCounts[s.trim()] || 0) + 1;
          }
        });
      }
      if (Array.isArray(g.improvements)) {
        g.improvements.forEach(i => {
          if (typeof i === 'string' && i.trim()) {
            improvementCounts[i.trim()] = (improvementCounts[i.trim()] || 0) + 1;
          }
        });
      }
    });

    const topStrengths = Object.entries(strengthCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    const topImprovements = Object.entries(improvementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([text, count]) => ({ text, count }));

    return { topStrengths, topImprovements };
  }, [recentGradesWithFeedback]);

  if (transcriptsError || callsError) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load rep details. Please try refreshing.</p>
          <Button asChild className="mt-4"><Link to="/sdr-manager"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to={role === 'admin' ? '/admin/sdr' : '/sdr-manager'}><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{sdrProfile?.name || 'SDR Performance'}</h1>
            <p className="text-muted-foreground">{sdrProfile?.email || 'Individual rep drilldown'}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-xl font-bold">{totalCallsToday}</p>
                  <p className="text-xs text-muted-foreground">Calls Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-xl font-bold">{meaningfulCallsToday}</p>
                  <p className="text-xs text-muted-foreground">Conversations Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-xl font-bold">{avgScore ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-7 w-7 text-primary" />
                <div>
                  <p className="text-xl font-bold">{gradedCalls.length}</p>
                  <p className="text-xs text-muted-foreground">Graded Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-7 w-7 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{meetingsSet}</p>
                  <p className="text-xs text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload Shortcut */}
        <Card className="border-dashed border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Upload className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-semibold">Upload Transcript for {sdrProfile?.name || 'this SDR'}</p>
                  <p className="text-sm text-muted-foreground">Upload a daily call transcript on behalf of this rep</p>
                </div>
              </div>
              <Button variant="gradient" asChild>
                <Link to={`/sdr-manager?uploadFor=${sdrId}`}>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Two-column: Dimension Averages + Grade Distribution */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dimension Averages */}
          {dimensionAverages && (
            <Card>
              <CardHeader>
                <CardTitle>Skill Breakdown</CardTitle>
                <CardDescription>Average scores across {gradedCalls.length} graded calls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Opener', score: dimensionAverages.opener },
                  { label: 'Engagement', score: dimensionAverages.engagement },
                  { label: 'Objection Handling', score: dimensionAverages.objection },
                  { label: 'Appointment Setting', score: dimensionAverages.appointment },
                  { label: 'Professionalism', score: dimensionAverages.professionalism },
                ].map(({ label, score }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className={`font-bold ${
                        score >= 8 ? 'text-green-500' : score >= 6 ? 'text-blue-500' : score >= 4 ? 'text-amber-500' : 'text-red-500'
                      }`}>{score}/10</span>
                    </div>
                    <Progress value={score * 10} className={`h-2.5 ${
                      score >= 8 ? '[&>div]:bg-green-500' : score >= 6 ? '[&>div]:bg-blue-500' : score >= 4 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'
                    }`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Grade Distribution</CardTitle>
              <CardDescription>Last {gradedCalls.length} graded calls</CardDescription>
            </CardHeader>
            <CardContent>
              {gradeDistribution.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">No grades yet</p>
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

        {/* Grade Trend Chart */}
        {gradeTrendData.length >= 2 && (
          <PerformanceTrendChart
            data={gradeTrendData}
            title="Grade Trend"
          />
        )}

        {/* Dimension Breakdown Bar Chart */}
        {dimensionBarData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Dimension Breakdown</CardTitle>
              <CardDescription>Average scores per grading dimension from recent calls</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dimensionBarData} layout="vertical" margin={{ left: 0, right: 20, top: 5, bottom: 5 }}>
                    <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={140} />
                    <Tooltip
                      formatter={(value: number) => [`${value}/10`, 'Score']}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {dimensionBarData.map((entry, idx) => (
                        <Cell
                          key={idx}
                          fill={entry.score >= 8 ? '#22c55e' : entry.score >= 6 ? '#3b82f6' : entry.score >= 4 ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Strengths & Areas for Improvement */}
        {(topStrengths.length > 0 || topImprovements.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {topStrengths.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ThumbsUp className="h-5 w-5 text-green-500" />
                    Strengths
                  </CardTitle>
                  <CardDescription>Most frequent strengths from recent grades</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {topStrengths.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center text-xs font-medium">
                          {item.count}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
            {topImprovements.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                    Areas for Improvement
                  </CardTitle>
                  <CardDescription>Most frequent improvement areas from recent grades</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {topImprovements.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center text-xs font-medium">
                          {item.count}
                        </span>
                        <span>{item.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Recent Graded Calls */}
        {gradedCalls.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Recent Graded Calls</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {gradedCalls.slice(0, 15).map((call) => {
                  const grade = call.sdr_call_grades?.[0];
                  return (
                    <Link key={call.id} to={`/sdr/calls/${call.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{call.prospect_name || `Call #${call.call_index}`}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {call.prospect_company && `${call.prospect_company} • `}
                          {call.start_timestamp}
                          {grade?.call_summary && ` • ${grade.call_summary.slice(0, 60)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {grade?.meeting_scheduled === true && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Meeting</span>
                        )}
                        {grade && (
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                            {grade.overall_grade}
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transcripts */}
        <Card>
          <CardHeader><CardTitle>Transcripts</CardTitle></CardHeader>
          <CardContent>
            {transcriptsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : transcripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No transcripts uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {transcripts.map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.total_calls_detected} calls • {t.meaningful_calls_count} meaningful
                        {t.total_calls_detected > 0 && ` • ${Math.round((t.meaningful_calls_count / t.total_calls_detected) * 100)}% connect rate`}
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
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default SDRManagerRepDetail;
