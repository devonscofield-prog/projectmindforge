import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSDRDailyTranscripts, useSDRTeams, useSDRTeamMembers, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';

function SDRManagerTranscripts() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [] } = useSDRTeamMembers(myTeam?.id);
  const { data: transcripts = [], isLoading, isError } = useSDRDailyTranscripts();
  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter transcripts to team members only
  const memberIds = new Set(members.map((m: any) => m.user_id));

  const filteredTranscripts = useMemo(() => {
    let result = transcripts.filter(t => memberIds.has(t.sdr_id));

    // Rep filter
    if (repFilter !== 'all') {
      result = result.filter(t => t.sdr_id === repFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter(t => t.processing_status === statusFilter);
    }

    // Date range filter
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      result = result.filter(t => !isBefore(parseISO(t.transcript_date), from));
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      result = result.filter(t => !isAfter(parseISO(t.transcript_date), to));
    }

    return result;
  }, [transcripts, memberIds, repFilter, statusFilter, dateFrom, dateTo]);

  const totalTeamTranscripts = transcripts.filter(t => memberIds.has(t.sdr_id)).length;
  const hasFilters = repFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

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
          <h1 className="text-3xl font-bold">Team Transcripts</h1>
          <p className="text-muted-foreground">All daily transcripts from your team</p>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Team Member</Label>
                <Select value={repFilter} onValueChange={setRepFilter}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {members.map((m: any) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.profiles?.name || m.profiles?.email || 'Unknown'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
                <Button variant="ghost" size="sm" onClick={() => { setRepFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}>
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
                ? `Showing ${filteredTranscripts.length} of ${totalTeamTranscripts} transcripts`
                : `Transcripts (${totalTeamTranscripts})`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredTranscripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                {hasFilters ? 'No transcripts match your filters.' : 'No transcripts uploaded yet'}
              </p>
            ) : (
              <div className="space-y-2">
                {filteredTranscripts.map((t) => {
                  const member = members.find((m: any) => m.user_id === t.sdr_id);
                  return (
                    <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{format(new Date(t.transcript_date), 'MMM d, yyyy')}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            {member?.profiles?.name || 'Unknown'}
                          </span>
                        </div>
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
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default SDRManagerTranscripts;
