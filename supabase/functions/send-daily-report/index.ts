import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReportConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  delivery_time: string;
  timezone: string;
  rep_ids: string[] | null;
  include_weekends: boolean;
}

interface CallData {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  potential_revenue: number | null;
  rep_id: string;
  rep_name: string;
  effectiveness_score: number | null;
}

interface RepSummary {
  name: string;
  callCount: number;
  avgScore: number;
  totalPipeline: number;
  scores: number[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MindForge Reports <reports@mindforgenotifications.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} ${errorText}`);
  }
  await response.text();
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const isTestMode = body.test === true;
    const testUserId = body.userId;
    const now = new Date();

    console.log(`[send-daily-report] Running at ${now.toISOString()}, testMode: ${isTestMode}`);

    if (isTestMode && testUserId) {
      return await processReport(supabase, testUserId, now, true);
    }

    // Fetch all enabled configs
    const { data: configs, error: configError } = await supabase
      .from("daily_report_configs")
      .select("*")
      .eq("enabled", true);

    if (configError) {
      console.error("[send-daily-report] Error fetching configs:", configError);
      return jsonResponse({ error: configError.message }, 500);
    }

    if (!configs || configs.length === 0) {
      return jsonResponse({ message: "No active report configs", sent: 0 });
    }

    // Filter to users whose local time matches delivery_time
    const usersToProcess: ReportConfig[] = [];
    for (const config of configs as ReportConfig[]) {
      try {
        const userLocal = new Date(now.toLocaleString("en-US", { timeZone: config.timezone }));
        const userHour = userLocal.getHours();
        const deliveryHour = parseInt(config.delivery_time.split(":")[0], 10);
        const dayOfWeek = userLocal.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Skip weekends (unless include_weekends and it's Monday — handled in report date logic)
        if (isWeekend && !config.include_weekends) continue;

        if (userHour === deliveryHour) {
          usersToProcess.push(config);
        }
      } catch {
        console.warn(`[send-daily-report] Invalid timezone for ${config.user_id}: ${config.timezone}`);
      }
    }

    if (usersToProcess.length === 0) {
      return jsonResponse({ message: "No users in current time window", sent: 0 });
    }

    let sentCount = 0;
    for (const config of usersToProcess) {
      try {
        await processReport(supabase, config.user_id, now, false, config);
        sentCount++;
        await new Promise((r) => setTimeout(r, 100));
      } catch (err) {
        console.error(`[send-daily-report] Failed for user ${config.user_id}:`, err);
      }
    }

    return jsonResponse({ success: true, sent: sentCount });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-daily-report] Unexpected error:", error);
    return jsonResponse({ error: msg }, 500);
  }
};

async function processReport(
  supabase: AnyClient,
  userId: string,
  now: Date,
  isTestMode: boolean,
  existingConfig?: ReportConfig
): Promise<Response> {
  // Get config if not provided
  let config = existingConfig;
  if (!config) {
    const { data } = await supabase
      .from("daily_report_configs")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    config = (data as ReportConfig) || {
      id: "",
      user_id: userId,
      enabled: true,
      delivery_time: "08:00",
      timezone: "America/New_York",
      rep_ids: null,
      include_weekends: false,
    };
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email")
    .eq("id", userId)
    .single();

  if (!profile) {
    return jsonResponse({ error: "User profile not found" }, 404);
  }

  // Determine target rep IDs
  let targetRepIds: string[] = [];
  if (config.rep_ids && config.rep_ids.length > 0) {
    targetRepIds = config.rep_ids;
  } else {
    // Get all team member IDs for this manager
    const { data: teams } = await supabase
      .from("teams")
      .select("id")
      .eq("manager_id", userId);

    const teamIds = (teams || []).map((t: any) => t.id);

    if (teamIds.length > 0) {
      const { data: members } = await supabase
        .from("profiles")
        .select("id")
        .in("team_id", teamIds)
        .eq("is_active", true);
      targetRepIds = (members || []).map((m: any) => m.id);
    }

    // For admins with no team, check role and get all reps
    if (targetRepIds.length === 0) {
      const { data: role } = await supabase.rpc("get_user_role", { _user_id: userId });
      if (role === "admin") {
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("is_active", true);
        targetRepIds = (allProfiles || []).map((p: any) => p.id);
      }
    }
  }

  if (targetRepIds.length === 0) {
    const msg = "No reps configured for report";
    console.log(`[send-daily-report] ${msg} for user ${userId}`);
    return jsonResponse({ success: true, message: msg, sent: 0 });
  }

  // Determine the report date range (yesterday, or Fri+Sat+Sun for Monday with weekends)
  const userLocal = new Date(now.toLocaleString("en-US", { timeZone: config.timezone }));
  const dayOfWeek = userLocal.getDay();
  
  let daysBack = 1;
  if (dayOfWeek === 1 && config.include_weekends) {
    daysBack = 3; // Monday: cover Fri, Sat, Sun
  }

  const reportEnd = new Date(userLocal);
  reportEnd.setHours(0, 0, 0, 0);
  const reportStart = new Date(reportEnd);
  reportStart.setDate(reportStart.getDate() - daysBack);

  const startDate = reportStart.toISOString().split("T")[0];
  const endDate = reportEnd.toISOString().split("T")[0];

  console.log(`[send-daily-report] Querying calls from ${startDate} to ${endDate} for ${targetRepIds.length} reps`);

  // Fetch calls with analysis data
  const { data: callsRaw, error: callsError } = await supabase
    .from("call_transcripts")
    .select(`
      id, call_date, account_name, call_type, potential_revenue, rep_id,
      profiles!call_transcripts_rep_id_fkey(name),
      ai_call_analysis(call_effectiveness_score)
    `)
    .in("rep_id", targetRepIds)
    .gte("call_date", startDate)
    .lt("call_date", endDate)
    .is("deleted_at", null)
    .order("call_date", { ascending: false });

  if (callsError) {
    console.error("[send-daily-report] Error fetching calls:", callsError);
    return jsonResponse({ error: callsError.message }, 500);
  }

  const calls: CallData[] = (callsRaw || []).map((c: any) => ({
    id: c.id,
    call_date: c.call_date,
    account_name: c.account_name,
    call_type: c.call_type,
    potential_revenue: c.potential_revenue,
    rep_id: c.rep_id,
    rep_name: c.profiles?.name || "Unknown",
    effectiveness_score: c.ai_call_analysis?.[0]?.call_effectiveness_score ?? null,
  }));

  // Build per-rep summaries
  const repMap: Record<string, RepSummary> = {};
  for (const call of calls) {
    if (!repMap[call.rep_id]) {
      repMap[call.rep_id] = { name: call.rep_name, callCount: 0, avgScore: 0, totalPipeline: 0, scores: [] };
    }
    const rep = repMap[call.rep_id];
    rep.callCount++;
    rep.totalPipeline += call.potential_revenue || 0;
    if (call.effectiveness_score !== null) rep.scores.push(call.effectiveness_score);
  }

  for (const rep of Object.values(repMap)) {
    rep.avgScore = rep.scores.length > 0 ? rep.scores.reduce((a, b) => a + b, 0) / rep.scores.length : 0;
  }

  const totalCalls = calls.length;
  const allScores = calls.map(c => c.effectiveness_score).filter((s): s is number => s !== null);
  const avgEffectiveness = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const totalPipeline = calls.reduce((sum, c) => sum + (c.potential_revenue || 0), 0);

  // Top performers & needs attention
  const repList = Object.values(repMap).filter(r => r.scores.length > 0).sort((a, b) => b.avgScore - a.avgScore);
  const topPerformers = repList.filter(r => r.avgScore >= 7).slice(0, 3);
  const needsAttention = repList.filter(r => r.avgScore < 5).slice(0, 3);

  // Get custom domain for dashboard link
  const customDomain = Deno.env.get("CUSTOM_DOMAIN") || Deno.env.get("STORMWIND_DOMAIN") || "";
  const dashboardUrl = customDomain ? `https://${customDomain}` : "";

  // Build and send email
  const dateLabel = daysBack > 1 ? `${startDate} – ${endDate}` : startDate;
  const emailHtml = buildEmailHtml({
    dateLabel,
    totalCalls,
    avgEffectiveness,
    totalPipeline,
    topPerformers,
    needsAttention,
    repBreakdown: Object.values(repMap).sort((a, b) => b.avgScore - a.avgScore),
    dashboardUrl,
    isTestMode,
    recipientName: profile.name,
  });

  const subject = isTestMode
    ? `🧪 [TEST] Daily Call Report – ${dateLabel}`
    : `📊 Daily Call Report – ${dateLabel}`;

  await sendEmail(profile.email, subject, emailHtml);
  console.log(`[send-daily-report] Email sent to ${profile.email} (${totalCalls} calls)`);

  // Log to notification_log
  await supabase.from("notification_log").insert({
    user_id: userId,
    channel: "email",
    notification_type: "daily_call_report",
    title: subject,
    summary: `${totalCalls} calls, avg score ${avgEffectiveness.toFixed(1)}, $${totalPipeline.toLocaleString()} pipeline`,
    task_count: totalCalls,
  });

  return jsonResponse({
    success: true,
    sent: 1,
    message: `Report sent with ${totalCalls} calls`,
    totalCalls,
    avgEffectiveness: Math.round(avgEffectiveness * 10) / 10,
    totalPipeline,
  });
}

interface EmailParams {
  dateLabel: string;
  totalCalls: number;
  avgEffectiveness: number;
  totalPipeline: number;
  topPerformers: RepSummary[];
  needsAttention: RepSummary[];
  repBreakdown: RepSummary[];
  dashboardUrl: string;
  isTestMode: boolean;
  recipientName: string;
}

function buildEmailHtml(params: EmailParams): string {
  const {
    dateLabel, totalCalls, avgEffectiveness, totalPipeline,
    topPerformers, needsAttention, repBreakdown, dashboardUrl, isTestMode, recipientName,
  } = params;

  const testBanner = isTestMode ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <strong>🧪 This is a test report</strong> — Your daily report system is working correctly!
    </div>
  ` : "";

  const formatCurrency = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const scoreColor = (s: number) => s >= 7 ? "#16a34a" : s >= 5 ? "#ca8a04" : "#dc2626";

  const topPerformerRows = topPerformers.length > 0
    ? topPerformers.map(r => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${scoreColor(r.avgScore)};font-weight:600;">${r.avgScore.toFixed(1)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.callCount}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding:12px;color:#6b7280;text-align:center;">No standout performers today</td></tr>`;

  const attentionRows = needsAttention.length > 0
    ? needsAttention.map(r => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.name}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${scoreColor(r.avgScore)};font-weight:600;">${r.avgScore.toFixed(1)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.callCount}</td>
        </tr>
      `).join("")
    : `<tr><td colspan="3" style="padding:12px;color:#6b7280;text-align:center;">No calls flagged for attention</td></tr>`;

  const breakdownRows = repBreakdown.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.callCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;color:${scoreColor(r.avgScore)};font-weight:600;">${r.scores.length > 0 ? r.avgScore.toFixed(1) : "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.totalPipeline > 0 ? formatCurrency(r.totalPipeline) : "—"}</td>
    </tr>
  `).join("");

  const dashboardLink = dashboardUrl
    ? `<div style="text-align:center;margin-top:24px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Full Dashboard →</a>
       </div>`
    : "";

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        ${testBanner}

        <!-- Header -->
        <div style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:12px 12px 0 0;padding:24px 32px;color:white;">
          <h1 style="margin:0;font-size:22px;">📊 Daily Call Report</h1>
          <p style="margin:8px 0 0;opacity:0.9;font-size:14px;">${dateLabel}</p>
          <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">Hi ${recipientName}</p>
        </div>

        <div style="background:white;border-radius:0 0 12px 12px;padding:32px;border:1px solid #e5e7eb;border-top:none;">

          <!-- Summary Stats -->
          <div style="display:flex;gap:16px;margin-bottom:32px;">
            <div style="flex:1;background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#1e40af;">${totalCalls}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Calls Analyzed</div>
            </div>
            <div style="flex:1;background:#f0fdf4;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:${scoreColor(avgEffectiveness)};">${avgEffectiveness.toFixed(1)}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Avg Effectiveness</div>
            </div>
            <div style="flex:1;background:#fefce8;border-radius:8px;padding:16px;text-align:center;">
              <div style="font-size:28px;font-weight:700;color:#ca8a04;">${formatCurrency(totalPipeline)}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:4px;">Est. Pipeline</div>
            </div>
          </div>

          ${totalCalls === 0 ? `
            <p style="text-align:center;color:#6b7280;padding:24px 0;">No calls recorded for this period.</p>
          ` : `
            <!-- Top Performers -->
            <h2 style="font-size:16px;margin:0 0 12px;color:#16a34a;">🏆 Top Performers</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Rep</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Avg Score</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Calls</th>
              </tr></thead>
              <tbody>${topPerformerRows}</tbody>
            </table>

            <!-- Needs Attention -->
            <h2 style="font-size:16px;margin:0 0 12px;color:#dc2626;">⚠️ Needs Attention</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Rep</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Avg Score</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Calls</th>
              </tr></thead>
              <tbody>${attentionRows}</tbody>
            </table>

            <!-- Full Breakdown -->
            <h2 style="font-size:16px;margin:0 0 12px;">📋 Rep Breakdown</h2>
            <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
              <thead><tr style="background:#f9fafb;">
                <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Rep</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Calls</th>
                <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Avg Score</th>
                <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Pipeline</th>
              </tr></thead>
              <tbody>${breakdownRows}</tbody>
            </table>
          `}

          ${dashboardLink}
        </div>

        <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
          Sent by MindForge · Manage this report in Settings → Daily Call Report
        </p>
      </div>
    </body>
    </html>
  `;
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(handler);
