import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { fetchTaskAnalytics } from '@/api/taskAnalytics';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, TrendingUp, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts';
import { PRIORITY_CONFIG, CATEGORY_LABELS } from '@/lib/taskConstants';

export function TaskInsightsSection() {
  const { user } = useAuth();
  const repId = user?.id || '';

  const { data: analytics, isLoading } = useQuery({
    queryKey: ['task-analytics', repId],
    queryFn: () => fetchTaskAnalytics(repId),
    enabled: !!repId,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!analytics || analytics.totalTasks === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No task data yet</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Complete some tasks to see your analytics
        </p>
      </div>
    );
  }

  const categoryData = analytics.byCategory.map(c => ({
    ...c,
    label: CATEGORY_LABELS[c.category] || c.category,
  }));

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Completion Rate"
          value={`${analytics.completionRate}%`}
          iconColor="text-emerald-500"
          bgColor="bg-emerald-500/10"
        />
        <StatCard
          icon={Clock}
          label="Avg. Days to Complete"
          value={analytics.avgDaysToComplete != null ? `${analytics.avgDaysToComplete}d` : '—'}
          iconColor="text-blue-500"
          bgColor="bg-blue-500/10"
        />
        <StatCard
          icon={AlertTriangle}
          label="Overdue Rate"
          value={`${analytics.overdueRate}%`}
          iconColor="text-amber-500"
          bgColor="bg-amber-500/10"
        />
        <StatCard
          icon={BarChart3}
          label="Total Tasks"
          value={String(analytics.totalTasks)}
          iconColor="text-primary"
          bgColor="bg-primary/10"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Priority Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.byPriority} layout="vertical">
                <XAxis type="number" />
                <YAxis
                  type="category"
                  dataKey="priority"
                  width={60}
                  tickFormatter={(v) => PRIORITY_CONFIG[v]?.label || v}
                />
                <Tooltip />
                <Legend />
                <Bar dataKey="pending" stackId="a" fill="hsl(var(--primary))" name="Pending" radius={[0, 0, 0, 0]} />
                <Bar dataKey="completed" stackId="a" fill="hsl(142 76% 36%)" name="Completed" radius={[0, 0, 0, 0]} />
                <Bar dataKey="dismissed" stackId="a" fill="hsl(var(--muted-foreground))" name="Dismissed" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tasks by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={categoryData} layout="vertical">
                <XAxis type="number" />
                <YAxis type="category" dataKey="label" width={100} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Tasks" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Weekly Completion Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={analytics.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary) / 0.2)"
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  iconColor,
  bgColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-full ${bgColor} flex items-center justify-center shrink-0`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
