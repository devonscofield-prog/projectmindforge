import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRTranscriptDetail, useSDRCalls } from '@/hooks/useSDR';
import { ArrowLeft, Loader2, Phone, MessageSquare, Voicemail, PhoneOff, Users } from 'lucide-react';
import { format } from 'date-fns';
import { gradeColors } from '@/constants/training';

const callTypeIcons: Record<string, any> = {
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
  const { data: transcript, isLoading: transcriptLoading } = useSDRTranscriptDetail(transcriptId);
  const { data: calls = [], isLoading: callsLoading } = useSDRCalls(transcriptId);

  if (transcriptLoading || callsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!transcript) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Transcript not found</p>
          <Button asChild className="mt-4"><Link to="/sdr"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
        </div>
      </AppLayout>
    );
  }

  const meaningfulCalls = calls.filter(c => c.is_meaningful);
  const otherCalls = calls.filter(c => !c.is_meaningful);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild><Link to="/sdr"><ArrowLeft className="h-5 w-5" /></Link></Button>
          <div>
            <h1 className="text-2xl font-bold">{format(new Date(transcript.transcript_date), 'EEEE, MMM d, yyyy')}</h1>
            <p className="text-muted-foreground">{transcript.total_calls_detected} calls • {transcript.meaningful_calls_count} meaningful</p>
          </div>
          {transcript.processing_status === 'processing' && (
            <span className="ml-auto flex items-center gap-2 text-yellow-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Processing...
            </span>
          )}
        </div>

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
                          <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                            {grade.overall_grade}
                          </span>
                        ) : call.analysis_status === 'processing' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
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
