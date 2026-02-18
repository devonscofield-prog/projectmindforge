import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSDRTranscriptList, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function SDRHistory() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const statusesForFilter = statusFilter !== 'all'
    ? [statusFilter as 'pending' | 'processing' | 'completed' | 'failed' | 'partial']
    : undefined;

  const {
    data: transcripts = [],
    isLoading: transcriptsLoading,
    isError: transcriptsError,
  } = useSDRTranscriptList({
    sdrId: user?.id,
    enabled: !!user?.id,
    pollWhileProcessing: false,
  });

  const {
    data: filteredTranscripts = [],
    isLoading: filteredLoading,
    isError: filteredError,
  } = useSDRTranscriptList({
    sdrId: user?.id,
    statuses: statusesForFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    enabled: !!user?.id,
  });

  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const hasFilters = dateFrom || dateTo || statusFilter !== 'all';
  const isLoading = transcriptsLoading || filteredLoading;
  const isError = transcriptsError || filteredError;

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

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">From Date</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">To Date</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="flex h-10 w-36 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="processing">Processing</option>
                  <option value="failed">Failed</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); }}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {hasFilters
                ? `Showing ${filteredTranscripts.length} of ${transcripts.length} transcripts`
                : `All Transcripts (${transcripts.length})`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTranscripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {hasFilters ? 'No transcripts match your filters.' : 'No transcripts yet. Upload your first one from the dashboard!'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTranscripts.map((t) => (
                  <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{format(new Date(t.transcript_date), 'EEEE, MMM d, yyyy')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t.total_calls_detected} calls detected • {t.meaningful_calls_count} meaningful
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
