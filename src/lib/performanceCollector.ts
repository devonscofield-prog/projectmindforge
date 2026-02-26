import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

// Thresholds for flagging slow operations
const SLOW_QUERY_THRESHOLD_MS = 2000;
const SLOW_EDGE_FUNCTION_THRESHOLD_MS = 5000;

interface MetricEntry {
  metric_type: string;
  metric_name: string;
  duration_ms: number;
  status: string;
  user_id?: string | null;
  metadata?: Json;
}

// Queue metrics for batching
let metricsQueue: MetricEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function getMetricNameFromQueryKey(queryKey: unknown): string {
  const keyParts = Array.isArray(queryKey) ? queryKey : [queryKey];
  const stringParts = keyParts.filter((part): part is string => typeof part === 'string');

  if (stringParts.length === 0) return 'unknown';

  // SDR keys are hierarchical (e.g. ['sdr', 'calls', 'list', {...}]).
  // Keep a stable, descriptive prefix instead of collapsing to just 'sdr'.
  if (stringParts[0] === 'sdr') {
    return stringParts.slice(0, 3).join('.');
  }

  return stringParts[0];
}

/**
 * Get current user ID from Supabase session
 */
async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * Flush queued metrics to the database
 */
async function flushMetrics(): Promise<void> {
  if (metricsQueue.length === 0) return;
  
  const metricsToSend = [...metricsQueue];
  metricsQueue = [];
  
  try {
    const userId = await getCurrentUserId();
    
    const metricsWithUser = metricsToSend.map(metric => ({
      metric_type: metric.metric_type,
      metric_name: metric.metric_name,
      duration_ms: metric.duration_ms,
      status: metric.status,
      user_id: metric.user_id || userId,
      metadata: metric.metadata,
    }));

    const { error } = await supabase
      .from('performance_metrics')
      .insert(metricsWithUser);

    if (error) {
      console.warn('[PerformanceCollector] Failed to save metrics:', error);
    }
  } catch (err) {
    console.warn('[PerformanceCollector] Error flushing metrics:', err);
  }
}

/**
 * Schedule a flush of metrics (batches within 30 seconds)
 */
function scheduleFlush(): void {
  if (flushTimeout) return;
  
  flushTimeout = setTimeout(() => {
    flushTimeout = null;
    flushMetrics();
  }, 30000); // Flush every 30 seconds
}

/**
 * Queue a metric for batching and sending
 */
export function queueMetric(entry: MetricEntry): void {
  metricsQueue.push(entry);
  scheduleFlush();
  
  // Log slow operations to console in development
  if (import.meta.env.DEV) {
    if (entry.metric_type === 'query' && entry.duration_ms > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[SLOW QUERY] ${entry.metric_name}: ${entry.duration_ms}ms`);
    } else if (entry.metric_type === 'edge_function' && entry.duration_ms > SLOW_EDGE_FUNCTION_THRESHOLD_MS) {
      console.warn(`[SLOW EDGE FUNCTION] ${entry.metric_name}: ${entry.duration_ms}ms`);
    }
  }
}

/**
 * Track query performance from React Query
 */
export function trackQueryPerformance(
  queryKey: unknown,
  duration: number,
  status: 'success' | 'error',
  errorMessage?: string
): void {
  const keyString = getMetricNameFromQueryKey(queryKey);
  
  queueMetric({
    metric_type: 'query',
    metric_name: keyString,
    duration_ms: Math.round(duration),
    status,
    metadata: {
      full_key: JSON.stringify(queryKey).slice(0, 200),
      ...(errorMessage && { error: errorMessage.slice(0, 500) }),
    } as Json,
  });
}

/**
 * Track edge function performance
 */
export function trackEdgeFunctionPerformance(
  functionName: string,
  duration: number,
  status: 'success' | 'error' | 'timeout',
  metadata?: Json
): void {
  queueMetric({
    metric_type: 'edge_function',
    metric_name: functionName,
    duration_ms: Math.round(duration),
    status,
    metadata,
  });
}

/**
 * Track page load performance
 */
export function trackPageLoad(
  pageName: string,
  duration: number
): void {
  queueMetric({
    metric_type: 'page_load',
    metric_name: pageName,
    duration_ms: Math.round(duration),
    status: 'success',
  });
}

/**
 * Wrapper to measure async function execution time
 */
export async function measureAsync<T>(
  metricType: 'query' | 'edge_function' | 'page_load',
  metricName: string,
  fn: () => Promise<T>,
  metadata?: Json
): Promise<T> {
  const startTime = performance.now();
  let status: 'success' | 'error' | 'timeout' = 'success';
  
  try {
    const result = await fn();
    return result;
  } catch (err) {
    status = 'error';
    throw err;
  } finally {
    const duration = performance.now() - startTime;
    queueMetric({
      metric_type: metricType,
      metric_name: metricName,
      duration_ms: Math.round(duration),
      status,
      metadata,
    });
  }
}

// Flush metrics on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (metricsQueue.length > 0) {
      // Use sendBeacon for reliable delivery on page unload
      const userId = null; // We can't get async data in beforeunload
      const _data = JSON.stringify({
        metrics: metricsQueue.map(m => ({ ...m, user_id: userId })),
      });
      
      // Note: This would require a separate endpoint that accepts beacon data
      // For now, just try to flush synchronously
      flushMetrics();
    }
  });
}

// Export thresholds for use in UI
export const PERFORMANCE_THRESHOLDS = {
  query: {
    good: 500,
    warning: 1500,
    critical: SLOW_QUERY_THRESHOLD_MS,
  },
  edgeFunction: {
    good: 3000,
    warning: 5000,
    critical: SLOW_EDGE_FUNCTION_THRESHOLD_MS,
  },
  pageLoad: {
    good: 1000,
    warning: 3000,
    critical: 5000,
  },
  errorRate: {
    good: 1,
    warning: 5,
    critical: 10,
  },
};
