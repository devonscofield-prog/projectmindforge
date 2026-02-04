import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { format } from 'date-fns';
import type { Json } from '@/integrations/supabase/types';

interface SessionWithGrade {
  id: string;
  created_at: string;
  duration_seconds: number | null;
  session_type?: string | null;
  roleplay_grades: Array<{
    overall_grade: string | null;
    scores: Json;
  }>;
}

interface ProgressTrendChartProps {
  sessions: SessionWithGrade[];
}

const gradeToScore: Record<string, number> = {
  'A+': 98,
  'A': 90,
  'B': 77,
  'C': 62,
  'D': 47,
  'F': 30,
};

export function ProgressTrendChart({ sessions }: ProgressTrendChartProps) {
  const chartData = useMemo(() => {
    // Get graded sessions, sorted by date ascending
    const gradedSessions = sessions
      .filter(s => s.roleplay_grades?.[0]?.overall_grade)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .slice(-10); // Last 10 sessions

    return gradedSessions.map((session, index) => {
      const grade = session.roleplay_grades[0]?.overall_grade || '';
      const scores = session.roleplay_grades[0]?.scores as Record<string, number> | null;
      
      // Calculate average score from all skill scores
      let avgScore = gradeToScore[grade] || 0;
      if (scores) {
        const scoreValues = Object.values(scores).filter(v => typeof v === 'number');
        if (scoreValues.length > 0) {
          avgScore = Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length);
        }
      }

      return {
        session: index + 1,
        date: format(new Date(session.created_at), 'MMM d'),
        score: avgScore,
        grade,
      };
    });
  }, [sessions]);

  if (chartData.length < 2) {
    return null;
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">Score Trend</CardTitle>
        <CardDescription>Your performance over the last {chartData.length} sessions</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                domain={[0, 100]} 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-1">
                          <p className="text-xs text-muted-foreground">{data.date}</p>
                          <p className="font-medium">Grade: {data.grade}</p>
                          <p className="text-sm text-muted-foreground">Score: {data.score}</p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line 
                type="monotone" 
                dataKey="score" 
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
