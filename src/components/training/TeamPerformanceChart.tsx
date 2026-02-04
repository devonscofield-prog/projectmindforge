import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface SessionData {
  persona_name: string;
  session_type: string;
  overall_grade: string | null;
}

interface TeamPerformanceChartProps {
  sessions: SessionData[];
  chartType: 'persona' | 'type';
}

const gradeToScore: Record<string, number> = {
  'A+': 98,
  'A': 90,
  'B': 77,
  'C': 62,
  'D': 47,
  'F': 30,
};

const COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 50%)',
  'hsl(280, 70%, 50%)',
  'hsl(160, 70%, 40%)',
  'hsl(30, 70%, 50%)',
];

export function TeamPerformanceChart({ sessions, chartType }: TeamPerformanceChartProps) {
  const chartData = useMemo(() => {
    const statsMap = new Map<string, { totalScore: number; count: number }>();

    sessions.forEach(session => {
      if (!session.overall_grade) return;
      
      const key = chartType === 'persona' ? session.persona_name : session.session_type;
      const score = gradeToScore[session.overall_grade];
      
      if (!score) return;

      if (!statsMap.has(key)) {
        statsMap.set(key, { totalScore: 0, count: 0 });
      }
      
      const stats = statsMap.get(key)!;
      stats.totalScore += score;
      stats.count++;
    });

    return Array.from(statsMap.entries())
      .map(([name, stats]) => ({
        name: chartType === 'type' ? name.replace('_', ' ').replace(/^\w/, c => c.toUpperCase()) : name,
        avgScore: Math.round(stats.totalScore / stats.count),
        sessions: stats.count,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [sessions, chartType]);

  if (chartData.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">
          {chartType === 'persona' ? 'Performance by Persona' : 'Performance by Session Type'}
        </CardTitle>
        <CardDescription>
          Team average scores across {chartType === 'persona' ? 'different personas' : 'session types'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 20, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={true} vertical={false} />
              <XAxis 
                type="number" 
                domain={[0, 100]} 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                width={75}
              />
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload?.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <p className="font-medium">{data.name}</p>
                        <p className="text-sm text-muted-foreground">Avg Score: {data.avgScore}</p>
                        <p className="text-xs text-muted-foreground">{data.sessions} sessions</p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="avgScore" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
