import { useParams, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRDailyTranscripts, useSDRCalls, useSDRStats, useRetrySDRTranscript } from '@/hooks/useSDR';
import { ArrowLeft, Loader2, Phone, MessageSquare, TrendingUp, FileText, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { gradeColors } from '@/constants/training';

function SDRManagerRepDetail() {
  const { sdrId } = useParams<{ sdrId: string }>();
  const { data: stats } = useSDRStats(sdrId);
  const { data: transcripts = [], isLoading: transcriptsLoading } = useSDRDailyTranscripts(sdrId);
  const { data: allCalls = [] } = useSDRCalls(undefined, sdrId);
  const retryMutation = useRetrySDRTranscript();

  const meaningfulCalls = allCalls.filter(c => c.is_meaningful);
  const gradedCalls = meaningfulCalls.filter(c => c.sdr_call_grades?.length);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/sdr-manager"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">SDR Performance</h1>
            <p className="text-muted-foreground">Individual rep drilldown</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalCallsToday ?? '—'}</p>
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
                  <p className="text-2xl font-bold">{stats?.meaningfulCallsToday ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Conversations Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{stats?.totalGradedCalls ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Graded Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <div>
                        <p className="font-medium">{call.prospect_name || `Call #${call.call_index}`}</p>
                        <p className="text-sm text-muted-foreground">
                          {call.prospect_company && `${call.prospect_company} • `}
                          {call.start_timestamp}
                        </p>
                      </div>
                      {grade && (
                        <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[grade.overall_grade] || 'bg-muted'}`}>
                          {grade.overall_grade}
                        </span>
                      )}
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
                      <p className="text-sm text-muted-foreground">{t.total_calls_detected} calls • {t.meaningful_calls_count} meaningful</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {(t.processing_status === 'failed' || t.processing_status === 'partial') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.preventDefault();
                            retryMutation.mutate(t.id);
                          }}
                          disabled={retryMutation.isPending}
                          className="h-7 px-2"
                        >
                          <RotateCcw className={`h-3.5 w-3.5 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                          <span className="ml-1 text-xs">Retry</span>
                        </Button>
                      )}
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        t.processing_status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                        t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        t.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {t.processing_status}
                      </span>
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
