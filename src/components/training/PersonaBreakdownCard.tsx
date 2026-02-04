import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';

interface SessionWithPersona {
  id: string;
  persona_id: string | null;
  session_type: string | null;
  roleplay_personas?: { name: string } | null;
  roleplay_grades: Array<{
    overall_grade: string | null;
    scores: Json;
  }>;
}

interface PersonaBreakdownCardProps {
  sessions: SessionWithPersona[];
}

const gradeToScore: Record<string, number> = {
  'A+': 98,
  'A': 90,
  'B': 77,
  'C': 62,
  'D': 47,
  'F': 30,
};

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-amber-500';
  return 'text-red-500';
}

export function PersonaBreakdownCard({ sessions }: PersonaBreakdownCardProps) {
  const { personaStats, sessionTypeStats } = useMemo(() => {
    const personaMap = new Map<string, { name: string; sessions: number; totalScore: number; gradedCount: number }>();
    const typeMap = new Map<string, { sessions: number; totalScore: number; gradedCount: number }>();

    sessions.forEach(session => {
      // Persona breakdown
      const personaId = session.persona_id || 'unknown';
      const personaName = session.roleplay_personas?.name || 'Unknown Persona';
      
      if (!personaMap.has(personaId)) {
        personaMap.set(personaId, { name: personaName, sessions: 0, totalScore: 0, gradedCount: 0 });
      }
      const pStats = personaMap.get(personaId)!;
      pStats.sessions++;
      
      const grade = session.roleplay_grades?.[0]?.overall_grade;
      if (grade && gradeToScore[grade]) {
        pStats.totalScore += gradeToScore[grade];
        pStats.gradedCount++;
      }

      // Session type breakdown
      const sessionType = session.session_type || 'discovery';
      if (!typeMap.has(sessionType)) {
        typeMap.set(sessionType, { sessions: 0, totalScore: 0, gradedCount: 0 });
      }
      const tStats = typeMap.get(sessionType)!;
      tStats.sessions++;
      
      if (grade && gradeToScore[grade]) {
        tStats.totalScore += gradeToScore[grade];
        tStats.gradedCount++;
      }
    });

    const personaStats = Array.from(personaMap.entries()).map(([id, stats]) => ({
      id,
      name: stats.name,
      sessions: stats.sessions,
      avgScore: stats.gradedCount > 0 ? Math.round(stats.totalScore / stats.gradedCount) : null,
    }));

    const sessionTypeStats = Array.from(typeMap.entries()).map(([type, stats]) => ({
      type,
      sessions: stats.sessions,
      avgScore: stats.gradedCount > 0 ? Math.round(stats.totalScore / stats.gradedCount) : null,
    }));

    return { personaStats, sessionTypeStats };
  }, [sessions]);

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Persona Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">By Persona</CardTitle>
          <CardDescription>Performance with different characters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {personaStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No persona data yet</p>
          ) : (
            personaStats.map(persona => (
              <div key={persona.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium truncate flex-1">{persona.name}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {persona.sessions} {persona.sessions === 1 ? 'session' : 'sessions'}
                    </Badge>
                    {persona.avgScore !== null && (
                      <span className={cn("font-bold tabular-nums", getScoreColor(persona.avgScore))}>
                        {persona.avgScore}
                      </span>
                    )}
                  </div>
                </div>
                {persona.avgScore !== null && (
                  <Progress value={persona.avgScore} className="h-1.5" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Session Type Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">By Session Type</CardTitle>
          <CardDescription>Performance across practice modes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {sessionTypeStats.length === 0 ? (
            <p className="text-sm text-muted-foreground">No session type data yet</p>
          ) : (
            sessionTypeStats.map(type => (
              <div key={type.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium capitalize">{type.type.replace('_', ' ')}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {type.sessions} {type.sessions === 1 ? 'session' : 'sessions'}
                    </Badge>
                    {type.avgScore !== null && (
                      <span className={cn("font-bold tabular-nums", getScoreColor(type.avgScore))}>
                        {type.avgScore}
                      </span>
                    )}
                  </div>
                </div>
                {type.avgScore !== null && (
                  <Progress value={type.avgScore} className="h-1.5" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
