import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

// Thresholds for real-time alerts (queries only - edge functions use error/timeout detection)
const THRESHOLDS = {
  query: { warning: 1500, critical: 3000 },
};

interface PerformanceMetric {
  id: string;
  metric_type: string;
  metric_name: string;
  duration_ms: number;
  status: string;
  created_at: string;
}

/**
 * Hook that listens for real-time performance metrics and shows toast notifications
 * when thresholds are exceeded. Only active for admin users.
 */
export function usePerformanceAlertToasts() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const lastAlertRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel('performance-alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'performance_metrics',
        },
        (payload) => {
          const metric = payload.new as PerformanceMetric;
          checkAndAlert(metric);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin]);

  function checkAndAlert(metric: PerformanceMetric) {
    const { metric_type, metric_name, duration_ms, status } = metric;
    
    // Alert on errors
    if (status === 'error') {
      showAlertToast('error', metric_name, 'Error occurred', duration_ms);
      return;
    }

    // Alert on timeouts
    if (status === 'timeout') {
      showAlertToast('critical', metric_name, 'Operation timed out', duration_ms);
      return;
    }

    // For queries only, check duration thresholds
    // Edge functions (AI agents) are expected to take 30-60s, so no duration alerts for them
    if (metric_type === 'query') {
      const thresholds = THRESHOLDS.query;

      // Cooldown: don't spam the same alert
      const alertKey = `${metric_type}-${metric_name}`;
      const now = Date.now();
      const lastAlert = lastAlertRef.current[alertKey] || 0;
      if (now - lastAlert < 60000) return; // 1 minute cooldown

      if (duration_ms >= thresholds.critical) {
        lastAlertRef.current[alertKey] = now;
        showAlertToast('critical', metric_name, 'Critical slowdown detected', duration_ms);
      } else if (duration_ms >= thresholds.warning) {
        lastAlertRef.current[alertKey] = now;
        showAlertToast('warning', metric_name, 'Performance warning', duration_ms);
      }
    }
  }

  function showAlertToast(
    level: 'warning' | 'critical' | 'error',
    metricName: string,
    message: string,
    durationMs: number
  ) {
    const formattedDuration = durationMs >= 1000 
      ? `${(durationMs / 1000).toFixed(1)}s` 
      : `${durationMs}ms`;

    if (level === 'critical' || level === 'error') {
      toast.error(`${message}: ${metricName}`, {
        description: `Duration: ${formattedDuration}`,
        action: {
          label: 'View',
          onClick: () => window.location.href = '/admin/performance',
        },
      });
    } else {
      toast.warning(`${message}: ${metricName}`, {
        description: `Duration: ${formattedDuration}`,
      });
    }
  }
}
