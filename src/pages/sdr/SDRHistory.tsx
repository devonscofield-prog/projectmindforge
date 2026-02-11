import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRDailyTranscripts, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function SDRHistory() {
  const { user } = useAuth();
  const { data: transcripts = [], isLoading, isError } = useSDRDailyTranscripts(user?.id);
  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (isError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load transcripts. Please try refreshing.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transcript History</h1>
          <p className="text-muted-foreground">All your uploaded daily transcripts</p>
        </div>

        <Card>
          <CardHeader><CardTitle>All Transcripts ({transcripts.length})</CardTitle></CardHeader>
          <CardContent>
            {transcripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transcripts yet. Upload your first one from the dashboard!</p>
            ) : (
              <div className="space-y-2">
                {transcripts.map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}</p>
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

export default SDRHistory;
