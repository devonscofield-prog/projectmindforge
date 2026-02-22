import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRTranscriptDetail, useSDRCallList, useReGradeCall, useRetrySDRTranscript } from '@/hooks/useSDR';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeft, Loader2, Phone, MessageSquare, Voicemail, PhoneOff, Users, TrendingUp, CalendarCheck, Target, AlertTriangle, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { gradeColors } from '@/constants/training';

import type { LucideIcon } from 'lucide-react';

const callTypeIcons: Record<string, LucideIcon> = {
  conversation: MessageSquare,
  voicemail: Voicemail,
  hangup: PhoneOff,
  internal: Users,
  reminder: Phone,
};

const callTypeLabels: Record<string, string> = {
  conversation: 'Conversation',
  voicemail: 'Voicemail',
  hangup: 'Hangup',
  internal: 'Internal',
  reminder: 'Reminder',
};

function SDRTranscriptDetail() {
  const { transcriptId } = useParams<{ transcriptId: string }>();
  const { role } = useAuth();
  const { data: transcript, isLoading: transcriptLoading, isError: transcriptError, isStuck } = useSDRTranscriptDetail(transcriptId);
  const retryTranscript = useRetrySDRTranscript();
  const { data: calls = [], isLoading: callsLoading, isError: callsError } = useSDRCallList({
    transcriptId,
    orderBy: 'call_index',
    enabled: !!transcriptId,
  });
  const reGradeCall = useReGradeCall();
  const [retryingCallId, setRetryingCallId] = useState<string | null>(null);

  const meaningfulCalls = calls.filter(c => c.is_meaningful);
  const otherCalls = calls.filter(c => !c.is_meaningful);
  const failedCalls = calls.filter(c => c.analysis_status === 'failed');
  const gradedCount = meaningfulCalls.filter(c => c.sdr_call_grades?.length).length;

  // Summary stats for the transcript
  const { avgScore, meetingsSet, topGrade } = useMemo(() => {
    const gradedCalls = meaningfulCalls.filter(c => c.sdr_call_grades?.length);
    if (gradedCalls.length === 0) return { avgScore: null, meetingsSet: 0, topGrade: null };

    const scores = gradedCalls.map(c => {
      const g = c.sdr_call_grades![0];
      const dims = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean) as number[];
      return dims.reduce((a, b) => a + b, 0) / dims.length;
    });
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const meetings = gradedCalls.filter(c => c.sdr_call_grades![0]?.meeting_scheduled === true).length;

    // Find most common grade
    const gradeCount: Record<string, number> = {};
    gradedCalls.forEach(c => {
      const g = c.sdr_call_grades![0]?.overall_grade;
      if (g) gradeCount[g] = (gradeCount[g] || 0) + 1;
    });
    const top = Object.entries(gradeCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return { avgScore: Math.round(avg * 10) / 10, meetingsSet: meetings, topGrade: top };
  }, [meaningfulCalls]);

  // Smart back navigation based on role
  const backPath = role === 'admin' ? '/admin/sdr' : role === 'sdr_manager' ? '/sdr-manager/transcripts' : '/sdr';
  const backLabel = role === 'admin' ? 'SDR Oversight' : role === 'sdr_manager' ? 'Transcripts' : 'Dashboard';

  if (transcriptLoading || callsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (transcriptError || callsError) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load transcript details. Please try refreshing.</p>
          <Button asChild className="mt-4"><Link to={backPath}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        </div>
      </AppLayout>
    );
  }

  if (!transcript) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Transcript not found</p>
          <Button asChild className="mt-4"><Link to={backPath}><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const connectRate = transcript.total_calls_detected > 0
    ? Math.round((transcript.meaningful_calls_count / transcript.total_calls_detected) * 100)
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to={backPath}><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{format(new Date(transcript.transcript_date), 'EEEE, MMM d, yyyy')}</h1>
            <p className="text-muted-foreground">{transcript.total_calls_detected} calls • {transcript.meaningful_calls_count} meaningful</p>
          </div>
          {transcript.processing_status === 'processing' && (
            <div className="ml-auto flex items-center gap-2 min-w-[180px]">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-500 shrink-0" />
              <div className="flex-1">
                {transcript.processing_stage === 'grading' && transcript.meaningful_calls_count > 0 ? (
                  <>
                    <p className="text-xs text-yellow-500 font-medium">
                      Grading calls... {transcript.graded_count}/{transcript.meaningful_calls_count}
                    </p>
                    <Progress
                      value={Math.round((transcript.graded_count / transcript.meaningful_calls_count) * 100)}
                      className="h-1.5 mt-0.5 [&>div]:bg-yellow-500"
                    />
                  </>
                ) : (
                  <p className="text-xs text-yellow-500 font-medium">
                    {transcript.processing_stage === 'splitting' ? 'Splitting transcript...' :
                     transcript.processing_stage === 'filtering' ? 'Classifying calls...' :
                     'Processing...'}
                  </p>
                )}
              </div>
            </div>
          )}
          {transcript.processing_status !== 'processing' && (
            (transcript.processing_status === 'failed' || transcript.processing_status === 'partial') && transcript.processing_error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={`px-2 py-1 rounded text-xs font-medium inline-flex items-center gap-1 ${
                    transcript.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' : 'bg-orange-500/10 text-orange-500'
                  }`}>
                    <AlertTriangle className="h-3 w-3" />
                    {transcript.processing_status}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{transcript.processing_error}</p>
                </TooltipContent>
              </Tooltip>
            ) : (
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                transcript.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                transcript.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                transcript.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                'bg-muted text-muted-foreground'
              }`}>
                {transcript.processing_status}
              </span>
            )
          )}
        </div>

        {/* Stuck Processing Warning */}
        {isStuck && (
          <Alert className="border-amber-500/50 bg-amber-500/5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="flex items-center justify-between">
              <span>Processing seems stuck. You may want to retry.</span>
              <Button
                variant="outline"
                size="sm"
                className="ml-4 shrink-0"
                disabled={retryTranscript.isPending}
                onClick={() => retryTranscript.mutate(transcriptId!)}
              >
                {retryTranscript.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="h-3.5 w-3.5 mr-1" />
                )}
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Summary Stats */}
        {transcript.processing_status !== 'pending' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Target className="h-7 w-7 text-primary" />
                  <div>
                    <p className="text-xl font-bold">{connectRate}%</p>
                    <p className="text-xs text-muted-foreground">Connect Rate</p>
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
                  <CalendarCheck className="h-7 w-7 text-green-500" />
                  <div>
                    <p className="text-xl font-bold">{meetingsSet}</p>
                    <p className="text-xs text-muted-foreground">Meetings Set</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {topGrade && (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <span className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${gradeColors[topGrade] || 'bg-muted'}`}>
                      {topGrade}
                    </span>
                    <div>
                      <p className="text-xl font-bold">{topGrade}</p>
                      <p className="text-xs text-muted-foreground">Most Common</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Meaningful Calls */}
        <div>
          <h2 className="text-lg font-semibold mb-3">Meaningful Conversations ({meaningfulCalls.length})</h2>
          <div className="space-y-3">
            {meaningfulCalls.map((call) => {
              const grade = call.sdr_call_grades?.[0];
              return (
                <Link key={call.id} to={`/sdr/calls/${call.id}`} className="block">
                  <Card className="hover:bg-accent/30 transition-colors">
                    <CardContent className="py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <div>
                          <p className="font-medium">{call.prospect_name || `Call #${call.call_index}`}</p>
                          <p className="text-sm text-muted-foreground">
                            {call.prospect_company && `${call.prospect_company} • `}
                            {call.start_timestamp}
                            {call.duration_estimate_seconds && ` • ~${Math.round(call.duration_estimate_seconds / 60)}min`}
                          </p>
                          {grade?.call_summary && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{grade.call_summary}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {grade ? (
                          <>
                            <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                              {grade.overall_grade}
                            </span>
                            {grade.meeting_scheduled === true && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">Meeting Set</span>
                            )}
                          </>
                        ) : call.analysis_status === 'processing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : call.analysis_status === 'failed' ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-500">Failed</span>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
            {meaningfulCalls.length === 0 && (
              <p className="text-muted-foreground text-center py-4">No meaningful conversations detected</p>
            )}
          </div>
        </div>

        {/* Grading Summary */}
        {meaningfulCalls.length > 0 && transcript.processing_status !== 'pending' && transcript.processing_status !== 'processing' && (
          <p className="text-sm text-muted-foreground">
            {gradedCount} of {meaningfulCalls.length} calls graded successfully
            {failedCalls.length > 0 && `, ${failedCalls.length} failed`}
          </p>
        )}

        {/* Failed Calls */}
        {failedCalls.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3 text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Failed Calls ({failedCalls.length})
            </h2>
            <div className="space-y-2">
              {failedCalls.map((call) => (
                <Card key={call.id} className="border-red-500/20">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Phone className="h-4 w-4 text-red-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">
                          {call.prospect_name || `Call #${call.call_index}`}
                        </p>
                        {call.processing_error && (
                          <p className="text-xs text-red-500 truncate">{call.processing_error}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 px-2"
                      disabled={retryingCallId === call.id}
                      onClick={() => {
                        setRetryingCallId(call.id);
                        reGradeCall.mutate(call.id, { onSettled: () => setRetryingCallId(null) });
                      }}
                    >
                      <RotateCcw className={`h-3.5 w-3.5 ${retryingCallId === call.id ? 'animate-spin' : ''}`} />
                      <span className="ml-1 text-xs">Retry</span>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Other Calls */}
        {otherCalls.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Other Segments ({otherCalls.length})</h2>
            <div className="grid gap-2">
              {otherCalls.map((call) => {
                const Icon = callTypeIcons[call.call_type] || Phone;
                return (
                  <div key={call.id} className="flex items-center gap-3 p-3 rounded-lg border text-sm">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{callTypeLabels[call.call_type] || call.call_type}</span>
                    <span className="text-muted-foreground">{call.start_timestamp}</span>
                    {call.prospect_name && <span className="text-muted-foreground">• {call.prospect_name}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

export default SDRTranscriptDetail;
