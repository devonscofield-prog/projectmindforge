import { supabase } from '@/integrations/supabase/client';

// Industry standard benchmarks (based on common SaaS application standards)
// Note: Edge functions use error-rate based health, not duration, since AI agents take 20-60s normally
export const INDUSTRY_BENCHMARKS = {
  queryTime: {
    excellent: 100,
    good: 300,
    acceptable: 500,
    warning: 1000,
    critical: 1500,
    label: 'Database Query Time',
    unit: 'ms',
  },
  // Edge function error rate (duration is not useful for AI agents)
  edgeFunctionErrorRate: {
    excellent: 0.5,
    good: 1,
    acceptable: 2,
    warning: 5,
    critical: 10,
    label: 'Edge Function Error Rate',
    unit: '%',
  },
  errorRate: {
    excellent: 0.1,
    good: 0.5,
    acceptable: 1,
    warning: 3,
    critical: 5,
    label: 'Overall Error Rate',
    unit: '%',
  },
  // P99 for queries only (edge functions excluded due to AI agent variability)
  queryP99Latency: {
    excellent: 300,
    good: 500,
    acceptable: 1000,
    warning: 2000,
    critical: 3000,
    label: 'Query P99 Latency',
    unit: 'ms',
  },
} as const;

export interface HistoricalBaseline {
  metric_type: string;
  avg_duration_ms: number;
  p50_duration_ms: number;
  p90_duration_ms: number;
  p99_duration_ms: number;
  error_rate: number;
  sample_count: number;
  period_start: string;
  period_end: string;
}

export interface BenchmarkComparison {
  metric: string;
  current: number;
  historical: number | null;
  industryBenchmark: number;
  vsHistorical: number | null; // percentage change
  vsIndustry: 'excellent' | 'good' | 'acceptable' | 'warning' | 'critical';
  trend: 'improving' | 'stable' | 'degrading' | 'unknown';
}

/**
 * Get historical baseline from the last 7-30 days (excluding the last 24 hours)
 */
export async function getHistoricalBaseline(days: number = 7): Promise<HistoricalBaseline[]> {
  const endTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // Exclude last 24h
  const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('performance_metrics')
    .select('metric_type, duration_ms, status, created_at')
    .gte('created_at', startTime.toISOString())
    .lte('created_at', endTime.toISOString())
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching historical baseline:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  // Group by metric_type and calculate aggregates
  const grouped = new Map<string, { durations: number[]; errors: number }>();

  data.forEach((metric) => {
    const existing = grouped.get(metric.metric_type) || { durations: [], errors: 0 };
    existing.durations.push(metric.duration_ms);
    if (metric.status !== 'success') existing.errors++;
    grouped.set(metric.metric_type, existing);
  });

  return Array.from(grouped.entries()).map(([metric_type, stats]) => {
    const sorted = [...stats.durations].sort((a, b) => a - b);
    const len = sorted.length;

    return {
      metric_type,
      avg_duration_ms: Math.round(stats.durations.reduce((a, b) => a + b, 0) / len),
      p50_duration_ms: sorted[Math.floor(len * 0.5)] || 0,
      p90_duration_ms: sorted[Math.floor(len * 0.9)] || 0,
      p99_duration_ms: sorted[Math.floor(len * 0.99)] || 0,
      error_rate: Math.round((stats.errors / len) * 100 * 100) / 100,
      sample_count: len,
      period_start: startTime.toISOString(),
      period_end: endTime.toISOString(),
    };
  });
}

/**
 * Compare current metrics against historical baseline and industry standards
 */
export async function getBenchmarkComparison(
  currentHours: number = 1,
  historicalDays: number = 7
): Promise<BenchmarkComparison[]> {
  const [currentSummary, historicalBaseline] = await Promise.all([
    supabase.rpc('get_performance_summary', { p_hours: currentHours }),
    getHistoricalBaseline(historicalDays),
  ]);

  if (currentSummary.error) {
    console.error('Error fetching current summary:', currentSummary.error);
    throw currentSummary.error;
  }

  const current = currentSummary.data || [];
  const historicalMap = new Map(historicalBaseline.map((h) => [h.metric_type, h]));

  const comparisons: BenchmarkComparison[] = [];

  // Query time comparison
  const queryMetrics = current.filter((m) => m.metric_type === 'query');
  const queryHistorical = historicalMap.get('query');
  if (queryMetrics.length > 0) {
    const avgQueryTime = queryMetrics.reduce((sum, m) => sum + m.avg_duration_ms, 0) / queryMetrics.length;
    const historicalAvg = queryHistorical?.avg_duration_ms || null;

    comparisons.push({
      metric: 'Query Response Time',
      current: Math.round(avgQueryTime),
      historical: historicalAvg,
      industryBenchmark: INDUSTRY_BENCHMARKS.queryTime.acceptable,
      vsHistorical: historicalAvg ? Math.round(((avgQueryTime - historicalAvg) / historicalAvg) * 100) : null,
      vsIndustry: getIndustryRating(avgQueryTime, INDUSTRY_BENCHMARKS.queryTime),
      trend: getTrend(avgQueryTime, historicalAvg),
    });
  }

  // Edge function error rate comparison (not duration - AI agents take 20-60s normally)
  const edgeMetrics = current.filter((m) => m.metric_type === 'edge_function');
  const edgeHistorical = historicalMap.get('edge_function');
  if (edgeMetrics.length > 0) {
    const edgeTotalCount = edgeMetrics.reduce((sum, m) => sum + m.total_count, 0);
    const edgeTotalErrors = edgeMetrics.reduce((sum, m) => sum + m.error_count, 0);
    const edgeErrorRate = edgeTotalCount > 0 ? (edgeTotalErrors / edgeTotalCount) * 100 : 0;
    const historicalErrorRate = edgeHistorical?.error_rate || null;

    comparisons.push({
      metric: 'Edge Function Error Rate',
      current: Math.round(edgeErrorRate * 100) / 100,
      historical: historicalErrorRate,
      industryBenchmark: INDUSTRY_BENCHMARKS.edgeFunctionErrorRate.acceptable,
      vsHistorical: historicalErrorRate && historicalErrorRate > 0 
        ? Math.round(((edgeErrorRate - historicalErrorRate) / historicalErrorRate) * 100) 
        : null,
      vsIndustry: getIndustryRating(edgeErrorRate, INDUSTRY_BENCHMARKS.edgeFunctionErrorRate),
      trend: getTrend(edgeErrorRate, historicalErrorRate, true), // Lower is better
    });
  }

  // Error rate comparison
  const totalCount = current.reduce((sum, m) => sum + m.total_count, 0);
  const totalErrors = current.reduce((sum, m) => sum + m.error_count, 0);
  const currentErrorRate = totalCount > 0 ? (totalErrors / totalCount) * 100 : 0;

  const historicalErrorRate =
    historicalBaseline.length > 0
      ? historicalBaseline.reduce((sum, h) => sum + h.error_rate, 0) / historicalBaseline.length
      : null;

  comparisons.push({
    metric: 'Error Rate',
    current: Math.round(currentErrorRate * 100) / 100,
    historical: historicalErrorRate,
    industryBenchmark: INDUSTRY_BENCHMARKS.errorRate.acceptable,
    vsHistorical:
      historicalErrorRate && historicalErrorRate > 0
        ? Math.round(((currentErrorRate - historicalErrorRate) / historicalErrorRate) * 100)
        : null,
    vsIndustry: getIndustryRating(currentErrorRate, INDUSTRY_BENCHMARKS.errorRate),
    trend: getTrend(currentErrorRate, historicalErrorRate, true), // Lower is better
  });

  // P99 latency comparison (queries only - edge functions excluded due to AI variability)
  const queryP99 = queryMetrics.map((m) => m.p99_duration_ms).filter((p) => p > 0);
  if (queryP99.length > 0) {
    const avgP99 = queryP99.reduce((a, b) => a + b, 0) / queryP99.length;
    const historicalP99 = queryHistorical?.p99_duration_ms || null;

    comparisons.push({
      metric: 'Query P99 Latency',
      current: Math.round(avgP99),
      historical: historicalP99 ? Math.round(historicalP99) : null,
      industryBenchmark: INDUSTRY_BENCHMARKS.queryP99Latency.acceptable,
      vsHistorical: historicalP99 ? Math.round(((avgP99 - historicalP99) / historicalP99) * 100) : null,
      vsIndustry: getIndustryRating(avgP99, INDUSTRY_BENCHMARKS.queryP99Latency),
      trend: getTrend(avgP99, historicalP99),
    });
  }

  return comparisons;
}

function getIndustryRating(
  value: number,
  benchmarks: { excellent: number; good: number; acceptable: number; warning: number; critical: number }
): 'excellent' | 'good' | 'acceptable' | 'warning' | 'critical' {
  if (value <= benchmarks.excellent) return 'excellent';
  if (value <= benchmarks.good) return 'good';
  if (value <= benchmarks.acceptable) return 'acceptable';
  if (value <= benchmarks.warning) return 'warning';
  return 'critical';
}

function getTrend(
  current: number,
  historical: number | null,
  lowerIsBetter: boolean = true
): 'improving' | 'stable' | 'degrading' | 'unknown' {
  if (historical === null) return 'unknown';

  const changePercent = ((current - historical) / historical) * 100;

  if (Math.abs(changePercent) < 5) return 'stable';

  if (lowerIsBetter) {
    return changePercent < 0 ? 'improving' : 'degrading';
  } else {
    return changePercent > 0 ? 'improving' : 'degrading';
  }
}
