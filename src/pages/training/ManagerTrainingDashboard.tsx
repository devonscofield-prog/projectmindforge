import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  Users, 
  TrendingUp, 
  Clock, 
  Award,
  ChevronRight,
  GraduationCap,
  BarChart3,
  Target
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface TraineeStats {
  trainee_id: string;
  trainee_name: string;
  trainee_email: string;
  total_sessions: number;
  completed_sessions: number;
  avg_grade: number | null;
  latest_grade: string | null;
  latest_session_date: string | null;
  total_practice_minutes: number;
}

interface RecentSession {
  id: string;
  trainee_id: string;
  trainee_name: string;
  persona_name: string;
  session_type: string;
  status: string;
  duration_seconds: number | null;
  created_at: string;
  overall_grade: string | null;
}

function gradeToColor(grade: string | null): string {
  if (!grade) return 'text-muted-foreground';
  if (grade.startsWith('A')) return 'text-green-600';
  if (grade === 'B') return 'text-blue-600';
  if (grade === 'C') return 'text-amber-600';
  return 'text-red-600';
}

function gradeToScore(grade: string | null): number | null {
  if (!grade) return null;
  const map: Record<string, number> = { 'A+': 98, 'A': 90, 'B': 77, 'C': 62, 'D': 47, 'F': 30 };
  return map[grade] || null;
}

export default function ManagerTrainingDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch team trainees and their stats
  const { data: traineeStats, isLoading: statsLoading } = useQuery({
    queryKey: ['manager-trainee-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Get team members (trainees and reps who have done roleplay)
      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, name, email, team_id')
        .eq('team_id', (
          await supabase
            .from('teams')
            .select('id')
            .eq('manager_id', user.id)
            .single()
        ).data?.id || '');

      if (!teamMembers?.length) return [];

      const traineeIds = teamMembers.map(m => m.id);

      // Get session stats per trainee
      const { data: sessions } = await supabase
        .from('roleplay_sessions')
        .select(`
          trainee_id,
          status,
          duration_seconds,
          created_at,
          roleplay_grades (overall_grade, scores)
        `)
        .in('trainee_id', traineeIds);

      // Aggregate stats
      const statsMap = new Map<string, TraineeStats>();
      
      teamMembers.forEach(member => {
        statsMap.set(member.id, {
          trainee_id: member.id,
          trainee_name: member.name,
          trainee_email: member.email,
          total_sessions: 0,
          completed_sessions: 0,
          avg_grade: null,
          latest_grade: null,
          latest_session_date: null,
          total_practice_minutes: 0,
        });
      });

      sessions?.forEach(session => {
        const stats = statsMap.get(session.trainee_id);
        if (!stats) return;

        stats.total_sessions++;
        if (session.status === 'completed') {
          stats.completed_sessions++;
        }
        stats.total_practice_minutes += Math.round((session.duration_seconds || 0) / 60);
        
        const grades = session.roleplay_grades as Array<{ overall_grade: string; scores: { overall: number } }>;
        if (grades?.length > 0 && session.created_at) {
          const grade = grades[0];
          if (!stats.latest_session_date || new Date(session.created_at) > new Date(stats.latest_session_date)) {
            stats.latest_session_date = session.created_at;
            stats.latest_grade = grade.overall_grade;
          }
        }
      });

      return Array.from(statsMap.values()).filter(s => s.total_sessions > 0);
    },
    enabled: !!user?.id,
  });

  // Fetch recent sessions across all trainees
  const { data: recentSessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['manager-recent-sessions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('manager_id', user.id)
        .single();

      if (!team) return [];

      const { data: teamMembers } = await supabase
        .from('profiles')
        .select('id, name')
        .eq('team_id', team.id);

      if (!teamMembers?.length) return [];

      const traineeIds = teamMembers.map(m => m.id);
      const nameMap = new Map(teamMembers.map(m => [m.id, m.name]));

      const { data: sessions } = await supabase
        .from('roleplay_sessions')
        .select(`
          id,
          trainee_id,
          session_type,
          status,
          duration_seconds,
          created_at,
          roleplay_personas (name),
          roleplay_grades (overall_grade)
        `)
        .in('trainee_id', traineeIds)
        .order('created_at', { ascending: false })
        .limit(20);

      return (sessions || [])
        .filter(s => s.created_at)
        .map(s => ({
          id: s.id,
          trainee_id: s.trainee_id,
          trainee_name: nameMap.get(s.trainee_id) || 'Unknown',
          persona_name: (s.roleplay_personas as { name: string })?.name || 'Unknown',
          session_type: s.session_type || 'discovery',
          status: s.status || 'unknown',
          duration_seconds: s.duration_seconds,
          created_at: s.created_at!,
          overall_grade: (s.roleplay_grades as Array<{ overall_grade: string }>)?.[0]?.overall_grade || null,
        }));
    },
    enabled: !!user?.id,
  });

  // Calculate team summary stats
  const teamSummary = {
    totalTrainees: traineeStats?.length || 0,
    totalSessions: traineeStats?.reduce((sum, t) => sum + t.total_sessions, 0) || 0,
    avgPracticeMinutes: traineeStats?.length 
      ? Math.round(traineeStats.reduce((sum, t) => sum + t.total_practice_minutes, 0) / traineeStats.length)
      : 0,
    completionRate: traineeStats?.length
      ? Math.round((traineeStats.filter(t => t.completed_sessions > 0).length / traineeStats.length) * 100)
      : 0,
  };

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" />
              Training Center
            </h1>
            <p className="text-muted-foreground">Monitor team roleplay practice and progress</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamSummary.totalTrainees}</p>
                  <p className="text-sm text-muted-foreground">Active Trainees</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <BarChart3 className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamSummary.totalSessions}</p>
                  <p className="text-sm text-muted-foreground">Total Sessions</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamSummary.avgPracticeMinutes}</p>
                  <p className="text-sm text-muted-foreground">Avg. Practice (min)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Target className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teamSummary.completionRate}%</p>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Trainee Overview</TabsTrigger>
            <TabsTrigger value="recent">Recent Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Team Performance</CardTitle>
                <CardDescription>Individual trainee progress and grades</CardDescription>
              </CardHeader>
              <CardContent>
                {!traineeStats?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <GraduationCap className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No training sessions yet</p>
                    <p className="text-sm">Team members will appear here once they start practicing</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead className="text-center">Sessions</TableHead>
                        <TableHead className="text-center">Practice Time</TableHead>
                        <TableHead className="text-center">Latest Grade</TableHead>
                        <TableHead className="text-center">Last Active</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {traineeStats.map((trainee) => (
                        <TableRow key={trainee.trainee_id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{trainee.trainee_name}</p>
                              <p className="text-xs text-muted-foreground">{trainee.trainee_email}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">
                              {trainee.completed_sessions}/{trainee.total_sessions}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {trainee.total_practice_minutes} min
                          </TableCell>
                          <TableCell className="text-center">
                            {trainee.latest_grade ? (
                              <span className={cn("font-bold text-lg", gradeToColor(trainee.latest_grade))}>
                                {trainee.latest_grade}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {trainee.latest_session_date 
                              ? formatDistanceToNow(new Date(trainee.latest_session_date), { addSuffix: true })
                              : '—'}
                          </TableCell>
                          <TableCell>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => navigate(`/training/history?trainee=${trainee.trainee_id}`)}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recent">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sessions</CardTitle>
                <CardDescription>Latest practice sessions across your team</CardDescription>
              </CardHeader>
              <CardContent>
                {sessionsLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : !recentSessions?.length ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No sessions recorded yet</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Trainee</TableHead>
                        <TableHead>Persona</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-center">Duration</TableHead>
                        <TableHead className="text-center">Grade</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentSessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">{session.trainee_name}</TableCell>
                          <TableCell>{session.persona_name}</TableCell>
                          <TableCell className="capitalize">{session.session_type.replace('_', ' ')}</TableCell>
                          <TableCell className="text-center">
                            {session.duration_seconds 
                              ? `${Math.round(session.duration_seconds / 60)}m`
                              : '—'}
                          </TableCell>
                          <TableCell className="text-center">
                            {session.overall_grade ? (
                              <span className={cn("font-bold", gradeToColor(session.overall_grade))}>
                                {session.overall_grade}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge 
                              variant={session.status === 'completed' ? 'default' : 'secondary'}
                              className={cn(
                                session.status === 'abandoned' && 'bg-red-100 text-red-700'
                              )}
                            >
                              {session.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(session.created_at), 'MMM d, h:mm a')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
