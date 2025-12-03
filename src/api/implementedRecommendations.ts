import { supabase } from '@/integrations/supabase/client';
import { getPerformanceSummary } from './performanceMetrics';
import { toImplementedRecommendation } from '@/lib/supabaseAdapters';
import type { Json } from '@/integrations/supabase/types';

export interface BaselineMetrics {
  avgQueryTime: number;
  avgEdgeFunctionTime: number;
  errorRate: number;
  p99Latency: number;
  timestamp: string;
}

export interface ImplementedRecommendation {
  id: string;
  user_id: string;
  recommendation_title: string;
  recommendation_category: string;
  recommendation_priority: string;
  recommendation_action: string;
  affected_operations: string[];
  baseline_metrics: BaselineMetrics;
  implemented_at: string;
  measured_at: string | null;
  post_metrics: BaselineMetrics | null;
  improvement_percent: number | null;
  status: 'implemented' | 'measured' | 'verified';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export async function captureCurrentMetrics(): Promise<BaselineMetrics> {
  const summary = await getPerformanceSummary(24);

  const queryMetrics = summary.filter((m) => m.metric_type === 'query');
  const edgeMetrics = summary.filter((m) => m.metric_type === 'edge_function');

  const avgQueryTime =
    queryMetrics.length > 0
      ? queryMetrics.reduce((sum, m) => sum + m.avg_duration_ms, 0) / queryMetrics.length
      : 0;

  const avgEdgeFunctionTime =
    edgeMetrics.length > 0
      ? edgeMetrics.reduce((sum, m) => sum + m.avg_duration_ms, 0) / edgeMetrics.length
      : 0;

  const totalCount = summary.reduce((sum, m) => sum + m.total_count, 0);
  const totalErrors = summary.reduce((sum, m) => sum + m.error_count, 0);
  const errorRate = totalCount > 0 ? (totalErrors / totalCount) * 100 : 0;

  const allP99 = summary.map((m) => m.p99_duration_ms).filter((p) => p > 0);
  const p99Latency = allP99.length > 0 ? allP99.reduce((a, b) => a + b, 0) / allP99.length : 0;

  return {
    avgQueryTime: Math.round(avgQueryTime),
    avgEdgeFunctionTime: Math.round(avgEdgeFunctionTime),
    errorRate: Math.round(errorRate * 100) / 100,
    p99Latency: Math.round(p99Latency),
    timestamp: new Date().toISOString(),
  };
}

export async function markRecommendationImplemented(
  userId: string,
  recommendation: {
    title: string;
    category: string;
    priority: string;
    action: string;
    affectedOperations: string[];
  },
  notes?: string
): Promise<ImplementedRecommendation> {
  if (!userId) throw new Error('Not authenticated');

  const baselineMetrics = await captureCurrentMetrics();

  const { data, error } = await supabase
    .from('implemented_recommendations')
    .insert({
      user_id: userId,
      recommendation_title: recommendation.title,
      recommendation_category: recommendation.category,
      recommendation_priority: recommendation.priority,
      recommendation_action: recommendation.action,
      affected_operations: recommendation.affectedOperations,
      baseline_metrics: baselineMetrics as unknown as Json,
      notes,
      status: 'implemented',
    })
    .select()
    .single();

  if (error) throw error;

  const adapted = toImplementedRecommendation(data);
  return {
    ...adapted,
    affected_operations: adapted.affected_operations ?? [],
    status: adapted.status as ImplementedRecommendation['status'],
  };
}

export async function measureRecommendationImpact(
  recommendationId: string
): Promise<ImplementedRecommendation> {
  const postMetrics = await captureCurrentMetrics();

  const { data: existing, error: fetchError } = await supabase
    .from('implemented_recommendations')
    .select('*')
    .eq('id', recommendationId)
    .single();

  if (fetchError) throw fetchError;

  const existingAdapted = toImplementedRecommendation(existing);
  const baseline = existingAdapted.baseline_metrics;

  const queryImprovement =
    baseline.avgQueryTime > 0
      ? ((baseline.avgQueryTime - postMetrics.avgQueryTime) / baseline.avgQueryTime) * 100
      : 0;
  const edgeImprovement =
    baseline.avgEdgeFunctionTime > 0
      ? ((baseline.avgEdgeFunctionTime - postMetrics.avgEdgeFunctionTime) /
          baseline.avgEdgeFunctionTime) *
        100
      : 0;
  const errorImprovement =
    baseline.errorRate > 0
      ? ((baseline.errorRate - postMetrics.errorRate) / baseline.errorRate) * 100
      : 0;

  const avgImprovement = (queryImprovement + edgeImprovement + errorImprovement) / 3;

  const { data, error } = await supabase
    .from('implemented_recommendations')
    .update({
      post_metrics: postMetrics as unknown as Json,
      measured_at: new Date().toISOString(),
      improvement_percent: Math.round(avgImprovement * 100) / 100,
      status: 'measured',
    })
    .eq('id', recommendationId)
    .select()
    .single();

  if (error) throw error;

  const adapted = toImplementedRecommendation(data);
  return {
    ...adapted,
    affected_operations: adapted.affected_operations ?? [],
    status: adapted.status as ImplementedRecommendation['status'],
  };
}

export async function getImplementedRecommendations(): Promise<ImplementedRecommendation[]> {
  const { data, error } = await supabase
    .from('implemented_recommendations')
    .select('*')
    .order('implemented_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const adapted = toImplementedRecommendation(row);
    return {
      ...adapted,
      affected_operations: adapted.affected_operations ?? [],
      status: adapted.status as ImplementedRecommendation['status'],
    };
  });
}

export async function deleteImplementedRecommendation(id: string): Promise<void> {
  const { error } = await supabase.from('implemented_recommendations').delete().eq('id', id);

  if (error) throw error;
}
