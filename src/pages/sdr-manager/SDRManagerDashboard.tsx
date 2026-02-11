import { useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSDRTeamMembers, useSDRTeams, useSDRDailyTranscripts } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Users, Phone, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

function SDRManagerDashboard() {
  const { user } = useAuth();
  const { data: teams = [], isLoading: teamsLoading, isError: teamsError } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [], isLoading: membersLoading, isError: membersError } = useSDRTeamMembers(myTeam?.id);
  const { data: allTranscripts = [] } = useSDRDailyTranscripts();

  const memberIds = useMemo(() => members.map((m: any) => m.user_id), [members]);

  // Filter transcripts to team members only so the count is accurate
  const teamTranscripts = useMemo(() => {
    const memberSet = new Set(memberIds);
    return allTranscripts.filter(t => memberSet.has(t.sdr_id));
  }, [allTranscripts, memberIds]);

  const { data: teamAvgScore } = useQuery({
    queryKey: ['sdr-team-avg-score', memberIds],
    queryFn: async () => {
      if (memberIds.length === 0) return null;
      const { data: grades, error } = await (supabase.from as any)('sdr_call_grades')
        .select('opener_score, engagement_score, objection_handling_score, appointment_setting_score, professionalism_score')
        .in('sdr_id', memberIds)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      if (!grades || grades.length === 0) return null;
      const avg = grades.reduce((sum: number, g: any) => {
        const scores = [g.opener_score, g.engagement_score, g.objection_handling_score, g.appointment_setting_score, g.professionalism_score].filter(Boolean);
        return sum + (scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
      }, 0) / grades.length;
      return Math.round(avg * 10) / 10;
    },
    enabled: memberIds.length > 0,
  });

  if (teamsLoading || membersLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  if (teamsError || membersError) {
    return <AppLayout><div className="text-center py-12"><p className="text-destructive">Failed to load team data. Please try refreshing.</p></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">SDR Manager Dashboard</h1>
          <p className="text-muted-foreground">{myTeam?.name || 'Team overview'}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <p className="text-2xl font-bold">{teamAvgScore ?? '—'}</p>
                  <p className="text-sm text-muted-foreground">Avg Team Score</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader><CardTitle>Team Members</CardTitle></CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No team members assigned yet</p>
            ) : (
              <div className="space-y-2">
                {members.map((m: any) => (
                  <Link key={m.id} to={`/sdr-manager/rep/${m.user_id}`} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                    <div>
                      <p className="font-medium">{m.profiles?.name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{m.profiles?.email}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="flex gap-3">
          <Link to="/sdr-manager/coaching">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center">
                <p className="font-medium">Coaching Prompts</p>
                <p className="text-sm text-muted-foreground">Customize grading criteria</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/sdr-manager/transcripts">
            <Card className="hover:bg-accent/30 transition-colors cursor-pointer">
              <CardContent className="pt-6 text-center">
                <p className="font-medium">All Transcripts</p>
                <p className="text-sm text-muted-foreground">View team transcripts</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default SDRManagerDashboard;
