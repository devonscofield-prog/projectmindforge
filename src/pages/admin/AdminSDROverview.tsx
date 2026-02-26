import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useSDRTeams,
  useSDRTeamMembers,
  useSDRDailyTranscripts,
  useRetrySDRTranscript,
} from '@/hooks/useSDR';
import type { SDRTeamMemberWithProfile } from '@/hooks/sdr/types';
import { useQuery } from '@tanstack/react-query';
import { useProfilesByIds } from '@/hooks/useProfiles';
import { supabase } from '@/integrations/supabase/client';

/** Shape returned by the admin grades query (only the selected columns). */
interface SdrCallGradeRow {
  sdr_id: string;
  overall_grade: string;
  opener_score: number | null;
  engagement_score: number | null;
  objection_handling_score: number | null;
  appointment_setting_score: number | null;
  professionalism_score: number | null;
  meeting_scheduled: boolean | null;
}
import {
  Loader2, Users, TrendingUp, MessageSquare,
  CalendarCheck, RotateCcw, X, Headphones,
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay, isBefore, isAfter } from 'date-fns';
import { gradeColors } from '@/constants/training';
import { withPageErrorBoundary } from '@/components/ui/page-error-boundary';
import { SDRTeamManagement } from '@/components/admin/sdr/SDRTeamManagement';

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function AdminSDROverview() {
  const { data: teams = [], isLoading: teamsLoading } = useSDRTeams();
  const { data: allMembers = [], isLoading: membersLoading } = useSDRTeamMembers();
  const { data: transcripts = [], isLoading: transcriptsLoading } = useSDRDailyTranscripts();
  const retryMutation = useRetrySDRTranscript();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  // Filters
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Build member lookup
  const memberMap = useMemo(() => {
    const map: Record<string, { name: string; email: string; teamId: string }> = {};
    allMembers.forEach((m: SDRTeamMemberWithProfile) => {
      map[m.user_id] = {
        name: m.profiles?.name || 'Unknown',
        email: m.profiles?.email || '',
        teamId: m.team_id,
      };
    });
    return map;
  }, [allMembers]);

  const allMemberIds = useMemo(() => new Set(Object.keys(memberMap)), [memberMap]);

  // Collect unique SDR IDs from transcripts that aren't in memberMap
  const unassignedSdrIds = useMemo(() => {
    const ids: string[] = [];
    transcripts.forEach(t => {
      if (!allMemberIds.has(t.sdr_id) && !ids.includes(t.sdr_id)) {
        ids.push(t.sdr_id);
      }
    });
    return ids;
  }, [transcripts, allMemberIds]);

  // Fetch profiles for unassigned SDRs
  const { data: unassignedProfiles = [] } = useProfilesByIds(unassignedSdrIds);
  const unassignedProfileMap = useMemo(() => {
    const map: Record<string, string> = {};
    unassignedProfiles.forEach(p => { map[p.id] = p.name; });
    return map;
  }, [unassignedProfiles]);

  // Helper to get SDR name from either memberMap or unassigned profiles
  const getSdrName = (sdrId: string) => {
    return memberMap[sdrId]?.name || unassignedProfileMap[sdrId] || 'Unknown SDR';
  };

  // Team lookup
  const teamMap = useMemo(() => {
    const map: Record<string, string> = {};
    teams.forEach(t => { map[t.id] = t.name; });
    return map;
  }, [teams]);

  // Members filtered by team selection
  const filteredMemberIds = useMemo(() => {
    if (teamFilter === 'all') return allMemberIds;
    const ids = new Set<string>();
    allMembers.forEach((m: SDRTeamMemberWithProfile) => {
      if (m.team_id === teamFilter) ids.add(m.user_id);
    });
    return ids;
  }, [teamFilter, allMembers, allMemberIds]);

  // All grades for stats
  const { data: allGrades } = useQuery({
    queryKey: ['admin-sdr-all-grades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sdr_call_grades')
        .select('sdr_id, overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, meeting_scheduled')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SdrCallGradeRow[];
    },
  });

  // Compute org-wide stats
  const orgStats = useMemo(() => {
    if (!allGrades || allGrades.length === 0) return null;
    const grades = teamFilter === 'all'
      ? allGrades
      : allGrades.filter((g: SdrCallGradeRow) => filteredMemberIds.has(g.sdr_id));

    if (grades.length === 0) return null;

    const avgScore = grades.reduce((sum: number, g: SdrCallGradeRow) => {
      const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter((s): s is number => s !== null);
      return sum + (scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0);
    }, 0) / grades.length;

    const meetingsSet = grades.filter((g: SdrCallGradeRow) => g.meeting_scheduled === true).length;

    const gradeDistribution: Record<string, number> = {};
    grades.forEach((g: SdrCallGradeRow) => {
      gradeDistribution[g.overall_grade] = (gradeDistribution[g.overall_grade] || 0) + 1;
    });

    // Per-member stats
    const memberStats: Record<string, { count: number; totalScore: number; meetings: number; topGrade: string | null }> = {};
    grades.forEach((g: SdrCallGradeRow) => {
      if (!memberStats[g.sdr_id]) memberStats[g.sdr_id] = { count: 0, totalScore: 0, meetings: 0, topGrade: null };
      const s = memberStats[g.sdr_id];
      s.count++;
      const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean);
      s.totalScore += scores.length ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0;
      if (g.meeting_scheduled) s.meetings++;
    });
    // Compute top grade per member
    const memberGradeCounts: Record<string, Record<string, number>> = {};
    grades.forEach((g: SdrCallGradeRow) => {
      if (!memberGradeCounts[g.sdr_id]) memberGradeCounts[g.sdr_id] = {};
      memberGradeCounts[g.sdr_id][g.overall_grade] = (memberGradeCounts[g.sdr_id][g.overall_grade] || 0) + 1;
    });
    Object.entries(memberGradeCounts).forEach(([sdrId, gc]) => {
      if (memberStats[sdrId]) {
        memberStats[sdrId].topGrade = Object.entries(gc).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      }
    });

    return { avgScore: Math.round(avgScore * 10) / 10, meetingsSet, totalGraded: grades.length, gradeDistribution, memberStats };
  }, [allGrades, teamFilter, filteredMemberIds]);

  // Grade distribution for chart
  const gradeDistribution = useMemo(() => {
    if (!orgStats?.gradeDistribution) return [];
    const total = Object.values(orgStats.gradeDistribution).reduce((a, b) => a + b, 0);
    return GRADE_ORDER
      .filter(g => orgStats.gradeDistribution[g])
      .map(g => ({
        grade: g,
        count: orgStats.gradeDistribution[g],
        pct: Math.round((orgStats.gradeDistribution[g] / total) * 100),
      }));
  }, [orgStats?.gradeDistribution]);

  // Filtered transcripts — admins see all transcripts, no team-membership gate
  const filteredTranscripts = useMemo(() => {
    let result = [...transcripts];

    if (teamFilter !== 'all') {
      result = result.filter(t => filteredMemberIds.has(t.sdr_id));
    }
    if (repFilter !== 'all') {
      result = result.filter(t => t.sdr_id === repFilter);
    }
    if (statusFilter !== 'all') {
      result = result.filter(t => t.processing_status === statusFilter);
    }
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom));
      result = result.filter(t => !isBefore(parseISO(t.transcript_date), from));
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo));
      result = result.filter(t => !isAfter(parseISO(t.transcript_date), to));
    }
    return result;
  }, [transcripts, filteredMemberIds, teamFilter, repFilter, statusFilter, dateFrom, dateTo]);

  const hasFilters = teamFilter !== 'all' || repFilter !== 'all' || statusFilter !== 'all' || dateFrom || dateTo;

  // Members visible in current team filter + unassigned SDRs for the dropdown
  const visibleMembers = useMemo(() => {
    const members = allMembers.filter((m: SDRTeamMemberWithProfile) => teamFilter === 'all' || m.team_id === teamFilter);
    // When showing all teams, also include unassigned SDRs in the dropdown
    if (teamFilter === 'all') {
      const unassignedEntries = unassignedSdrIds.map(id => ({
        user_id: id,
        profiles: { name: unassignedProfileMap[id] || 'Unknown SDR', email: '' },
        team_id: null,
      }));
      return [...members, ...unassignedEntries];
    }
    return members;
  }, [allMembers, teamFilter, unassignedSdrIds, unassignedProfileMap]);

  if (teamsLoading || membersLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Headphones className="h-7 w-7 text-primary" />
              SDR Oversight
            </h1>
            <p className="text-muted-foreground">All SDR teams, transcripts, and call results across the organization</p>
          </div>
          <Badge variant="outline">Admin View</Badge>
        </div>

        {/* Org-wide stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teams.length}</p>
                  <p className="text-sm text-muted-foreground">SDR Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{allMemberIds.size}</p>
                  <p className="text-sm text-muted-foreground">Total SDRs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{orgStats?.avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{orgStats?.totalGraded ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Graded Calls</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CalendarCheck className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{orgStats?.meetingsSet ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="teams" className="space-y-4">
          <TabsList>
            <TabsTrigger value="teams">Teams & SDRs</TabsTrigger>
            <TabsTrigger value="transcripts">All Transcripts</TabsTrigger>
            <TabsTrigger value="grades">Grade Distribution</TabsTrigger>
            <TabsTrigger value="manage">Manage Teams</TabsTrigger>
          </TabsList>

          {/* Teams & SDRs Tab */}
          <TabsContent value="teams" className="space-y-4">
            {/* Team filter */}
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Filter by Team</Label>
                <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setRepFilter('all'); }}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {teams.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  No SDR teams have been created yet.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {(teamFilter === 'all' ? teams : teams.filter(t => t.id === teamFilter)).map(team => {
                  const teamMembers = allMembers.filter((m: SDRTeamMemberWithProfile) => m.team_id === team.id);
                  const teamTranscriptCount = transcripts.filter(t => teamMembers.some((m: SDRTeamMemberWithProfile) => m.user_id === t.sdr_id)).length;

                  return (
                    <Card key={team.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-primary" />
                          {team.name}
                        </CardTitle>
                        <CardDescription>{teamMembers.length} members • {teamTranscriptCount} transcripts</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {teamMembers.length === 0 ? (
                          <p className="text-muted-foreground text-sm">No members assigned</p>
                        ) : (
                          <div className="space-y-2">
                            {teamMembers.map((m: SDRTeamMemberWithProfile) => {
                              const ms = orgStats?.memberStats?.[m.user_id];
                              const memberAvg = ms ? Math.round((ms.totalScore / ms.count) * 10) / 10 : null;
                              const memberTranscriptCount = transcripts.filter(t => t.sdr_id === m.user_id).length;

                              return (
                                <Link
                                  key={m.id}
                                  to={`/sdr-manager/rep/${m.user_id}`}
                                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                      <span className="text-sm font-semibold text-primary">
                                        {(m.profiles?.name || '?').charAt(0).toUpperCase()}
                                      </span>
                                    </div>
                                    <div>
                                      <p className="font-medium">{m.profiles?.name || 'Unknown'}</p>
                                      <p className="text-sm text-muted-foreground">{m.profiles?.email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <div className="text-right hidden md:block">
                                      <p className="text-muted-foreground">{memberTranscriptCount} transcripts</p>
                                      <p className="text-muted-foreground">{ms?.count ?? 0} graded</p>
                                    </div>
                                    {ms?.meetings ? (
                                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                                        {ms.meetings} mtg{ms.meetings > 1 ? 's' : ''}
                                      </span>
                                    ) : null}
                                    {memberAvg !== null && (
                                      <div className="text-right">
                                        <p className="font-bold">{memberAvg}</p>
                                        <p className="text-xs text-muted-foreground">avg</p>
                                      </div>
                                    )}
                                    {ms?.topGrade && (
                                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[ms.topGrade] || 'bg-muted'}`}>
                                        {ms.topGrade}
                                      </span>
                                    )}
                                  </div>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* All Transcripts Tab */}
          <TabsContent value="transcripts" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Team</Label>
                    <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setRepFilter('all'); }}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {teams.map(t => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">SDR</Label>
                    <Select value={repFilter} onValueChange={setRepFilter}>
                      <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All SDRs</SelectItem>
                        {visibleMembers.map((m: SDRTeamMemberWithProfile) => (
                          <SelectItem key={m.user_id} value={m.user_id}>
                            {m.profiles?.name || m.profiles?.email || 'Unknown'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">To</Label>
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
                    <Button variant="ghost" size="sm" onClick={() => { setTeamFilter('all'); setRepFilter('all'); setStatusFilter('all'); setDateFrom(''); setDateTo(''); }}>
                      <X className="h-4 w-4 mr-1" /> Clear
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
                {transcriptsLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                ) : filteredTranscripts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {hasFilters ? 'No transcripts match your filters.' : 'No SDR transcripts uploaded yet.'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredTranscripts.map((t) => {
                      const member = memberMap[t.sdr_id];
                      const teamName = member ? teamMap[member.teamId] : null;
                      return (
                        <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{format(new Date(t.transcript_date), 'MMM d, yyyy')}</p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                {getSdrName(t.sdr_id)}
                              </span>
                              {teamName ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {teamName}
                                </span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600">
                                  Unassigned
                                </span>
                              )}
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
          </TabsContent>

          {/* Grade Distribution Tab */}
          <TabsContent value="grades" className="space-y-4">
            <div className="flex items-end gap-4 mb-4">
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Filter by Team</Label>
                <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setRepFilter('all'); }}>
                  <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Overall Grade Distribution</CardTitle>
                  <CardDescription>
                    {teamFilter === 'all' ? 'All SDR teams' : teamMap[teamFilter] || 'Selected team'} • {orgStats?.totalGraded ?? 0} graded calls
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {gradeDistribution.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8 text-sm">No grades yet</p>
                  ) : (
                    <div className="space-y-3">
                      {gradeDistribution.map(({ grade, count, pct }) => (
                        <div key={grade} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{grade}</span>
                            <span className="text-muted-foreground">{count} ({pct}%)</span>
                          </div>
                          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${GRADE_BAR_COLORS[grade] || 'bg-muted-foreground'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                  <CardDescription>SDRs ranked by average score</CardDescription>
                </CardHeader>
                <CardContent>
                  {orgStats?.memberStats ? (
                    <div className="space-y-3">
                      {Object.entries(orgStats.memberStats)
                        .filter(([id]) => teamFilter === 'all' || filteredMemberIds.has(id))
                        .map(([id, stats]) => ({
                          id,
                          name: memberMap[id]?.name || 'Unknown',
                          team: teamMap[memberMap[id]?.teamId] || '',
                          avg: Math.round((stats.totalScore / stats.count) * 10) / 10,
                          count: stats.count,
                          meetings: stats.meetings,
                          topGrade: stats.topGrade,
                        }))
                        .sort((a, b) => b.avg - a.avg)
                        .slice(0, 10)
                        .map((rep, i) => (
                          <Link
                            key={rep.id}
                            to={`/sdr-manager/rep/${rep.id}`}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-lg font-bold text-muted-foreground w-6 text-center">
                                {i + 1}
                              </span>
                              <div>
                                <p className="font-medium">{rep.name}</p>
                                <p className="text-xs text-muted-foreground">{rep.team} • {rep.count} calls</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {rep.meetings > 0 && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-600">
                                  {rep.meetings} mtg{rep.meetings > 1 ? 's' : ''}
                                </span>
                              )}
                              <span className="font-bold">{rep.avg}</span>
                              {rep.topGrade && (
                                <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${gradeColors[rep.topGrade] || 'bg-muted'}`}>
                                  {rep.topGrade}
                                </span>
                              )}
                            </div>
                          </Link>
                        ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-8 text-sm">No graded calls yet</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Manage Teams Tab */}
          <TabsContent value="manage">
            <SDRTeamManagement />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

export default withPageErrorBoundary(AdminSDROverview, 'SDR Oversight');
