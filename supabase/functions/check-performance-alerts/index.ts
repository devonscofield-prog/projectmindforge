import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Threshold definitions
const THRESHOLDS = {
  query: {
    warning: 1000, // ms
    critical: 2000, // ms
  },
  edge_function: {
    warning: 5000, // ms
    critical: 10000, // ms
  },
  error_rate: {
    warning: 3, // %
    critical: 10, // %
  },
};

interface HealthMetric {
  metric_type: string;
  metric_value: number;
  threshold_value: number;
  status: "healthy" | "warning" | "critical";
}

function evaluateHealth(
  metricType: keyof typeof THRESHOLDS,
  value: number
): HealthMetric {
  const thresholds = THRESHOLDS[metricType];
  let status: "healthy" | "warning" | "critical" = "healthy";
  let threshold = 0;

  if (value >= thresholds.critical) {
    status = "critical";
    threshold = thresholds.critical;
  } else if (value >= thresholds.warning) {
    status = "warning";
    threshold = thresholds.warning;
  }

  return {
    metric_type: metricType,
    metric_value: value,
    threshold_value: threshold || thresholds.warning,
    status,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking performance metrics for alerts...");

    // Get performance summary from last hour
    const { data: summaryData, error: summaryError } = await supabase.rpc(
      "get_performance_summary",
      { p_hours: 1 }
    );

    if (summaryError) {
      console.error("Error fetching performance summary:", summaryError);
      throw summaryError;
    }

    // Calculate aggregate metrics
    let avgQueryTime = 0;
    let avgEdgeFunctionTime = 0;
    let overallErrorRate = 0;
    let queryCount = 0;
    let edgeFunctionCount = 0;
    let totalCount = 0;
    let totalErrors = 0;

    for (const row of summaryData || []) {
      const typedRow = row as {
        metric_type: string;
        avg_duration_ms: number;
        total_count: number;
        error_count: number;
      };
      
      if (typedRow.metric_type === "query") {
        avgQueryTime += typedRow.avg_duration_ms * typedRow.total_count;
        queryCount += typedRow.total_count;
      } else if (typedRow.metric_type === "edge_function") {
        avgEdgeFunctionTime += typedRow.avg_duration_ms * typedRow.total_count;
        edgeFunctionCount += typedRow.total_count;
      }
      totalCount += typedRow.total_count;
      totalErrors += typedRow.error_count;
    }

    if (queryCount > 0) avgQueryTime /= queryCount;
    if (edgeFunctionCount > 0) avgEdgeFunctionTime /= edgeFunctionCount;
    if (totalCount > 0) overallErrorRate = (totalErrors / totalCount) * 100;

    // Evaluate health for each metric
    const healthMetrics: HealthMetric[] = [
      evaluateHealth("query", avgQueryTime),
      evaluateHealth("edge_function", avgEdgeFunctionTime),
      evaluateHealth("error_rate", overallErrorRate),
    ];

    // Check if any metrics need alerting
    const criticalMetrics = healthMetrics.filter((m) => m.status === "critical");
    const warningMetrics = healthMetrics.filter((m) => m.status === "warning");

    console.log(`Health check: ${criticalMetrics.length} critical, ${warningMetrics.length} warning`);

    if (criticalMetrics.length === 0 && warningMetrics.length === 0) {
      console.log("All metrics healthy, no alerts needed");
      return new Response(
        JSON.stringify({ status: "healthy", alerts_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all enabled alert configs
    const { data: configs, error: configError } = await supabase
      .from("performance_alert_config")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      console.error("Error fetching alert configs:", configError);
      throw configError;
    }

    if (!configs || configs.length === 0) {
      console.log("No alert configs found");
      return new Response(
        JSON.stringify({ status: "no_configs", alerts_sent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let alertsSent = 0;

    for (const config of configs) {
      // Determine which metrics to alert on based on config
      let metricsToAlert: HealthMetric[] = [];
      let alertType: "warning" | "critical" | null = null;

      if (criticalMetrics.length > 0 && config.alert_on_critical) {
        metricsToAlert = criticalMetrics;
        alertType = "critical";
      } else if (warningMetrics.length > 0 && config.alert_on_warning) {
        metricsToAlert = warningMetrics;
        alertType = "warning";
      }

      if (!alertType || metricsToAlert.length === 0) {
        continue;
      }

      // Check cooldown - don't send if we sent the same alert type recently
      const cooldownHours = config.cooldown_hours || 4;
      const cooldownTime = new Date();
      cooldownTime.setHours(cooldownTime.getHours() - cooldownHours);

      const { data: recentAlerts } = await supabase
        .from("performance_alert_history")
        .select("id")
        .eq("config_id", config.id)
        .eq("alert_type", alertType)
        .gte("sent_at", cooldownTime.toISOString())
        .limit(1);

      if (recentAlerts && recentAlerts.length > 0) {
        console.log(`Skipping alert for ${config.email} - in cooldown period`);
        continue;
      }

      // Send the alert
      console.log(`Sending ${alertType} alert to ${config.email}`);

      const { error: sendError } = await supabase.functions.invoke(
        "send-performance-alert",
        {
          body: {
            config_id: config.id,
            email: config.email,
            alert_type: alertType,
            metrics: metricsToAlert,
          },
        }
      );

      if (sendError) {
        console.error(`Error sending alert to ${config.email}:`, sendError);
      } else {
        alertsSent++;
      }
    }

    const duration = Date.now() - startTime;
    console.log(`check-performance-alerts completed in ${duration}ms, sent ${alertsSent} alerts`);

    return new Response(
      JSON.stringify({
        status: criticalMetrics.length > 0 ? "critical" : "warning",
        alerts_sent: alertsSent,
        metrics: healthMetrics,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in check-performance-alerts:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
