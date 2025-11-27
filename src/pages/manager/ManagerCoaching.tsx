import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { CoachingSession, Profile } from '@/types/database';
import { format } from 'date-fns';

interface CoachingWithRep extends CoachingSession {
  rep?: Profile;
}

export default function ManagerCoaching() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<CoachingWithRep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get all coaching sessions by this manager
      const { data: coachingData } = await supabase
        .from('coaching_sessions')
        .select('*')
        .eq('manager_id', user.id)
        .order('session_date', { ascending: false });

      if (coachingData && coachingData.length > 0) {
        // Get unique rep IDs
        const repIds = [...new Set(coachingData.map((c) => c.rep_id))];

        // Fetch rep profiles
        const { data: repProfiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', repIds);

        // Combine data
        const sessionsWithReps: CoachingWithRep[] = coachingData.map((session) => ({
          ...(session as unknown as CoachingSession),
          rep: repProfiles?.find((r) => r.id === session.rep_id) as unknown as Profile,
        }));

        setSessions(sessionsWithReps);
      }

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Coaching Sessions</h1>
          <p className="text-muted-foreground mt-1">All your coaching sessions with team members</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
            <CardDescription>View and manage all coaching sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Rep</TableHead>
                    <TableHead>Focus Area</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{format(new Date(session.session_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell className="font-medium">{session.rep?.name || 'Unknown'}</TableCell>
                      <TableCell>{session.focus_area}</TableCell>
                      <TableCell>
                        {session.follow_up_date
                          ? format(new Date(session.follow_up_date), 'MMM d, yyyy')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" asChild>
                          <Link to={`/manager/rep/${session.rep_id}`}>View Rep</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No coaching sessions yet. Start coaching your team!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
