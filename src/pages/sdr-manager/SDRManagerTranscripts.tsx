import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSDRDailyTranscripts, useSDRTeams, useSDRTeamMembers, useRetrySDRTranscript } from '@/hooks/useSDR';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';

function SDRManagerTranscripts() {
  const { user } = useAuth();
  const { data: teams = [] } = useSDRTeams();
  const myTeam = teams.find(t => t.manager_id === user?.id);
  const { data: members = [] } = useSDRTeamMembers(myTeam?.id);
  const { data: transcripts = [], isLoading } = useSDRDailyTranscripts();

  // Filter transcripts to team members only
  const memberIds = new Set(members.map((m: any) => m.user_id));
  const teamTranscripts = transcripts.filter(t => memberIds.has(t.sdr_id));

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Team Transcripts</h1>
          <p className="text-muted-foreground">All daily transcripts from your team</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Transcripts ({teamTranscripts.length})</CardTitle></CardHeader>
          <CardContent>
            {teamTranscripts.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No transcripts uploaded yet</p>
            ) : (
              <div className="space-y-2">
                {teamTranscripts.map((t) => {
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
      </div>
    </AppLayout>
  );
}

export default SDRManagerTranscripts;
