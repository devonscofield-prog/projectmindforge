import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Team, Profile } from '@/types/database';
import { format } from 'date-fns';

interface TeamWithManager extends Team {
  manager?: Profile;
  memberCount: number;
}

export default function AdminTeams() {
  const [teams, setTeams] = useState<TeamWithManager[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch all teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('*')
        .order('name');

      if (!teamsData) {
        setLoading(false);
        return;
      }

      // Get manager IDs
      const managerIds = teamsData
        .filter((t) => t.manager_id)
        .map((t) => t.manager_id as string);

      // Fetch manager profiles
      let managers: Profile[] = [];
      if (managerIds.length > 0) {
        const { data: managerData } = await supabase
          .from('profiles')
          .select('*')
          .in('id', managerIds);
        managers = (managerData || []) as unknown as Profile[];
      }

      // Fetch member counts
      const { data: profiles } = await supabase
        .from('profiles')
        .select('team_id')
        .not('team_id', 'is', null);

      const memberCounts: Record<string, number> = {};
      profiles?.forEach((p) => {
        if (p.team_id) {
          memberCounts[p.team_id] = (memberCounts[p.team_id] || 0) + 1;
        }
      });

      // Combine data
      const teamsWithManagers: TeamWithManager[] = teamsData.map((team) => ({
        ...(team as unknown as Team),
        manager: managers.find((m) => m.id === team.manager_id),
        memberCount: memberCounts[team.id] || 0,
      }));

      setTeams(teamsWithManagers);
      setLoading(false);
    };

    fetchData();
  }, []);

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
          <h1 className="text-3xl font-bold">Teams</h1>
          <p className="text-muted-foreground mt-1">View and manage all sales teams</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Teams</CardTitle>
            <CardDescription>Overview of teams and their managers</CardDescription>
          </CardHeader>
          <CardContent>
            {teams.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Manager</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teams.map((team) => (
                    <TableRow key={team.id}>
                      <TableCell className="font-medium">{team.name}</TableCell>
                      <TableCell>{team.manager?.name || 'No manager assigned'}</TableCell>
                      <TableCell>{team.memberCount}</TableCell>
                      <TableCell>{format(new Date(team.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No teams created yet.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
