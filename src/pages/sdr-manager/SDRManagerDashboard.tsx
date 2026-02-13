import { useMemo, useState, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSDRTeamMembers, useSDRTeams, useSDRDailyTranscripts, useSDRCalls, useUploadSDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Phone, TrendingUp, MessageSquare, CalendarCheck, Upload, FileUp, ClipboardPaste, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { gradeColors } from '@/constants/training';

const GRADE_ORDER = ['A+', 'A', 'B', 'C', 'D', 'F'];
const GRADE_BAR_COLORS: Record<string, string> = {
  'A+': 'bg-green-500',
  'A': 'bg-green-400',
  'B': 'bg-blue-500',
  'C': 'bg-amber-500',
  'D': 'bg-orange-500',
  'F': 'bg-red-500',
};

function SDRManagerDashboard() {
  const { user } = useAuth();
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [], isLoading: membersLoading, isError: membersError } = useSDRTeamMembers(myTeam?.id);
  const { data: allTranscripts = [] } = useSDRDailyTranscripts();

  // Upload for rep state
  const [showUpload, setShowUpload] = useState(false);
  const [selectedSdrId, setSelectedSdrId] = useState<string>('');
  const [rawText, setRawText] = useState('');
  const [transcriptDate, setTranscriptDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useUploadSDRTranscript();

  const memberIds = useMemo(() => members.map((m: any) => m.user_id), [members]);

  // Filter transcripts to team members only
  const teamTranscripts = useMemo(() => {
    const memberSet = new Set(memberIds);
    return allTranscripts.filter(t => memberSet.has(t.sdr_id));
  }, [allTranscripts, memberIds]);

  // Recent team transcripts
  const recentTeamTranscripts = teamTranscripts.slice(0, 5);

  // Team average score
  const { data: teamGradeData } = useQuery({
    queryKey: ['sdr-team-grades', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return null;
      const { data: grades, error } = await (supabase.from as any)('sdr_call_grades')
        .select('sdr_id, overall_grade, opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score, meeting_scheduled')
        .in('sdr_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!grades || grades.length === 0) return null;

      const avgScore = grades.reduce((sum: number, g: any) => {
        const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean);
        return sum + (scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
      }, 0) / grades.length;

      const meetingsSet = grades.filter((g: any) => g.meeting_scheduled === true).length;

      // Grade distribution
      const gradeDistribution: Record<string, number> = {};
      grades.forEach((g: any) => {
        gradeDistribution[g.overall_grade] = (gradeDistribution[g.overall_grade] || 0) + 1;
      });

      // Per-member stats
      const memberStats: Record<string, { count: number; totalScore: number; meetings: number; grades: Record<string, number> }> = {};
      grades.forEach((g: any) => {
        if (!memberStats[g.sdr_id]) memberStats[g.sdr_id] = { count: 0, totalScore: 0, meetings: 0, grades: {} };
        const s = memberStats[g.sdr_id];
        s.count++;
        const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean);
        s.totalScore += scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        if (g.meeting_scheduled) s.meetings++;
        s.grades[g.overall_grade] = (s.grades[g.overall_grade] || 0) + 1;
      });

      return {
        avgScore: Math.round(avgScore * 10) / 10,
        meetingsSet,
        totalGraded: grades.length,
        gradeDistribution,
        memberStats,
      };
    },
    enabled: memberIds.length > 0,
  });

  const gradeDistribution = useMemo(() => {
    if (!teamGradeData?.gradeDistribution) return [];
    const total = Object.values(teamGradeData.gradeDistribution).reduce((a, b) => a + b, 0);
    return GRADE_ORDER
      .filter(g => teamGradeData.gradeDistribution[g])
      .map(g => ({
        grade: g,
        count: teamGradeData.gradeDistribution[g],
        pct: Math.round((teamGradeData.gradeDistribution[g] / total) * 100),
      }));
  }, [teamGradeData?.gradeDistribution]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => { setRawText((ev.target?.result as string) || ''); };
    reader.readAsText(file);
  };

  const handleUploadForRep = () => {
    if (!rawText.trim() || !selectedSdrId) return;
    uploadMutation.mutate({ rawText, transcriptDate, sdrId: selectedSdrId }, {
      onSuccess: () => { setRawText(''); setFileName(null); setShowUpload(false); setSelectedSdrId(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
    });
  };

  if (teamsLoading || membersLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (teamsError || membersError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load team data. Please try refreshing.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">SDR Manager Dashboard</h1>
            <p className="text-muted-foreground">{myTeam?.name || 'Team overview'}</p>
          </div>
          <Button variant="gradient" onClick={() => setShowUpload(!showUpload)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload for Rep
          </Button>
        </div>

        {/* Top-level stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Phone className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamTranscripts.length}</p>
                  <p className="text-sm text-muted-foreground">Transcripts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamGradeData?.avgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Team Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{teamGradeData?.totalGraded ?? 0}</p>
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
                  <p className="text-2xl font-bold">{teamGradeData?.meetingsSet ?? 0}</p>
                  <p className="text-sm text-muted-foreground">Meetings Set</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload for Rep form */}
        {showUpload && (
          <Card>
            <CardHeader>
              <CardTitle>Upload Transcript for Rep</CardTitle>
              <CardDescription>Upload a daily transcript on behalf of a team member</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Team Member</Label>
                  <Select value={selectedSdrId} onValueChange={setSelectedSdrId}>
                    <SelectTrigger><SelectValue placeholder="Select SDR..." /></SelectTrigger>
                    <SelectContent>
                      {members.map((m: any) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.profiles?.name || m.profiles?.email || 'Unknown'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Transcript Date</Label>
                  <Input type="date" value={transcriptDate} onChange={(e) => setTranscriptDate(e.target.value)} />
                </div>
              </div>
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="paste" className="flex-1 gap-2"><ClipboardPaste className="h-4 w-4" /> Paste Text</TabsTrigger>
                  <TabsTrigger value="file" className="flex-1 gap-2"><FileUp className="h-4 w-4" /> Upload File</TabsTrigger>
                </TabsList>
                <TabsContent value="paste">
                  <Textarea placeholder="Paste transcript here..." value={rawText} onChange={(e) => setRawText(e.target.value)} rows={8} className="font-mono text-sm" />
                </TabsContent>
                <TabsContent value="file">
                  <div
                    className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <input ref={fileInputRef} type="file" accept=".txt,.text" className="hidden" onChange={handleFileChange} />
                    <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    {fileName ? <p className="font-medium">{fileName} ({rawText.length.toLocaleString()} chars)</p> : <p className="text-sm text-muted-foreground">Click to select .txt file</p>}
                  </div>
                </TabsContent>
              </Tabs>
              <Button onClick={handleUploadForRep} disabled={uploadMutation.isPending || !rawText.trim() || !selectedSdrId}>
                {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Process Transcript
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Two-column: Team Members + Grade Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Team Members with per-rep stats */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Team Members</CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No team members assigned yet</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: any) => {
                      const ms = teamGradeData?.memberStats?.[m.user_id];
                      const memberAvg = ms ? Math.round((ms.totalScore / ms.count) * 10) / 10 : null;
                      // Find most common grade for this member
                      const topGrade = ms ? Object.entries(ms.grades).sort((a, b) => b[1] - a[1])[0]?.[0] : null;
                      const memberTranscriptCount = teamTranscripts.filter(t => t.sdr_id === m.user_id).length;

                      return (
                        <Link key={m.id} to={`/sdr-manager/rep/${m.user_id}`} className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors">
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
                              <p className="text-muted-foreground">{ms?.count ?? 0} graded calls</p>
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
                            {topGrade && (
                              <span className={`px-3 py-1 rounded-full text-sm font-bold ${gradeColors[topGrade] || 'bg-muted'}`}>
                                {topGrade}
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
          </div>

          {/* Grade Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Team Grade Distribution</CardTitle>
              <CardDescription>Last {teamGradeData?.totalGraded ?? 0} graded calls</CardDescription>
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
        </div>

        {/* Recent Team Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Team Transcripts</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sdr-manager/transcripts" className="text-muted-foreground hover:text-foreground">
                View All <ArrowRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTeamTranscripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No transcripts uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {recentTeamTranscripts.map((t) => {
                  const member = members.find((m: any) => m.user_id === t.sdr_id);
                  return (
                    <Link key={t.id} to={`/sdr/history/${t.id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                      <div>
                        <p className="font-medium">{format(new Date(t.transcript_date), 'MMM d, yyyy')}</p>
                        <p className="text-sm text-muted-foreground">
                          {member?.profiles?.name || 'Unknown'} • {t.total_calls_detected} calls • {t.meaningful_calls_count} meaningful
                        </p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        t.processing_status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        t.processing_status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                        t.processing_status === 'failed' ? 'bg-red-500/10 text-red-500' :
                        t.processing_status === 'partial' ? 'bg-orange-500/10 text-orange-500' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {t.processing_status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/sdr-manager/coaching">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <p className="font-medium">Coaching Prompts</p>
                <p className="text-sm text-muted-foreground mt-1">Customize how calls are graded and analyzed for your team</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/sdr-manager/transcripts">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer h-full">
              <CardContent className="pt-6">
                <p className="font-medium">All Team Transcripts</p>
                <p className="text-sm text-muted-foreground mt-1">Browse and filter all transcripts uploaded by your team</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default SDRManagerDashboard;
