import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Profile, CoachingSession } from '@/types/database';
import { AiScoreStats } from '@/api/aiCallAnalysis';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { differenceInDays } from 'date-fns';

interface RepWithData extends Profile {
  lastCoaching?: CoachingSession;
  aiScoreStats?: AiScoreStats | null;
  callsLast30Days: number;
}

interface TeamHealthWidgetProps {
  reps: RepWithData[];
}

type HealthStatus = 'green' | 'yellow' | 'red';

interface TeamHealthMetrics {
  coachedCount: number;
  totalReps: number;
  coachingPct: number;
  avgScore: number | null;
  prevAvgScore: number | null;
  activeCount: number;
  activePct: number;
  attentionCount: number;
  status: HealthStatus;
}

function computeMetrics(reps: RepWithData[]): TeamHealthMetrics {
  const totalReps = reps.length;

  if (totalReps === 0) {
    return {
      coachedCount: 0,
      totalReps: 0,
      coachingPct: 0,
      avgScore: null,
      prevAvgScore: null,
      activeCount: 0,
      activePct: 0,
      attentionCount: 0,
      status: 'green',
    };
  }

  // Coaching coverage: reps coached in last 14 days
  const now = new Date();
  const coachedCount = reps.filter((r) => {
    if (!r.lastCoaching) return false;
    return differenceInDays(now, new Date(r.lastCoaching.session_date)) < 14;
  }).length;
  const coachingPct = Math.round((coachedCount / totalReps) * 100);

  // Team avg score (latest scores)
  const scoresWithValues = reps
    .map((r) => r.aiScoreStats?.latestScore)
    .filter((s): s is number => s != null);
  const avgScore =
    scoresWithValues.length > 0
      ? Math.round(scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length)
      : null;

  // Previous avg (30d averages for comparison)
  const prevScores = reps
    .map((r) => r.aiScoreStats?.avgScore30Days)
    .filter((s): s is number => s != null);
  const prevAvgScore =
    prevScores.length > 0
      ? Math.round(prevScores.reduce((a, b) => a + b, 0) / prevScores.length)
      : null;

  // Active reps: reps with calls in last 30 days
  const activeCount = reps.filter((r) => r.callsLast30Days > 0).length;
  const activePct = Math.round((activeCount / totalReps) * 100);

  // Attention needed: coaching overdue OR score declining
  const attentionCount = reps.filter((r) => {
    const daysSinceCoaching = r.lastCoaching
      ? differenceInDays(now, new Date(r.lastCoaching.session_date))
      : null;
    const coachingOverdue = daysSinceCoaching === null || daysSinceCoaching >= 14;
    const scoreDecline =
      r.aiScoreStats?.avgScore30Days != null &&
      r.aiScoreStats?.latestScore != null &&
      r.aiScoreStats.callCount30Days > 1 &&
      r.aiScoreStats.latestScore < r.aiScoreStats.avgScore30Days - 2;
    return coachingOverdue || scoreDecline;
  }).length;

  // Overall status
  const scorePct = avgScore ?? 0;
  let status: HealthStatus = 'green';
  if (coachingPct < 50 || scorePct < 50 || activePct < 50) {
    status = 'red';
  } else if (coachingPct < 80 || scorePct < 70 || activePct < 80) {
    status = 'yellow';
  }

  return {
    coachedCount,
    totalReps,
    coachingPct,
    avgScore,
    prevAvgScore,
    activeCount,
    activePct,
    attentionCount,
    status,
  };
}

const statusConfig: Record<HealthStatus, { color: string; bg: string; label: string }> = {
  green: { color: 'bg-emerald-500', bg: 'bg-emerald-500/10', label: 'Healthy' },
  yellow: { color: 'bg-amber-500', bg: 'bg-amber-500/10', label: 'Needs Attention' },
  red: { color: 'bg-red-500', bg: 'bg-red-500/10', label: 'At Risk' },
};

export function TeamHealthWidget({ reps }: TeamHealthWidgetProps) {
  const metrics = useMemo(() => computeMetrics(reps), [reps]);
  const sc = statusConfig[metrics.status];

  const scoreTrend =
    metrics.avgScore != null && metrics.prevAvgScore != null
      ? metrics.avgScore - metrics.prevAvgScore
      : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Team Health</CardTitle>
          <div className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${sc.bg}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${sc.color}`} />
            {sc.label}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Coaching Coverage */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              Coaching Coverage
            </div>
            <div className="text-2xl font-bold">
              {metrics.coachedCount}/{metrics.totalReps}
            </div>
            <Progress value={metrics.coachingPct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metrics.coachingPct}% coached in last 14d
            </p>
          </div>

          {/* Team Avg Score */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Team Avg Score
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">
                {metrics.avgScore != null ? metrics.avgScore : '--'}
              </span>
              {scoreTrend != null && (
                <span
                  className={`flex items-center gap-0.5 text-xs font-medium ${
                    scoreTrend > 2
                      ? 'text-emerald-600'
                      : scoreTrend < -2
                        ? 'text-red-600'
                        : 'text-muted-foreground'
                  }`}
                >
                  {scoreTrend > 2 ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : scoreTrend < -2 ? (
                    <TrendingDown className="h-3.5 w-3.5" />
                  ) : (
                    <Minus className="h-3.5 w-3.5" />
                  )}
                  {scoreTrend > 0 ? '+' : ''}
                  {scoreTrend}
                </span>
              )}
            </div>
            <div className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metrics.prevAvgScore != null ? `30d avg: ${metrics.prevAvgScore}` : 'No prior data'}
            </p>
          </div>

          {/* Active Reps */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <UserCheck className="h-4 w-4" />
              Active Reps
            </div>
            <div className="text-2xl font-bold">
              {metrics.activeCount}/{metrics.totalReps}
            </div>
            <Progress value={metrics.activePct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {metrics.activePct}% with calls in 30d
            </p>
          </div>

          {/* Attention Needed */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4" />
              Attention Needed
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{metrics.attentionCount}</span>
              {metrics.attentionCount > 0 && (
                <span className="text-xs font-medium text-amber-600">
                  rep{metrics.attentionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="h-2" />
            <p className="text-xs text-muted-foreground">
              Coaching overdue or score declining
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
