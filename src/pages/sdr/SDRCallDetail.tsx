import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSDRCallDetail, useSDRCallList, useReGradeCall } from '@/hooks/useSDR';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, RefreshCw, Star, TrendingUp, MessageSquare, Target, Award, Clock, ChevronLeft, ChevronRight, CalendarCheck, ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';
import { gradeColors } from '@/constants/training';
import { Progress } from '@/components/ui/progress';

function getScoreColor(score: number | null): string {
  if (score === null) return 'text-muted-foreground';
  if (score >= 8) return 'text-green-500';
  if (score >= 6) return 'text-blue-500';
  if (score >= 4) return 'text-amber-500';
  return 'text-red-500';
}

function getProgressColor(score: number | null): string {
  if (score === null) return '';
  if (score >= 8) return '[&>div]:bg-green-500';
  if (score >= 6) return '[&>div]:bg-blue-500';
  if (score >= 4) return '[&>div]:bg-amber-500';
  return '[&>div]:bg-red-500';
}

function SDRCallDetail() {
  const { callId } = useParams<{ callId: string }>();
  const navigate = useNavigate();
  const { data: call, isLoading, isError } = useSDRCallDetail(callId);
  const reGradeMutation = useReGradeCall();
  const queryClient = useQueryClient();

  // Coaching feedback state
  const [feedbackHelpful, setFeedbackHelpful] = useState<boolean | null>(null);
  const [feedbackNote, setFeedbackNote] = useState('');
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const feedbackMutation = useMutation({
    mutationFn: async ({ gradeId, helpful, note }: { gradeId: string; helpful: boolean; note: string }) => {
      const { error } = await supabase
        .from('sdr_call_grades')
        .update({
          coaching_feedback_helpful: helpful,
          coaching_feedback_note: note || null,
          coaching_feedback_at: new Date().toISOString(),
        })
        .eq('id', gradeId);
      if (error) throw error;
    },
    onSuccess: () => {
      setFeedbackSubmitted(true);
      queryClient.invalidateQueries({ queryKey: ['sdr-call-detail', callId] });
    },
  });

  const handleFeedbackThumb = (helpful: boolean) => {
    setFeedbackHelpful(helpful);
    setShowFeedbackInput(true);
  };

  const handleFeedbackSubmit = () => {
    if (!grade || feedbackHelpful === null) return;
    feedbackMutation.mutate({
      gradeId: grade.id,
      helpful: feedbackHelpful,
      note: feedbackNote,
    });
  };

  // Fetch sibling calls for prev/next navigation
  const { data: siblingCalls = [] } = useSDRCallList({
    transcriptId: call?.daily_transcript_id,
    orderBy: 'call_index',
    enabled: !!call?.daily_transcript_id,
  });

  const { prevCall, nextCall } = useMemo(() => {
    if (!call || siblingCalls.length === 0) return { prevCall: null, nextCall: null };
    const meaningfulCalls = siblingCalls.filter(c => c.is_meaningful);
    const currentIndex = meaningfulCalls.findIndex(c => c.id === call.id);
    return {
      prevCall: currentIndex > 0 ? meaningfulCalls[currentIndex - 1] : null,
      nextCall: currentIndex < meaningfulCalls.length - 1 ? meaningfulCalls[currentIndex + 1] : null,
    };
  }, [call, siblingCalls]);

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
        {/* Header with navigation */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => {
            if (call.daily_transcript_id) {
              navigate(`/sdr/history/${call.daily_transcript_id}`);
            } else {
              window.history.back();
            }
          }}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{call.prospect_name || `Call #${call.call_index}`}</h1>
            <p className="text-muted-foreground">
              {call.prospect_company && `${call.prospect_company} • `}
              {call.start_timestamp}
              {call.duration_estimate_seconds && ` • ~${Math.round(call.duration_estimate_seconds / 60)} min`}
            </p>
          </div>
          {grade && (
            <div className="flex items-center gap-2">
              <span className={`px-4 py-2 rounded-full text-lg font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                {grade.overall_grade}
              </span>
              {grade.meeting_scheduled === true && (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/10 text-green-600 flex items-center gap-1">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  Meeting Set
                </span>
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

        {/* Prev/Next navigation */}
        {(prevCall || nextCall) && (
          <div className="flex items-center justify-between">
            <div>
              {prevCall && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/sdr/calls/${prevCall.id}`}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {prevCall.prospect_name || `Call #${prevCall.call_index}`}
                  </Link>
                </Button>
              )}
            </div>
            <div>
              {nextCall && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`/sdr/calls/${nextCall.id}`}>
                    {nextCall.prospect_name || `Call #${nextCall.call_index}`}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}

        {grade && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Scores */}
            <Card>
              <CardHeader><CardTitle>Scores</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {scoreItems.map(({ label, score, icon: Icon }) => (
                  <div key={label} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                      <span className={`text-sm font-bold ${getScoreColor(score)}`}>{score ?? '—'}/10</span>
                    </div>
                    <Progress value={(score ?? 0) * 10} className={`h-2.5 ${getProgressColor(score)}`} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Summary & Coaching */}
            <div className="space-y-4">
              {grade.call_summary && (
                <Card>
                  <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed">{grade.call_summary}</p></CardContent>
                </Card>
              )}
              {grade.strengths && (grade.strengths as string[]).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Strengths
                    </CardTitle>
                  </CardHeader>
                  <CardContent><ul className="list-disc list-inside space-y-1.5 text-sm">{(grade.strengths as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul></CardContent>
                </Card>
              )}
              {grade.improvements && (grade.improvements as string[]).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      Areas for Improvement
                    </CardTitle>
                  </CardHeader>
                  <CardContent><ul className="list-disc list-inside space-y-1.5 text-sm">{(grade.improvements as string[]).map((s, i) => <li key={i}>{s}</li>)}</ul></CardContent>
                </Card>
              )}
              {grade.coaching_notes && (
                <Card>
                  <CardHeader><CardTitle>Coaching Notes</CardTitle></CardHeader>
                  <CardContent><p className="text-sm whitespace-pre-wrap leading-relaxed">{grade.coaching_notes}</p></CardContent>
                </Card>
              )}
              {/* Coaching Feedback */}
              {grade.coaching_notes && (
                <Card>
                  <CardHeader><CardTitle>Was this coaching helpful?</CardTitle></CardHeader>
                  <CardContent>
                    {grade.coaching_feedback_at && !feedbackSubmitted ? (
                      // Already submitted feedback - read-only
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {grade.coaching_feedback_helpful ? (
                            <ThumbsUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <ThumbsDown className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {grade.coaching_feedback_helpful ? 'You found this helpful' : 'You found this not helpful'}
                          </span>
                        </div>
                        {grade.coaching_feedback_note && (
                          <p className="text-sm text-muted-foreground">{grade.coaching_feedback_note}</p>
                        )}
                      </div>
                    ) : feedbackSubmitted ? (
                      // Just submitted
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">Thanks for your feedback!</span>
                      </div>
                    ) : showFeedbackInput ? (
                      // Show note input after thumb selection
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {feedbackHelpful ? (
                            <ThumbsUp className="h-5 w-5 text-green-500" />
                          ) : (
                            <ThumbsDown className="h-5 w-5 text-red-500" />
                          )}
                          <span className="text-sm font-medium">
                            {feedbackHelpful ? 'Helpful' : 'Not helpful'}
                          </span>
                          <Button variant="ghost" size="sm" onClick={() => { setShowFeedbackInput(false); setFeedbackHelpful(null); setFeedbackNote(''); }}>
                            Change
                          </Button>
                        </div>
                        <Textarea
                          placeholder="Any additional comments? (optional)"
                          value={feedbackNote}
                          onChange={(e) => setFeedbackNote(e.target.value)}
                          rows={2}
                          className="text-sm"
                        />
                        <Button
                          size="sm"
                          onClick={handleFeedbackSubmit}
                          disabled={feedbackMutation.isPending}
                        >
                          {feedbackMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Submit Feedback
                        </Button>
                      </div>
                    ) : (
                      // Initial state - show thumb buttons
                      <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => handleFeedbackThumb(true)} className="gap-2">
                          <ThumbsUp className="h-4 w-4" />
                          Helpful
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleFeedbackThumb(false)} className="gap-2">
                          <ThumbsDown className="h-4 w-4" />
                          Not Helpful
                        </Button>
                      </div>
                    )}
                  </CardContent>
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

        {!grade && call.analysis_status === 'processing' && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-muted-foreground">This call is being analyzed...</p>
            </CardContent>
          </Card>
        )}

        {!grade && call.analysis_status === 'failed' && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-3">Grading failed for this call.</p>
              <Button variant="outline" onClick={() => reGradeMutation.mutate(call.id)} disabled={reGradeMutation.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${reGradeMutation.isPending ? 'animate-spin' : ''}`} />
                Retry Grading
              </Button>
            </CardContent>
          </Card>
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
