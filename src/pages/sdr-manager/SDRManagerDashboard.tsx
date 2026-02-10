import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSDRTeamMembers, useSDRTeams, useSDRDailyTranscripts } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Users, Phone, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

function SDRManagerDashboard() {
  const { user } = useAuth();
  const { data: teams = [], isLoading: teamsLoading } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [], isLoading: membersLoading } = useSDRTeamMembers(myTeam?.id);
  const { data: transcripts = [] } = useSDRDailyTranscripts();

  if (teamsLoading || membersLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
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
                  <p className="text-2xl font-bold">{transcripts.length}</p>
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
                  <p className="text-2xl font-bold">—</p>
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
