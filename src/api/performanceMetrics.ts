import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface PerformanceSummary {
  metric_type: string;
  metric_name: string;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p90_duration_ms: number;
  p99_duration_ms: number;
  total_count: number;
  error_count: number;
  error_rate: number;
}

export interface PerformanceMetric {
  id: string;
  metric_type: string;
  metric_name: string;
  duration_ms: number;
  status: string | null;
  user_id: string | null;
  metadata: Json;
  created_at: string | null;
}

export interface HealthStatus {
  level: 'healthy' | 'warning' | 'critical';
  value: number;
  label: string;
}

/**
 * Get aggregated performance summary for the last N hours
 */
export async function getPerformanceSummary(hours: number = 1): Promise<PerformanceSummary[]> {
  const { data, error } = await supabase.rpc('get_performance_summary', {
    p_hours: hours,
  });

  if (error) {
    console.error('Error fetching performance summary:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get raw performance metrics for a time range
 */
export async function getPerformanceMetrics(
  hours: number = 24,
  metricType?: string,
  limit: number = 1000
): Promise<PerformanceMetric[]> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('performance_metrics')
    .select('*')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (metricType) {
    query = query.eq('metric_type', metricType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching performance metrics:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get metrics grouped by hour for charting
 */
export async function getMetricsTimeline(
  hours: number = 24,
  metricType?: string
): Promise<{ hour: string; avg_duration: number; count: number; error_rate: number }[]> {
  const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('performance_metrics')
    .select('created_at, duration_ms, status, metric_type')
    .gte('created_at', cutoffTime)
    .order('created_at', { ascending: true });

  if (metricType) {
    query = query.eq('metric_type', metricType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching metrics timeline:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  // Group by hour
  const hourlyData = new Map<string, { durations: number[]; errors: number }>();

  data.forEach((metric) => {
    const hour = new Date(metric.created_at || Date.now()).toISOString().slice(0, 13) + ':00';
    const existing = hourlyData.get(hour) || { durations: [], errors: 0 };
    existing.durations.push(metric.duration_ms);
    if (metric.status !== 'success') existing.errors++;
    hourlyData.set(hour, existing);
  });

  return Array.from(hourlyData.entries()).map(([hour, data]) => ({
    hour,
    avg_duration: Math.round(data.durations.reduce((a, b) => a + b, 0) / data.durations.length),
    count: data.durations.length,
    error_rate: Math.round((data.errors / data.durations.length) * 100 * 10) / 10,
  }));
}

/**
 * Get edge function performance breakdown
 */
export async function getEdgeFunctionBreakdown(
  hours: number = 24
): Promise<PerformanceSummary[]> {
  const summary = await getPerformanceSummary(hours);
  return summary.filter((s) => s.metric_type === 'edge_function');
}

/**
 * Get overall system health based on metrics
 */
export async function getSystemHealth(): Promise<{
  queryHealth: HealthStatus;
  edgeFunctionHealth: HealthStatus;
  errorRateHealth: HealthStatus;
  overallHealth: 'healthy' | 'warning' | 'critical';
  recommendation?: string;
}> {
  const summary = await getPerformanceSummary(1);

  const querySummary = summary.filter((s) => s.metric_type === 'query');
  const edgeSummary = summary.filter((s) => s.metric_type === 'edge_function');

  // Calculate averages
  const avgQueryTime = querySummary.length > 0
    ? querySummary.reduce((sum, s) => sum + s.avg_duration_ms, 0) / querySummary.length
    : 0;

  const avgEdgeTime = edgeSummary.length > 0
    ? edgeSummary.reduce((sum, s) => sum + s.avg_duration_ms, 0) / edgeSummary.length
    : 0;

  const totalCount = summary.reduce((sum, s) => sum + s.total_count, 0);
  const totalErrors = summary.reduce((sum, s) => sum + s.error_count, 0);
  const overallErrorRate = totalCount > 0 ? (totalErrors / totalCount) * 100 : 0;

  // Determine health levels
  const queryHealth: HealthStatus = {
    value: Math.round(avgQueryTime),
    label: `${Math.round(avgQueryTime)}ms avg`,
    level: avgQueryTime < 500 ? 'healthy' : avgQueryTime < 1500 ? 'warning' : 'critical',
  };

  const edgeFunctionHealth: HealthStatus = {
    value: Math.round(avgEdgeTime),
    label: `${Math.round(avgEdgeTime)}ms avg`,
    level: avgEdgeTime < 3000 ? 'healthy' : avgEdgeTime < 8000 ? 'warning' : 'critical',
  };

  const errorRateHealth: HealthStatus = {
    value: Math.round(overallErrorRate * 10) / 10,
    label: `${(Math.round(overallErrorRate * 10) / 10)}%`,
    level: overallErrorRate < 1 ? 'healthy' : overallErrorRate < 5 ? 'warning' : 'critical',
  };

  // Determine overall health
  const healthLevels = [queryHealth.level, edgeFunctionHealth.level, errorRateHealth.level];
  const criticalCount = healthLevels.filter((l) => l === 'critical').length;
  const warningCount = healthLevels.filter((l) => l === 'warning').length;

  let overallHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
  let recommendation: string | undefined;

  if (criticalCount >= 2) {
    overallHealth = 'critical';
    recommendation = 'Consider upgrading to a Large instance. Multiple metrics are in critical state.';
  } else if (criticalCount >= 1 || warningCount >= 2) {
    overallHealth = 'warning';
    recommendation = 'Monitor closely. Performance is degrading. Consider upgrading instance size if trend continues.';
  }

  return {
    queryHealth,
    edgeFunctionHealth,
    errorRateHealth,
    overallHealth,
    recommendation,
  };
}

/**
 * Clean up old metrics (admin only)
 */
export async function cleanupOldMetrics(): Promise<number> {
  const { data, error } = await supabase.rpc('cleanup_old_metrics');

  if (error) {
    console.error('Error cleaning up metrics:', error);
    throw error;
  }

  return data || 0;
}
