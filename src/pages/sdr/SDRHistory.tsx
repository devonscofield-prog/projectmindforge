import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSDRTranscriptList, useSDRCallList, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw, X, FileText, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const GRADE_OPTIONS = ['A+', 'A', 'B', 'C', 'D', 'F'] as const;

function SDRHistory() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
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

  // Fetch calls for grade filtering
  const { data: allCalls = [] } = useSDRCallList({
    sdrId: user?.id,
    onlyMeaningful: true,
    orderBy: 'recency',
    limit: 500,
    enabled: !!user?.id && gradeFilter.length > 0,
  });

  // Compute transcript IDs that contain calls matching the grade filter
  const gradeMatchTranscriptIds = useMemo(() => {
    if (gradeFilter.length === 0) return null;
    const ids = new Set<string>();
    allCalls.forEach(call => {
      const grade = call.sdr_call_grades?.[0]?.overall_grade;
      if (grade && gradeFilter.includes(grade)) {
        ids.add(call.daily_transcript_id);
      }
    });
    return ids;
  }, [allCalls, gradeFilter]);

  const toggleGrade = (grade: string) => {
    setGradeFilter(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const hasFilters = dateFrom || dateTo || statusFilter !== 'all' || gradeFilter.length > 0;
  const isLoading = transcriptsLoading || filteredLoading;
  const isError = transcriptsError || filteredError;

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (isError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load transcript history. Please try refreshing.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <main className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Transcript History</h1>
          <p className="text-muted-foreground">All your uploaded daily transcripts</p>
        </div>

        {/* Filters */}
        <section aria-label="Transcript filters">
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Grade</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADE_OPTIONS.map(grade => (
                    <Badge
                      key={grade}
                      variant={gradeFilter.includes(grade) ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      role="button"
                      aria-pressed={gradeFilter.includes(grade)}
                      onClick={() => toggleGrade(grade)}
                    >
                      {grade}
                    </Badge>
                  ))}
                </div>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setStatusFilter('all'); setGradeFilter([]); }}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>
              {hasFilters
                ? `Filtered Transcripts`
                : `All Transcripts (${transcripts.length})`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const displayTranscripts = gradeMatchTranscriptIds
                ? filteredTranscripts.filter(t => gradeMatchTranscriptIds.has(t.id))
                : filteredTranscripts;
              return displayTranscripts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={hasFilters ? 'No transcripts match your filters' : 'No transcripts yet'}
                description={hasFilters ? 'Try adjusting your filter criteria.' : 'Upload your first transcript from the dashboard to get started.'}
              />
            ) : (
              <div className="space-y-2">
                {displayTranscripts.map((t) => (
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
                      {(t.processing_status === 'failed' || t.processing_status === 'partial') && t.processing_error ? (
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
            );
            })()}
          </CardContent>
        </Card>
      </main>
    </AppLayout>
  );
}

export default SDRHistory;
