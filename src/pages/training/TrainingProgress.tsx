import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  TrendingUp,
  Target,
  Trophy,
  Clock,
  Star,
  BarChart3,
  Calendar,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';
import { ProgressTrendChart } from '@/components/training/ProgressTrendChart';
import { PersonaBreakdownCard } from '@/components/training/PersonaBreakdownCard';
import { startOfWeek, isWithinInterval, endOfWeek } from 'date-fns';

interface SessionWithGrade {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  persona_id: string | null;
  session_type: string | null;
  roleplay_personas?: { name: string } | null;
  roleplay_grades: Array<{
    overall_grade: string | null;
    scores: Json;
  }>;
}

interface ProgressStats {
  totalSessions: number;
  completedSessions: number;
  totalPracticeTime: number;
  averageScore: number;
  gradeDistribution: Record<string, number>;
  skillAverages: Record<string, number>;
  recentTrend: 'improving' | 'stable' | 'declining';
}

const skillLabels: Record<string, string> = {
  discovery: 'Discovery Skills',
  objection_handling: 'Objection Handling',
  rapport: 'Rapport Building',
  closing: 'Closing Ability',
  persona_adaptation: 'Persona Adaptation',
};

export default function TrainingProgress() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['training-progress', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select(`
          id,
          created_at,
          duration_seconds,
          persona_id,
          session_type,
          roleplay_personas (name),
          roleplay_grades (
            overall_grade,
            scores
          )
        `)
        .eq('trainee_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SessionWithGrade[];
    },
    enabled: !!user?.id,
  });

  // Calculate sessions this week and streak
  const weeklyStats = sessions ? (() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const weekEnd = endOfWeek(now);
    
    const sessionsThisWeek = sessions.filter(s => 
      isWithinInterval(new Date(s.created_at), { start: weekStart, end: weekEnd })
    ).length;

    // Calculate streak (consecutive days with sessions)
    let streak = 0;
    const sortedByDate = [...sessions].sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    if (sortedByDate.length > 0) {
      let currentDate = new Date();
      const sessionDates = new Set(sortedByDate.map(s => 
        new Date(s.created_at).toDateString()
      ));

      // Check if practiced today or yesterday
      if (sessionDates.has(currentDate.toDateString())) {
        streak = 1;
      } else {
        currentDate.setDate(currentDate.getDate() - 1);
        if (sessionDates.has(currentDate.toDateString())) {
          streak = 1;
        }
      }

      if (streak > 0) {
        currentDate.setDate(currentDate.getDate() - 1);
        while (sessionDates.has(currentDate.toDateString())) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        }
      }
    }

    return { sessionsThisWeek, streak };
  })() : { sessionsThisWeek: 0, streak: 0 };

  const stats: ProgressStats | null = sessions ? (() => {
    const gradedSessions = sessions.filter(s => s.roleplay_grades?.[0]?.scores);
    
    // Calculate grade distribution
    const gradeDistribution: Record<string, number> = {};
    gradedSessions.forEach(s => {
      const grade = s.roleplay_grades[0]?.overall_grade;
      if (grade) {
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
      }
    });

    // Calculate skill averages
    const skillTotals: Record<string, { sum: number; count: number }> = {};
    gradedSessions.forEach(s => {
      const scores = s.roleplay_grades[0]?.scores as Record<string, number> | null;
      if (scores) {
        Object.entries(scores).forEach(([key, value]) => {
          // Skip 'overall' — it's an aggregate, not an individual skill
          if (key === 'overall') return;
          if (typeof value === 'number') {
            if (!skillTotals[key]) skillTotals[key] = { sum: 0, count: 0 };
            skillTotals[key].sum += value;
            skillTotals[key].count += 1;
          }
        });
      }
    });
    
    const skillAverages: Record<string, number> = {};
    Object.entries(skillTotals).forEach(([key, { sum, count }]) => {
      skillAverages[key] = Math.round(sum / count);
    });

    // Calculate average overall score using the dedicated 'overall' field from each session
    const overallScores = gradedSessions
      .map(s => {
        const scores = s.roleplay_grades[0]?.scores as Record<string, number> | null;
        return scores?.overall;
      })
      .filter((v): v is number => typeof v === 'number');
    const averageScore = overallScores.length > 0
      ? Math.round(overallScores.reduce((a, b) => a + b, 0) / overallScores.length)
      : 0;

    // Calculate recent trend (last 5 vs previous 5)
    let recentTrend: 'improving' | 'stable' | 'declining' = 'stable';
    if (gradedSessions.length >= 6) {
      const recent5 = gradedSessions.slice(0, 5);
      const prev5 = gradedSessions.slice(5, 10);
      
      const recentAvg = recent5.reduce((sum, s) => {
        const scores = s.roleplay_grades[0]?.scores as Record<string, number> | null;
        if (!scores) return sum;
        const vals = Object.values(scores).filter(v => typeof v === 'number');
        return sum + (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
      }, 0) / recent5.length;

      const prevAvg = prev5.reduce((sum, s) => {
        const scores = s.roleplay_grades[0]?.scores as Record<string, number> | null;
        if (!scores) return sum;
        const vals = Object.values(scores).filter(v => typeof v === 'number');
        return sum + (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
      }, 0) / prev5.length;

      if (recentAvg > prevAvg + 5) recentTrend = 'improving';
      else if (recentAvg < prevAvg - 5) recentTrend = 'declining';
    }

    return {
      totalSessions: sessions.length,
      completedSessions: gradedSessions.length,
      totalPracticeTime: sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0),
      averageScore,
      gradeDistribution,
      skillAverages,
      recentTrend,
    };
  })() : null;

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-blue-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-red-500';
  };

  const _getProgressColor = (score: number) => {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  }; void _getProgressColor;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background">
          <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Skeleton className="h-8 w-48 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" onClick={() => navigate('/training')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-6 w-6" />
                My Progress
              </h1>
              <p className="text-muted-foreground">Track your sales training performance</p>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Sessions</p>
                    <p className="text-3xl font-bold">{stats?.totalSessions ?? 0}</p>
                  </div>
                  <Target className="h-10 w-10 text-primary/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Graded</p>
                    <p className="text-3xl font-bold">{stats?.completedSessions ?? 0}</p>
                  </div>
                  <Trophy className="h-10 w-10 text-green-500/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Practice Time</p>
                    <p className="text-3xl font-bold">{stats ? formatTime(stats.totalPracticeTime) : '0m'}</p>
                  </div>
                  <Clock className="h-10 w-10 text-blue-500/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-500/5 to-amber-500/10 border-amber-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Score</p>
                    <p className={cn("text-3xl font-bold", stats ? getScoreColor(stats.averageScore) : '')}>
                      {stats?.averageScore ?? 0}
                    </p>
                  </div>
                  <Star className="h-10 w-10 text-amber-500/60" />
                </div>
              </CardContent>
            </Card>

            {/* Weekly Stats */}
            <Card className="bg-gradient-to-br from-orange-500/5 to-orange-500/10 border-orange-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-3xl font-bold">{weeklyStats.sessionsThisWeek}</p>
                  </div>
                  <Flame className="h-10 w-10 text-orange-500/60" />
                </div>
                {weeklyStats.streak > 0 && (
                  <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    {weeklyStats.streak} day streak!
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Score Trend Chart */}
          {sessions && sessions.length >= 2 && (
            <ProgressTrendChart sessions={sessions} />
          )}

          {/* Persona & Type Breakdown */}
          {sessions && sessions.length > 0 && (
            <PersonaBreakdownCard sessions={sessions} />
          )}

          {/* Trend Indicator */}
          {stats?.recentTrend && stats.completedSessions >= 6 && (
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center gap-3">
                  <TrendingUp
                    className={cn(
                      "h-5 w-5",
                      stats.recentTrend === 'improving' && 'text-green-500',
                      stats.recentTrend === 'stable' && 'text-blue-500',
                      stats.recentTrend === 'declining' && 'text-red-500'
                    )}
                  />
                  <span className="font-medium">
                    {stats.recentTrend === 'improving' && "You're improving! Your recent scores are higher than before."}
                    {stats.recentTrend === 'stable' && "Consistent performance. Keep practicing to level up!"}
                    {stats.recentTrend === 'declining' && "Scores dipping. Consider focused practice on weak areas."}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skill Breakdown */}
          {stats && Object.keys(stats.skillAverages).length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Skill Breakdown
                </CardTitle>
                <CardDescription>Your average scores across skill categories</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(stats.skillAverages).map(([key, score]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{skillLabels[key] || key}</span>
                      <span className={cn("text-sm font-bold", getScoreColor(score))}>{score}</span>
                    </div>
                    <Progress value={score} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Grade Distribution */}
          {stats && Object.keys(stats.gradeDistribution).length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5" />
                  Grade Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 flex-wrap">
                  {['A+', 'A', 'B', 'C', 'D', 'F'].map((grade) => {
                    const count = stats.gradeDistribution[grade] || 0;
                    if (count === 0) return null;
                    return (
                      <Badge key={grade} variant="secondary" className="text-base px-4 py-2">
                        {grade}: {count}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {(!stats || stats.totalSessions === 0) && (
            <Card className="p-8 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Yet</h3>
              <p className="text-muted-foreground mb-4">
                Complete some practice sessions to see your progress here.
              </p>
              <Button onClick={() => navigate('/training')}>Start Practicing</Button>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
