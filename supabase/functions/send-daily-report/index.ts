import { createClient, SupabaseClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ReportSections {
  summary_stats: boolean;
  wow_trends: boolean;
  best_deal: boolean;
  label_breakdown: boolean;
  close_month_breakdown: boolean;
  pipeline_integrity: boolean;
  rep_breakdown: boolean;
}

const DEFAULT_SECTIONS: ReportSections = {
  summary_stats: true, wow_trends: true, best_deal: true, label_breakdown: true,
  close_month_breakdown: true, pipeline_integrity: true, rep_breakdown: true,
};

interface ReportConfig {
  id: string;
  user_id: string;
  enabled: boolean;
  delivery_time: string;
  timezone: string;
  rep_ids: string[] | null;
  include_weekends: boolean;
  report_sections: ReportSections | null;
}

interface CallData {
  id: string;
  call_date: string;
  account_name: string | null;
  call_type: string | null;
  potential_revenue: number | null;
  estimated_opportunity_size: number | null;
  opportunity_label: string | null;
  target_close_date: string | null;
  rep_id: string;
  rep_name: string;
  effectiveness_score: number | null;
  summary: string | null;
}

interface RepSummary {
  name: string;
  callCount: number;
  totalOppSize: number;
  commitTotal: number;
  bestCaseTotal: number;
  pipelineTotal: number;
  timeWasterTotal: number;
}

interface LabelBucket {
  label: string;
  displayLabel: string;
  calls: number;
  totalOppSize: number;
}

interface MonthBucket {
  monthKey: string;
  displayMonth: string;
  totalOppSize: number;
  dealCount: number;
}

interface IntegrityFlag {
  repName: string;
  issues: string[];
}

interface TrendData {
  prevTotalCalls: number;
  prevTotalOppSize: number;
  hasPrevData: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = SupabaseClient<any, any, any>;

/** Extract effectiveness score: prefer legacy column, fall back to analysis_behavior.overall_score */
function getEffectivenessScore(analysis: any): number | null {
  if (!analysis) return null;
  if (analysis.call_effectiveness_score != null) return Number(analysis.call_effectiveness_score);
  try {
    const behavior = typeof analysis.analysis_behavior === "string"
      ? JSON.parse(analysis.analysis_behavior)
      : analysis.analysis_behavior;
    if (behavior?.overall_score != null) return Number(behavior.overall_score);
  } catch { /* ignore parse errors */ }
  return null;
}

/** Extract call summary from analysis */
function getCallSummary(analysis: any): string | null {
  if (!analysis) return null;
  // Try call_summary first (direct column)
  if (analysis.call_summary) return analysis.call_summary;
  // Fall back to analysis_metadata.summary
  if (!analysis.analysis_metadata) return null;
  try {
    const meta = typeof analysis.analysis_metadata === "string"
      ? JSON.parse(analysis.analysis_metadata)
      : analysis.analysis_metadata;
    return meta?.summary || null;
  } catch { return null; }
}

/** Generate HMAC token for unsubscribe links */
async function generateUnsubscribeToken(userId: string): Promise<string> {
  const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(userId));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, "0")).join("");
  return btoa(JSON.stringify({ uid: userId, sig: sigHex }));
}

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
        const hourStart = new Date(now);
        hourStart.setMinutes(0, 0, 0);
        hourStart.setMilliseconds(0);

        const { data: existing } = await supabase
          .from("notification_log")
          .select("id")
          .eq("user_id", config.user_id)
          .eq("notification_type", "daily_call_report")
          .gte("sent_at", hourStart.toISOString())
          .limit(1);

        if (existing && existing.length > 0) {
          console.log(`[send-daily-report] Skipping user ${config.user_id} — already sent this hour`);
          continue;
        }

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

async function fetchCallsForPeriod(
  supabase: AnyClient,
  targetRepIds: string[],
  startDate: string,
  endDate: string
): Promise<CallData[]> {
  const { data: callsRaw, error } = await supabase
    .from("call_transcripts")
    .select(`
      id, call_date, account_name, call_type, potential_revenue,
      estimated_opportunity_size, opportunity_label, target_close_date,
      rep_id,
      profiles!call_transcripts_rep_id_fkey(name),
      ai_call_analysis(call_effectiveness_score, call_summary, analysis_behavior, analysis_metadata)
    `)
    .in("rep_id", targetRepIds)
    .gte("call_date", startDate)
    .lt("call_date", endDate)
    .is("deleted_at", null)
    .order("call_date", { ascending: false });

  if (error) {
    console.error("[send-daily-report] Error fetching calls:", error);
    return [];
  }

  return (callsRaw || []).map((c: any) => {
    const analysis = c.ai_call_analysis?.[0] || null;
    return {
      id: c.id,
      call_date: c.call_date,
      account_name: c.account_name,
      call_type: c.call_type,
      potential_revenue: c.potential_revenue,
      estimated_opportunity_size: c.estimated_opportunity_size,
      opportunity_label: c.opportunity_label,
      target_close_date: c.target_close_date,
      rep_id: c.rep_id,
      rep_name: c.profiles?.name || "Unknown",
      effectiveness_score: getEffectivenessScore(analysis),
      summary: getCallSummary(analysis),
    };
  });
}

async function processReport(
  supabase: AnyClient,
  userId: string,
  now: Date,
  isTestMode: boolean,
  existingConfig?: ReportConfig
): Promise<Response> {
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
      delivery_time: "17:00",
      timezone: "America/New_York",
      rep_ids: null,
      include_weekends: false,
      report_sections: null,
    };
  }

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

  // Determine the report date range
  const userLocal = new Date(now.toLocaleString("en-US", { timeZone: config.timezone }));
  const dayOfWeek = userLocal.getDay();

  const reportEnd = new Date(userLocal);
  reportEnd.setHours(23, 59, 59, 999);
  const reportStart = new Date(userLocal);
  reportStart.setHours(0, 0, 0, 0);

  if (dayOfWeek === 1) {
    reportStart.setDate(reportStart.getDate() - 3);
  }

  const startDate = reportStart.toISOString().split("T")[0];
  const endDateObj = new Date(userLocal);
  endDateObj.setDate(endDateObj.getDate() + 1);
  endDateObj.setHours(0, 0, 0, 0);
  const endDate = endDateObj.toISOString().split("T")[0];

  console.log(`[send-daily-report] Querying calls from ${startDate} to ${endDate} for ${targetRepIds.length} reps`);

  // WoW: previous period
  const prevStartDate = new Date(reportStart);
  prevStartDate.setDate(prevStartDate.getDate() - 7);
  const prevEndDate = new Date(endDateObj);
  prevEndDate.setDate(prevEndDate.getDate() - 7);

  const prevStartStr = prevStartDate.toISOString().split("T")[0];
  const prevEndStr = prevEndDate.toISOString().split("T")[0];

  const [calls, prevCalls] = await Promise.all([
    fetchCallsForPeriod(supabase, targetRepIds, startDate, endDate),
    fetchCallsForPeriod(supabase, targetRepIds, prevStartStr, prevEndStr),
  ]);

  // Build per-rep summaries (opportunity-centric)
  const repMap: Record<string, RepSummary> = {};
  for (const call of calls) {
    if (!repMap[call.rep_id]) {
      repMap[call.rep_id] = { name: call.rep_name, callCount: 0, totalOppSize: 0, commitTotal: 0, bestCaseTotal: 0, pipelineTotal: 0, timeWasterTotal: 0 };
    }
    const rep = repMap[call.rep_id];
    rep.callCount++;
    const oppSize = call.estimated_opportunity_size || 0;
    rep.totalOppSize += oppSize;
    switch (call.opportunity_label) {
      case "commit": rep.commitTotal += oppSize; break;
      case "best_case": rep.bestCaseTotal += oppSize; break;
      case "pipeline": rep.pipelineTotal += oppSize; break;
      case "time_waster": rep.timeWasterTotal += oppSize; break;
    }
  }

  const totalCalls = calls.length;
  const totalOppSize = calls.reduce((sum, c) => sum + (c.estimated_opportunity_size || 0), 0);

  // Previous period stats for WoW
  const prevTotalOppSize = prevCalls.reduce((sum, c) => sum + (c.estimated_opportunity_size || 0), 0);
  const trend: TrendData = {
    prevTotalCalls: prevCalls.length,
    prevTotalOppSize,
    hasPrevData: prevCalls.length > 0,
  };

  // Best Deal of the Day: highest opp size with commit or best_case label
  const bestDealCandidates = calls
    .filter(c => (c.opportunity_label === "commit" || c.opportunity_label === "best_case") && (c.estimated_opportunity_size || 0) > 0)
    .sort((a, b) => (b.estimated_opportunity_size || 0) - (a.estimated_opportunity_size || 0));
  const bestDeal = bestDealCandidates[0] || null;

  // Label breakdown
  const labelBuckets: LabelBucket[] = [
    { label: "commit", displayLabel: "Commit", calls: 0, totalOppSize: 0 },
    { label: "best_case", displayLabel: "Best Case", calls: 0, totalOppSize: 0 },
    { label: "pipeline", displayLabel: "Pipeline", calls: 0, totalOppSize: 0 },
    { label: "time_waster", displayLabel: "Time Waster", calls: 0, totalOppSize: 0 },
  ];
  for (const call of calls) {
    const bucket = labelBuckets.find(b => b.label === call.opportunity_label);
    if (bucket) {
      bucket.calls++;
      bucket.totalOppSize += call.estimated_opportunity_size || 0;
    }
  }

  // Close month breakdown
  const monthMap = new Map<string, MonthBucket>();
  for (const call of calls) {
    if (!call.target_close_date || !call.estimated_opportunity_size) continue;
    const d = new Date(call.target_close_date);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const displayMonth = d.toLocaleString("en-US", { month: "short", year: "numeric" });
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { monthKey, displayMonth, totalOppSize: 0, dealCount: 0 });
    }
    const bucket = monthMap.get(monthKey)!;
    bucket.totalOppSize += call.estimated_opportunity_size;
    bucket.dealCount++;
  }
  const monthBuckets = Array.from(monthMap.values()).sort((a, b) => a.monthKey.localeCompare(b.monthKey));

  // Pipeline integrity check
  const negativePhrases = ["objection", "not interested", "no budget", "postpone", "push back", "declined", "hesitant", "concern", "risk"];
  const integrityFlags: IntegrityFlag[] = [];

  const callsByRep = new Map<string, CallData[]>();
  for (const call of calls) {
    if (!callsByRep.has(call.rep_id)) callsByRep.set(call.rep_id, []);
    callsByRep.get(call.rep_id)!.push(call);
  }

  for (const [repId, repCalls] of callsByRep) {
    const repName = repMap[repId]?.name || "Unknown";
    const issues: string[] = [];

    for (const call of repCalls) {
      const oppSize = call.estimated_opportunity_size || 0;
      const label = call.opportunity_label;
      const account = call.account_name || "Unknown Account";

      // Flag: Commit label + low effectiveness score
      if (label === "commit" && call.effectiveness_score !== null && call.effectiveness_score < 50) {
        issues.push(`"Commit" on ${account} ($${oppSize.toLocaleString()}) scored ${Math.round(call.effectiveness_score)} — worth reviewing`);
      }
      // Flag: Commit/Best Case + negative keywords in summary
      else if ((label === "commit" || label === "best_case") && call.summary) {
        const summaryLower = call.summary.toLowerCase();
        const found = negativePhrases.find(phrase => summaryLower.includes(phrase));
        if (found) {
          issues.push(`"${label === "commit" ? "Commit" : "Best Case"}" on ${account} ($${oppSize.toLocaleString()}) — summary mentions "${found}"`);
        }
      }
    }

    integrityFlags.push({ repName, issues });
  }

  const customDomain = Deno.env.get("CUSTOM_DOMAIN") || Deno.env.get("STORMWIND_DOMAIN") || "";
  const dashboardUrl = customDomain ? `https://${customDomain}` : "";

  const unsubscribeToken = await generateUnsubscribeToken(userId);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const unsubscribeUrl = `${supabaseUrl}/functions/v1/unsubscribe-report?token=${encodeURIComponent(unsubscribeToken)}`;

  const isMondayLookback = dayOfWeek === 1;
  const todayStr = userLocal.toISOString().split("T")[0];
  const dateLabel = isMondayLookback ? `${startDate} – ${todayStr}` : todayStr;
  const sections: ReportSections = { ...DEFAULT_SECTIONS, ...(config.report_sections || {}) };

  const emailHtml = buildEmailHtml({
    dateLabel,
    totalCalls,
    totalOppSize,
    bestDeal,
    labelBuckets,
    monthBuckets,
    integrityFlags,
    repBreakdown: Object.values(repMap).sort((a, b) => b.totalOppSize - a.totalOppSize),
    dashboardUrl,
    isTestMode,
    recipientName: profile.name,
    trend,
    unsubscribeUrl,
    sections,
  });

  const subject = isTestMode
    ? `🧪 [TEST] Daily Call Report – ${dateLabel}`
    : `📊 Daily Call Report – ${dateLabel}`;

  await sendEmail(profile.email, subject, emailHtml);
  console.log(`[send-daily-report] Email sent to ${profile.email} (${totalCalls} calls, $${totalOppSize.toLocaleString()} opp size)`);

  await supabase.from("notification_log").insert({
    user_id: userId,
    channel: "email",
    notification_type: "daily_call_report",
    title: subject,
    summary: `${totalCalls} calls, $${totalOppSize.toLocaleString()} total opportunity size`,
    task_count: totalCalls,
  });

  return jsonResponse({
    success: true,
    sent: 1,
    message: `Report sent with ${totalCalls} calls`,
    totalCalls,
    totalOppSize,
  });
}

interface EmailParams {
  dateLabel: string;
  totalCalls: number;
  totalOppSize: number;
  bestDeal: CallData | null;
  labelBuckets: LabelBucket[];
  monthBuckets: MonthBucket[];
  integrityFlags: IntegrityFlag[];
  repBreakdown: RepSummary[];
  dashboardUrl: string;
  isTestMode: boolean;
  recipientName: string;
  trend: TrendData;
  unsubscribeUrl: string;
  sections: ReportSections;
}

/** Build a trend indicator string */
function trendIndicator(current: number, previous: number, isPercent = true): string {
  if (previous === 0 && current === 0) return "";
  const diff = current - previous;
  if (diff === 0) return `<span style="color:#6b7280;font-size:11px;">→ no change</span>`;

  const arrow = diff > 0 ? "↑" : "↓";
  const color = diff > 0 ? "#16a34a" : "#dc2626";

  let label: string;
  if (isPercent && previous > 0) {
    const pct = Math.round((diff / previous) * 100);
    label = `${arrow} ${Math.abs(pct)}%`;
  } else {
    label = `${arrow} ${Math.abs(Math.round(diff))}`;
  }
  return `<span style="color:${color};font-size:11px;font-weight:600;">${label}</span>`;
}

function buildEmailHtml(params: EmailParams): string {
  const {
    dateLabel, totalCalls, totalOppSize, bestDeal, labelBuckets, monthBuckets,
    integrityFlags, repBreakdown, dashboardUrl, isTestMode, recipientName,
    trend, unsubscribeUrl, sections,
  } = params;

  const formatCurrency = (n: number) => "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const formatLabel = (l: string) => l === "best_case" ? "Best Case" : l === "time_waster" ? "Time Waster" : l.charAt(0).toUpperCase() + l.slice(1);

  const testBanner = isTestMode ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <strong>🧪 This is a test report</strong> — Your daily report system is working correctly!
    </div>
  ` : "";

  // WoW trends
  const callsTrend = sections.wow_trends && trend.hasPrevData ? `<div style="margin-top:4px;">${trendIndicator(totalCalls, trend.prevTotalCalls)}</div>` : "";
  const oppTrend = sections.wow_trends && trend.hasPrevData
    ? `<div style="margin-top:4px;">${trendIndicator(totalOppSize, trend.prevTotalOppSize)}</div>`
    : "";

  // Summary Stats
  const summaryStatsHtml = sections.summary_stats ? `
    <table style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:32px;">
      <tr>
        <td style="width:50%;padding:0;">
          <div style="background:#f0f9ff;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#1e40af;">${totalCalls}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Calls Logged</div>
            ${callsTrend}
          </div>
        </td>
        <td style="width:50%;padding:0 0 0 8px;">
          <div style="background:#fefce8;border-radius:8px;padding:16px;text-align:center;">
            <div style="font-size:28px;font-weight:700;color:#ca8a04;">${formatCurrency(totalOppSize)}</div>
            <div style="font-size:12px;color:#6b7280;margin-top:4px;">Total Opportunity Size</div>
            ${oppTrend}
          </div>
        </td>
      </tr>
    </table>
  ` : "";

  // Best Deal of the Day
  const bestDealHtml = sections.best_deal && bestDeal ? `
    <h2 style="font-size:16px;margin:0 0 12px;color:#16a34a;">🏆 Best Deal of the Day</h2>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
      <div style="font-size:18px;font-weight:700;color:#15803d;">${formatCurrency(bestDeal.estimated_opportunity_size || 0)}</div>
      <div style="font-size:14px;margin-top:4px;">
        <strong>${bestDeal.rep_name}</strong> — ${bestDeal.account_name || "Unknown Account"}
      </div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">
        ${formatLabel(bestDeal.opportunity_label || "")} · Close: ${bestDeal.target_close_date || "TBD"}
      </div>
      ${bestDeal.summary ? `<div style="font-size:12px;color:#4b5563;margin-top:8px;border-top:1px solid #dcfce7;padding-top:8px;">${bestDeal.summary.substring(0, 200)}${bestDeal.summary.length > 200 ? "…" : ""}</div>` : ""}
    </div>
  ` : (sections.best_deal && !bestDeal && totalCalls > 0 ? `
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:24px;color:#6b7280;font-size:13px;">
      No "Commit" or "Best Case" deals logged today.
    </div>
  ` : "");

  // Label Breakdown
  const labelRows = labelBuckets.filter(b => b.calls > 0).map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500;">${b.displayLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${b.calls}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(b.totalOppSize)}</td>
    </tr>
  `).join("");

  const labelBreakdownHtml = sections.label_breakdown && labelRows ? `
    <h2 style="font-size:16px;margin:0 0 12px;">📊 Opportunity by Label</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Label</th>
        <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Calls</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Total Opp Size</th>
      </tr></thead>
      <tbody>${labelRows}</tbody>
    </table>
  ` : "";

  // Close Month Breakdown
  const monthRows = monthBuckets.map(b => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:500;">${b.displayMonth}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${formatCurrency(b.totalOppSize)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${b.dealCount}</td>
    </tr>
  `).join("");

  const closeMonthHtml = sections.close_month_breakdown && monthRows ? `
    <h2 style="font-size:16px;margin:0 0 12px;">📅 Revenue by Expected Close Month</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Close Month</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Total Opp Size</th>
        <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;"># Deals</th>
      </tr></thead>
      <tbody>${monthRows}</tbody>
    </table>
  ` : "";

  // Pipeline Integrity
  const hasAnyFlags = integrityFlags.some(f => f.issues.length > 0);
  let integrityHtml = "";
  if (sections.pipeline_integrity && totalCalls > 0) {
    if (hasAnyFlags) {
      const flagItems = integrityFlags.filter(f => f.issues.length > 0).map(f => {
        const issueList = f.issues.map(i => `<li style="margin-bottom:4px;">${i}</li>`).join("");
        return `<div style="margin-bottom:12px;"><strong>${f.repName}</strong><ul style="margin:4px 0 0;padding-left:20px;font-size:13px;color:#4b5563;">${issueList}</ul></div>`;
      }).join("");
      integrityHtml = `
        <h2 style="font-size:16px;margin:0 0 12px;color:#dc2626;">🔍 Pipeline Integrity Check</h2>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin-bottom:24px;">
          ${flagItems}
        </div>
      `;
    } else {
      integrityHtml = `
        <h2 style="font-size:16px;margin:0 0 12px;color:#16a34a;">✅ Pipeline Integrity Check</h2>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#15803d;">
          All opportunity labels appear consistent with call outcomes.
        </div>
      `;
    }
  }

  // Rep Breakdown (opportunity-centric)
  const breakdownRows = repBreakdown.map(r => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${r.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:center;">${r.callCount}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${r.totalOppSize > 0 ? formatCurrency(r.totalOppSize) : "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.commitTotal > 0 ? formatCurrency(r.commitTotal) : "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.bestCaseTotal > 0 ? formatCurrency(r.bestCaseTotal) : "—"}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${r.pipelineTotal > 0 ? formatCurrency(r.pipelineTotal) : "—"}</td>
    </tr>
  `).join("");

  const repBreakdownHtml = sections.rep_breakdown ? `
    <h2 style="font-size:16px;margin:0 0 12px;">📋 Rep Breakdown</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
      <thead><tr style="background:#f9fafb;">
        <th style="padding:8px 12px;text-align:left;font-weight:600;border-bottom:2px solid #e5e7eb;">Rep</th>
        <th style="padding:8px 12px;text-align:center;font-weight:600;border-bottom:2px solid #e5e7eb;">Calls</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Opp Size</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Commit</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Best Case</th>
        <th style="padding:8px 12px;text-align:right;font-weight:600;border-bottom:2px solid #e5e7eb;">Pipeline</th>
      </tr></thead>
      <tbody>${breakdownRows}</tbody>
    </table>
  ` : "";

  const dashboardLink = dashboardUrl
    ? `<div style="text-align:center;margin-top:24px;">
        <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Full Dashboard →</a>
       </div>`
    : "";

  const settingsLink = dashboardUrl ? `<a href="${dashboardUrl}/settings" style="color:#6b7280;text-decoration:underline;">Manage report settings</a>` : "";
  const footerHtml = `
    <p style="text-align:center;color:#9ca3af;font-size:12px;margin-top:16px;">
      Sent by MindForge${settingsLink ? ` · ${settingsLink}` : ""} · <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
    </p>
  `;

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

          ${summaryStatsHtml}

          ${totalCalls === 0 ? `
            <p style="text-align:center;color:#6b7280;padding:24px 0;">No calls recorded for this period.</p>
          ` : `
            ${bestDealHtml}
            ${labelBreakdownHtml}
            ${closeMonthHtml}
            ${integrityHtml}
            ${repBreakdownHtml}
          `}

          ${dashboardLink}
        </div>

        ${footerHtml}
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
