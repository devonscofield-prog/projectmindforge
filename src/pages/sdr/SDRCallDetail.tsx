import { useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRCallDetail, useReGradeCall } from '@/hooks/useSDR';
import { ArrowLeft, Loader2, RefreshCw, Star, TrendingUp, MessageSquare, Target, Award, Clock } from 'lucide-react';
import { gradeColors } from '@/constants/training';
import { Progress } from '@/components/ui/progress';

function SDRCallDetail() {
  const { callId } = useParams<{ callId: string }>();
  const { data: call, isLoading, isError } = useSDRCallDetail(callId);
  const reGradeMutation = useReGradeCall();

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (isError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load call details. Please try refreshing.</p></div></AppLayout>;
  }

  if (!call) {
    return <AppLayout><div className="text-center py-12"><p className="text-muted-foreground">Call not found</p></div></AppLayout>;
  }

  const grade = call.sdr_call_grades?.[0];

  const scoreItems = grade ? [
    { label: 'Opener', score: grade.opener_score, icon: Star },
    { label: 'Engagement', score: grade.engagement_score, icon: MessageSquare },
    { label: 'Objection Handling', score: grade.objection_handling_score, icon: TrendingUp },
    { label: 'Appointment Setting', score: grade.appointment_setting_score, icon: Target },
    { label: 'Professionalism', score: grade.professionalism_score, icon: Award },
  ] : [];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{call.prospect_name || `Call #${call.call_index}`}</h1>
            <p className="text-muted-foreground">
              {call.prospect_company && `${call.prospect_company} • `}{call.start_timestamp}
            </p>
          </div>
          {grade && (
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-lg font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                {grade.overall_grade}
              </span>
              {grade.meeting_scheduled === true && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-600">Meeting Set</span>
              )}
              {grade.meeting_scheduled === false && (
                <span className="text-sm text-muted-foreground">No Meeting</span>
              )}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => reGradeMutation.mutate(call.id)} disabled={reGradeMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${reGradeMutation.isPending ? 'animate-spin' : ''}`} />
            Re-grade
          </Button>
        </div>

        {grade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scores */}
            <Card>
              <CardHeader><CardTitle>Scores</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {scoreItems.map(({ label, score, icon: Icon }) => (
                  <div key={label} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /><span className="text-sm font-medium">{label}</span></div>
                      <span className="text-sm font-bold">{score ?? '—'}/10</span>
                    </div>
                    <Progress value={(score ?? 0) * 10} className="h-2" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary & Coaching */}
            <div className="space-y-4">
              {grade.call_summary && (
                <Card>
                  <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                  <CardContent><p className="text-sm">{grade.call_summary}</p></CardContent>
                </Card>
              )}
              {grade.strengths && (grade.strengths as string[]).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-green-500">Strengths</CardTitle></CardHeader>
                  <CardContent><ul className="list-disc list-inside space-y-1 text-sm">{(grade.strengths as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul></CardContent>
                </Card>
              )}
              {grade.improvements && (grade.improvements as string[]).length > 0 && (
                <Card>
                  <CardHeader><CardTitle className="text-orange-500">Improvements</CardTitle></CardHeader>
                  <CardContent><ul className="list-disc list-inside space-y-1 text-sm">{(grade.improvements as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul></CardContent>
                </Card>
              )}
              {grade.coaching_notes && (
                <Card>
                  <CardHeader><CardTitle>Coaching Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap">{grade.coaching_notes}</p></CardContent>
                </Card>
              )}
              {grade.key_moments && (grade.key_moments as Array<{ timestamp: string; description: string; sentiment: string }>).length > 0 && (
                <Card>
                  <CardHeader><CardTitle>Key Moments</CardTitle></CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {(grade.key_moments as Array<{ timestamp: string; description: string; sentiment: string }>).map((moment, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="flex items-center gap-1.5 mt-0.5 shrink-0">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs font-mono text-muted-foreground">{moment.timestamp}</span>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm">{moment.description}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                            moment.sentiment === 'positive' ? 'bg-green-500/10 text-green-500' :
                            moment.sentiment === 'negative' ? 'bg-red-500/10 text-red-500' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {moment.sentiment}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* Raw Transcript */}
        <Card>
          <CardHeader><CardTitle>Call Transcript</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm font-mono bg-muted/50 p-4 rounded-lg max-h-96 overflow-y-auto">{call.raw_text}</pre>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default SDRCallDetail;
