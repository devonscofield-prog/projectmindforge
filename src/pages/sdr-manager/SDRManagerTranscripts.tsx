import { useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSDRTeams, useSDRTeamMembers, useSDRTranscriptList, useSDRCallList, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw, X, FileText } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

const GRADE_OPTIONS = ['A+', 'A', 'B', 'C', 'D', 'F'] as const;

function SDRManagerTranscripts() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [] } = useSDRTeamMembers(myTeam?.id);
  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [meetingFilter, setMeetingFilter] = useState<string>('all');

  const memberIds = useMemo(() => members.map((m) => m.user_id), [members]);
  const sdrIdsForFilter = repFilter !== 'all' ? [repFilter] : memberIds;
  const statusesForFilter = statusFilter !== 'all' ? [statusFilter as 'pending' | 'processing' | 'completed' | 'failed' | 'partial'] : undefined;

  const {
    data: teamTranscripts = [],
    isLoading: teamTranscriptsLoading,
    isError: teamTranscriptsError,
  } = useSDRTranscriptList({
    sdrIds: memberIds,
    enabled: memberIds.length > 0,
    pollWhileProcessing: false,
  });

  const {
    data: filteredTranscripts = [],
    isLoading: filteredTranscriptsLoading,
    isError: filteredTranscriptsError,
  } = useSDRTranscriptList({
    sdrIds: sdrIdsForFilter,
    statuses: statusesForFilter,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    enabled: sdrIdsForFilter.length > 0,
  });

  // Fetch calls for grade/meeting filtering
  const { data: teamCalls = [] } = useSDRCallList({
    sdrIds: memberIds,
    onlyMeaningful: true,
    orderBy: 'recency',
    limit: 500,
    enabled: memberIds.length > 0 && (gradeFilter.length > 0 || meetingFilter !== 'all'),
  });

  // Compute transcript IDs matching grade/meeting filters
  const performanceMatchTranscriptIds = useMemo(() => {
    if (gradeFilter.length === 0 && meetingFilter === 'all') return null;
    const ids = new Set<string>();
    teamCalls.forEach(call => {
      const grade = call.sdr_call_grades?.[0];
      if (!grade) return;
      const gradeMatch = gradeFilter.length === 0 || gradeFilter.includes(grade.overall_grade);
      const meetingMatch =
        meetingFilter === 'all' ||
        (meetingFilter === 'yes' && grade.meeting_scheduled === true) ||
        (meetingFilter === 'no' && grade.meeting_scheduled !== true);
      if (gradeMatch && meetingMatch) {
        ids.add(call.daily_transcript_id);
      }
    });
    return ids;
  }, [teamCalls, gradeFilter, meetingFilter]);

  const toggleGrade = (grade: string) => {
    setGradeFilter(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
  };

  const isLoading = teamTranscriptsLoading || filteredTranscriptsLoading;
  const isError = teamTranscriptsError || filteredTranscriptsError;
  const totalTeamTranscripts = teamTranscripts.length;
  const hasFilters = repFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo || gradeFilter.length > 0 || meetingFilter !== 'all';

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
                    {members.map((m) => (
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
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Grade</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADE_OPTIONS.map(grade => (
                    <Badge
                      key={grade}
                      variant={gradeFilter.includes(grade) ? 'default' : 'outline'}
                      className="cursor-pointer select-none"
                      onClick={() => toggleGrade(grade)}
                    >
                      {grade}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Meeting Set</Label>
                <select
                  value={meetingFilter}
                  onChange={(e) => setMeetingFilter(e.target.value)}
                  className="flex h-10 w-32 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">All</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={() => { setRepFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); setGradeFilter([]); setMeetingFilter('all'); }}>
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
                ? `Filtered Transcripts`
                : `Transcripts (${totalTeamTranscripts})`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const displayTranscripts = performanceMatchTranscriptIds
                ? filteredTranscripts.filter(t => performanceMatchTranscriptIds.has(t.id))
                : filteredTranscripts;
              return displayTranscripts.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={hasFilters ? 'No transcripts match your filters' : 'No transcripts uploaded yet'}
                description={hasFilters ? 'Try adjusting your filter criteria.' : 'Transcripts will appear here once your team starts uploading.'}
              />
            ) : (
              <div className="space-y-2">
                {displayTranscripts.map((t) => {
                  const member = members.find((m) => m.user_id === t.sdr_id);
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
            );
            })()}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

export default SDRManagerTranscripts;
