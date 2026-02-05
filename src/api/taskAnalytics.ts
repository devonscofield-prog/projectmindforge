import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, subWeeks, startOfWeek, format } from 'date-fns';
import type { AccountFollowUp } from './accountFollowUps';

export interface TaskAnalytics {
  totalTasks: number;
  completedCount: number;
  pendingCount: number;
  dismissedCount: number;
  completionRate: number;
  avgDaysToComplete: number | null;
  overdueRate: number;
  byPriority: { priority: string; pending: number; completed: number; dismissed: number }[];
  byCategory: { category: string; count: number }[];
  weeklyTrend: { week: string; completed: number }[];
}

export async function fetchTaskAnalytics(repId: string): Promise<TaskAnalytics> {
  const { data, error } = await supabase
    .from('account_follow_ups')
    .select('*')
    .eq('rep_id', repId)
    .eq('source', 'manual')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;

  const tasks = (data || []) as AccountFollowUp[];
  const completed = tasks.filter(t => t.status === 'completed');
  const pending = tasks.filter(t => t.status === 'pending');
  const dismissed = tasks.filter(t => t.status === 'dismissed');

  // Completion rate
  const total = tasks.length;
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

  // Avg days to complete
  const completionDays = completed
    .filter(t => t.completed_at)
    .map(t => differenceInDays(new Date(t.completed_at!), new Date(t.created_at)))
    .filter(d => d >= 0);
  const avgDaysToComplete = completionDays.length > 0
    ? Math.round((completionDays.reduce((a, b) => a + b, 0) / completionDays.length) * 10) / 10
    : null;

  // Overdue rate
  const completedWithDue = completed.filter(t => t.due_date && t.completed_at);
  const overdueCompleted = completedWithDue.filter(t =>
    new Date(t.completed_at!) > new Date(t.due_date!)
  );
  const overdueRate = completedWithDue.length > 0
    ? Math.round((overdueCompleted.length / completedWithDue.length) * 100)
    : 0;

  // By priority
  const priorities = ['high', 'medium', 'low'];
  const byPriority = priorities.map(p => ({
    priority: p,
    pending: pending.filter(t => t.priority === p).length,
    completed: completed.filter(t => t.priority === p).length,
    dismissed: dismissed.filter(t => t.priority === p).length,
  }));

  // By category
  const categoryMap: Record<string, number> = {};
  tasks.forEach(t => {
    const cat = t.category || 'uncategorized';
    categoryMap[cat] = (categoryMap[cat] || 0) + 1;
  });
  const byCategory = Object.entries(categoryMap)
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Weekly trend (last 8 weeks)
  const weeklyTrend: { week: string; completed: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(new Date(), i));
    const weekEnd = startOfWeek(subWeeks(new Date(), i - 1));
    const count = completed.filter(t => {
      const d = new Date(t.completed_at || t.updated_at);
      return d >= weekStart && d < weekEnd;
    }).length;
    weeklyTrend.push({ week: format(weekStart, 'MMM d'), completed: count });
  }

  return {
    totalTasks: total,
    completedCount: completed.length,
    pendingCount: pending.length,
    dismissedCount: dismissed.length,
    completionRate,
    avgDaysToComplete,
    overdueRate,
    byPriority,
    byCategory,
    weeklyTrend,
  };
}
