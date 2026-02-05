import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mic,
  Users,
  Trophy,
  Clock,
  Target,
  Sparkles,
  ArrowRight,
  History,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AppLayout } from '@/components/layout/AppLayout';
import type { PersonaBase } from '@/types/persona';

interface SessionStats {
  total_sessions: number;
  completed_sessions: number;
  avg_duration_seconds: number;
}

const difficultyColors: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-600 border-green-500/20',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  hard: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const discProfileColors: Record<string, string> = {
  D: 'bg-red-500',
  I: 'bg-yellow-500',
  S: 'bg-green-500',
  C: 'bg-blue-500',
};

export default function TrainingDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

  // Fetch available personas
  const { data: personas, isLoading: personasLoading } = useQuery({
    queryKey: ['roleplay-personas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('roleplay_personas')
        .select('*')
        .eq('is_active', true)
        .order('difficulty_level', { ascending: true });
      
      if (error) throw error;
      return data as PersonaBase[];
    },
  });

  // Fetch user's session stats
  const { data: stats } = useQuery({
    queryKey: ['training-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('roleplay_sessions')
        .select('id, status, duration_seconds')
        .eq('trainee_id', user.id);
      
      if (error) throw error;
      
      const completed = data?.filter(s => s.status === 'completed') || [];
      const totalDuration = completed.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
      
      return {
        total_sessions: data?.length || 0,
        completed_sessions: completed.length,
        avg_duration_seconds: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
      } as SessionStats;
    },
    enabled: !!user?.id,
  });

  const handleStartSession = (personaId: string) => {
    navigate(`/training/roleplay/${personaId}`);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-6xl">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mic className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">Sales Roleplay Training</h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Practice your sales skills with AI-powered prospect simulations
            </p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Sessions</p>
                    <p className="text-3xl font-bold">{stats?.total_sessions ?? 0}</p>
                  </div>
                  <Target className="h-10 w-10 text-primary/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/5 to-green-500/10 border-green-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-3xl font-bold">{stats?.completed_sessions ?? 0}</p>
                  </div>
                  <Trophy className="h-10 w-10 text-green-500/60" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Duration</p>
                    <p className="text-3xl font-bold">
                      {stats?.avg_duration_seconds ? formatDuration(stats.avg_duration_seconds) : '0:00'}
                    </p>
                  </div>
                  <Clock className="h-10 w-10 text-blue-500/60" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-3 mb-8">
            <Button variant="outline" onClick={() => navigate('/training/history')}>
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
            <Button variant="outline" onClick={() => navigate('/training/progress')}>
              <TrendingUp className="h-4 w-4 mr-2" />
              My Progress
            </Button>
          </div>

          {/* Personas Section */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Choose Your Practice Partner</h2>
            </div>
            <p className="text-muted-foreground mb-6">
              Select a persona to practice with. Each persona has unique communication styles, objections, and personality traits.
            </p>
          </div>

          {/* Persona Grid */}
          {personasLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : personas && personas.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {personas.map((persona) => (
                <Card
                  key={persona.id}
                  className={cn(
                    "cursor-pointer transition-all hover:shadow-lg hover:border-primary/50",
                    selectedPersonaId === persona.id && "ring-2 ring-primary border-primary"
                  )}
                  onClick={() => setSelectedPersonaId(persona.id)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {persona.disc_profile && (
                          <div
                            className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm",
                              discProfileColors[persona.disc_profile] || 'bg-gray-500'
                            )}
                          >
                            {persona.disc_profile}
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-lg">{persona.name}</CardTitle>
                          <CardDescription className="capitalize">{persona.persona_type.replace('_', ' ')}</CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {persona.backstory || 'A challenging prospect to practice with.'}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className={cn("capitalize", difficultyColors[persona.difficulty_level])}>
                        {persona.difficulty_level}
                      </Badge>
                      {persona.industry && (
                        <Badge variant="secondary" className="capitalize">
                          {persona.industry}
                        </Badge>
                      )}
                    </div>

                    <Button
                      className="w-full mt-4"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartSession(persona.id);
                      }}
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Practice
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Personas Available</h3>
              <p className="text-muted-foreground">
                Your team admin hasn't created any practice personas yet. Check back soon!
              </p>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
