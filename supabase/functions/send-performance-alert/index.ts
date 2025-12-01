import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AlertMetric {
  metric_type: string;
  metric_value: number;
  threshold_value: number;
  status: string;
}

interface AlertRequest {
  config_id: string;
  email: string;
  alert_type: "warning" | "critical";
  metrics: AlertMetric[];
  dashboard_url?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { config_id, email, alert_type, metrics, dashboard_url }: AlertRequest = await req.json();

    console.log(`Sending ${alert_type} alert to ${email} for ${metrics.length} metrics`);

    // Build email content
    const statusColor = alert_type === "critical" ? "#dc2626" : "#f59e0b";
    const statusLabel = alert_type === "critical" ? "🚨 CRITICAL" : "⚠️ WARNING";

    const metricsHtml = metrics.map((m: AlertMetric) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.metric_type}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: ${statusColor};">${m.metric_value.toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${m.threshold_value}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
          <span style="background: ${statusColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${m.status}</span>
        </td>
      </tr>
    `).join("");

    const recommendations = alert_type === "critical" 
      ? `
        <h3 style="color: #374151; margin-top: 24px;">Recommended Actions:</h3>
        <ul style="color: #6b7280; line-height: 1.8;">
          <li>Review recent code deployments for performance regressions</li>
          <li>Check database query performance and add indexes if needed</li>
          <li>Consider scaling your instance if load is consistently high</li>
          <li>Review edge function logs for errors or timeouts</li>
        </ul>
      `
      : `
        <h3 style="color: #374151; margin-top: 24px;">Recommended Actions:</h3>
        <ul style="color: #6b7280; line-height: 1.8;">
          <li>Monitor the situation for further degradation</li>
          <li>Review slow queries in the performance dashboard</li>
          <li>Consider optimizing frequently-used queries</li>
        </ul>
      `;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: ${statusColor}; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">${statusLabel} Performance Alert</h1>
            <p style="margin: 8px 0 0; opacity: 0.9;">Your system requires attention</p>
          </div>
          
          <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #111827; margin-top: 0;">Performance Metrics Exceeded Thresholds</h2>
            
            <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <thead>
                <tr style="background: #f3f4f6;">
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Metric</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Current</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Threshold</th>
                  <th style="padding: 12px; text-align: left; font-weight: 600; color: #374151;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${metricsHtml}
              </tbody>
            </table>
            
            ${recommendations}
            
            ${dashboard_url ? `
              <div style="margin-top: 24px; text-align: center;">
                <a href="${dashboard_url}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                  View Performance Dashboard →
                </a>
              </div>
            ` : ""}
            
            <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; text-align: center;">
              This alert was sent because you have performance monitoring enabled.<br>
              You can adjust your alert settings in the admin dashboard.
            </p>
          </div>
        </body>
      </html>
    `;

    // Send email via Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Performance Monitor <onboarding@resend.dev>",
        to: [email],
        subject: `${statusLabel} Performance Alert - Action Required`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Resend API error: ${errorText}`);
    }

    const emailResult = await emailResponse.json();
    console.log("Email sent successfully:", emailResult);

    // Record in alert history
    for (const metric of metrics) {
      await supabase.from("performance_alert_history").insert({
        config_id,
        alert_type,
        metric_type: metric.metric_type,
        metric_value: metric.metric_value,
        threshold_value: metric.threshold_value,
        email_sent_to: email,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`send-performance-alert completed in ${duration}ms`);

    return new Response(
      JSON.stringify({ success: true, email_id: emailResult?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-performance-alert:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
