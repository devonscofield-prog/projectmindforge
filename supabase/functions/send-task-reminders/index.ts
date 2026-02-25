import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { validateSignedRequest, timingSafeEqual } from "../_shared/hmac.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = getCorsHeaders(null);

interface FollowUp {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string;
  prospect_id: string;
  rep_id: string;
  reminder_sent_at: string | null;
  secondary_reminder_sent_at: string | null;
  reminder_time: string | null;
}

interface UserReminders {
  userId: string;
  email: string;
  name: string;
  overdue: FollowUp[];
  dueToday: FollowUp[];
  dueTomorrow: FollowUp[];
  prospectNames: Record<string, string>;
  prospectSalesforceLinks: Record<string, string | null>;
}

interface UserPreferences {
  user_id: string;
  reminder_time: string;
  secondary_reminder_time: string | null;
  timezone: string;
  notify_due_today: boolean;
  notify_due_tomorrow: boolean;
  notify_overdue: boolean;
  exclude_weekends: boolean;
  min_priority: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface Prospect {
  id: string;
  account_name: string | null;
  prospect_name: string;
  salesforce_link: string | null;
}

interface RequestBody {
  test?: boolean;
  userId?: string;
}

// Priority ordering for filtering
const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Default preferences for users who haven't configured them
const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  reminder_time: "09:00",
  secondary_reminder_time: null,
  timezone: "America/New_York",
  notify_due_today: true,
  notify_due_tomorrow: true,
  notify_overdue: true,
  exclude_weekends: false,
  min_priority: null,
};

// Convert "HH:MM" to total minutes since midnight
function toMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + (m || 0);
}

// Dynamic import for Resend to avoid module resolution issues
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const payload = JSON.stringify({
    from: "MindForge Reminders <reminders@mindforgenotifications.com>",
    to: [to],
    subject,
    html,
  });

  const doFetch = async () => {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw Object.assign(new Error(`Resend API error: ${response.status} ${errorText}`), { status: response.status });
    }

    await response.text(); // Consume response body
  };

  try {
    await doFetch();
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    if (status && status >= 500) {
      console.warn(`[send-task-reminders] Resend 5xx error (${status}), retrying in 2s...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      await doFetch();
    } else {
      throw err;
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabaseClient = SupabaseClient<any, any, any>;

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: require HMAC signature, service role key, or user JWT
    const bodyText = await req.text();
    const hasSignature = req.headers.has('X-Request-Signature');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (hasSignature) {
      const validation = await validateSignedRequest(req.headers, bodyText, supabaseServiceKey);
      if (!validation.valid) {
        console.warn('[send-task-reminders] HMAC validation failed:', validation.error);
        return new Response(JSON.stringify({ error: 'Invalid request signature' }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (token) {
      const isService = await timingSafeEqual(token, supabaseServiceKey);
      if (!isService) {
        // Try user JWT auth
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
            status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } else {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check for test mode
    const body: RequestBody = bodyText ? JSON.parse(bodyText) : {};
    const isTestMode = body.test === true;
    const testUserId = body.userId;

    const now = new Date();

    console.log(`[send-task-reminders] Running at ${now.toISOString()}, testMode: ${isTestMode}`);

    // In test mode, we target a specific user
    if (isTestMode && testUserId) {
      console.log(`[send-task-reminders] Test mode for user: ${testUserId}`);
      return await handleTestMode(supabase, testUserId, now);
    }

    // ===== NEW FLOW: Start from eligible tasks, not preferences =====

    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Step 1: Get ALL eligible follow-ups (pending, reminder_enabled, due <= tomorrow)
    const { data: followUpsData, error: followUpsError } = await supabase
      .from("account_follow_ups")
      .select("id, title, description, priority, due_date, prospect_id, rep_id, reminder_sent_at, secondary_reminder_sent_at, reminder_time")
      .eq("status", "pending")
      .eq("reminder_enabled", true)
      .not("due_date", "is", null)
      .lte("due_date", tomorrow);

    if (followUpsError) {
      console.error("[send-task-reminders] Error fetching follow-ups:", followUpsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch follow-up data' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followUps = (followUpsData || []) as FollowUp[];

    if (followUps.length === 0) {
      console.log("[send-task-reminders] No eligible follow-ups found");
      return new Response(JSON.stringify({ message: "No eligible follow-ups", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out tasks where BOTH primary and secondary reminders were already sent today
    const todayStart = new Date(today).toISOString();
    const eligibleFollowUps = followUps.filter(f => {
      const primarySentToday = f.reminder_sent_at && new Date(f.reminder_sent_at) >= new Date(todayStart);
      const secondarySentToday = f.secondary_reminder_sent_at && new Date(f.secondary_reminder_sent_at) >= new Date(todayStart);
      // Allow through if either reminder hasn't been sent today
      return !primarySentToday || !secondarySentToday;
    });

    if (eligibleFollowUps.length === 0) {
      console.log("[send-task-reminders] All reminders already sent today");
      return new Response(JSON.stringify({ message: "All reminders already sent today", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get unique rep_ids from eligible tasks
    const uniqueRepIds = [...new Set(eligibleFollowUps.map(f => f.rep_id))];
    console.log(`[send-task-reminders] ${eligibleFollowUps.length} eligible tasks from ${uniqueRepIds.length} users`);

    // Step 3: Get existing notification preferences for these users
    const { data: existingPrefs } = await supabase
      .from("notification_preferences")
      .select("user_id, reminder_time, secondary_reminder_time, timezone, notify_due_today, notify_due_tomorrow, notify_overdue, exclude_weekends, min_priority, email_enabled")
      .in("user_id", uniqueRepIds);

    const prefsMap = new Map<string, UserPreferences & { email_enabled: boolean }>();
    for (const p of (existingPrefs || [])) {
      prefsMap.set(p.user_id, {
        user_id: p.user_id,
        reminder_time: p.reminder_time || DEFAULT_PREFERENCES.reminder_time,
        secondary_reminder_time: p.secondary_reminder_time,
        timezone: p.timezone || DEFAULT_PREFERENCES.timezone,
        notify_due_today: p.notify_due_today ?? DEFAULT_PREFERENCES.notify_due_today,
        notify_due_tomorrow: p.notify_due_tomorrow ?? DEFAULT_PREFERENCES.notify_due_tomorrow,
        notify_overdue: p.notify_overdue ?? DEFAULT_PREFERENCES.notify_overdue,
        exclude_weekends: p.exclude_weekends ?? DEFAULT_PREFERENCES.exclude_weekends,
        min_priority: p.min_priority,
        email_enabled: p.email_enabled ?? true,
      });
    }

    // Step 4: Auto-provision default preferences for users missing them
    const usersWithoutPrefs = uniqueRepIds.filter(id => !prefsMap.has(id));
    if (usersWithoutPrefs.length > 0) {
      console.log(`[send-task-reminders] Auto-provisioning preferences for ${usersWithoutPrefs.length} users: ${usersWithoutPrefs.join(", ")}`);

      const defaultRows = usersWithoutPrefs.map(userId => ({
        user_id: userId,
        email_enabled: true,
        reminder_time: DEFAULT_PREFERENCES.reminder_time,
        secondary_reminder_time: DEFAULT_PREFERENCES.secondary_reminder_time,
        timezone: DEFAULT_PREFERENCES.timezone,
        notify_due_today: DEFAULT_PREFERENCES.notify_due_today,
        notify_due_tomorrow: DEFAULT_PREFERENCES.notify_due_tomorrow,
        notify_overdue: DEFAULT_PREFERENCES.notify_overdue,
        exclude_weekends: DEFAULT_PREFERENCES.exclude_weekends,
        min_priority: DEFAULT_PREFERENCES.min_priority,
      }));

      const { error: insertErr } = await supabase
        .from("notification_preferences")
        .insert(defaultRows);

      if (insertErr) {
        console.error("[send-task-reminders] Error auto-provisioning preferences:", insertErr);
        // Continue anyway — we can still use in-memory defaults
      }

      // Add to prefsMap so they're included in the notification loop
      for (const userId of usersWithoutPrefs) {
        prefsMap.set(userId, {
          user_id: userId,
          ...DEFAULT_PREFERENCES,
          email_enabled: true,
        });
      }
    }

    // Step 5: Filter tasks by time window and preferences (per-task reminder_time support)
    const matchedTasksByUser = new Map<string, FollowUp[]>();

    for (const task of eligibleFollowUps) {
      const pref = prefsMap.get(task.rep_id);
      if (!pref) continue;

      // Skip users who have explicitly disabled email
      if (!pref.email_enabled) continue;

      try {
        // Convert current UTC time to user's timezone
        const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: pref.timezone }));
        const currentMinutes = userLocalTime.getHours() * 60 + userLocalTime.getMinutes();
        const dayOfWeek = userLocalTime.getDay();

        // Check weekend exclusion
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (pref.exclude_weekends && isWeekend) continue;

        // Determine which time to match against: per-task override or user global
        const targetTime = task.reminder_time || pref.reminder_time;
        const primaryMinutes = toMinutes(targetTime);
        const secondaryMinutes = pref.secondary_reminder_time
          ? toMinutes(pref.secondary_reminder_time)
          : null;

        // Match if current user-local time is within +/-15 minutes of target (covers 30-min cron)
        const primaryMatch = Math.abs(currentMinutes - primaryMinutes) <= 15;
        const secondaryMatch = secondaryMinutes !== null && Math.abs(currentMinutes - secondaryMinutes) <= 15;

        if (primaryMatch || secondaryMatch) {
          const existing = matchedTasksByUser.get(task.rep_id) || [];
          existing.push(task);
          matchedTasksByUser.set(task.rep_id, existing);
        }
      } catch {
        console.warn(`[send-task-reminders] Invalid timezone for user ${task.rep_id}:`, pref.timezone);
      }
    }

    if (matchedTasksByUser.size === 0) {
      console.log("[send-task-reminders] No users match current time window");
      return new Response(JSON.stringify({ message: "No users in current time window", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const usersToNotify = [...matchedTasksByUser.keys()];
    const matchedFollowUps = [...matchedTasksByUser.values()].flat();
    console.log(`[send-task-reminders] ${usersToNotify.length} users to notify, ${matchedFollowUps.length} matched tasks`);

    // Build full prefsData array for sendRemindersToUsers
    const prefsDataArray: UserPreferences[] = usersToNotify.map(id => {
      const p = prefsMap.get(id)!;
      return {
        user_id: p.user_id,
        reminder_time: p.reminder_time,
        secondary_reminder_time: p.secondary_reminder_time,
        timezone: p.timezone,
        notify_due_today: p.notify_due_today,
        notify_due_tomorrow: p.notify_due_tomorrow,
        notify_overdue: p.notify_overdue,
        exclude_weekends: p.exclude_weekends,
        min_priority: p.min_priority,
      };
    });

    return await sendRemindersToUsers(supabase, usersToNotify, prefsDataArray, now, false, matchedFollowUps);
  } catch (error: unknown) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[send-task-reminders] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

/**
 * Handle test mode - send immediately to a specific user, ignoring time checks
 */
async function handleTestMode(
  supabase: AnySupabaseClient,
  userId: string,
  now: Date
): Promise<Response> {
  // Get user's preferences (or use defaults if not set)
  const { data: prefData } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const userPrefs: UserPreferences = prefData ? {
    user_id: prefData.user_id,
    reminder_time: prefData.reminder_time || "09:00",
    secondary_reminder_time: prefData.secondary_reminder_time,
    timezone: prefData.timezone || "America/New_York",
    notify_due_today: prefData.notify_due_today ?? true,
    notify_due_tomorrow: prefData.notify_due_tomorrow ?? true,
    notify_overdue: prefData.notify_overdue ?? true,
    exclude_weekends: prefData.exclude_weekends ?? false,
    min_priority: prefData.min_priority,
  } : {
    user_id: userId,
    reminder_time: "09:00",
    secondary_reminder_time: null,
    timezone: "America/New_York",
    notify_due_today: true,
    notify_due_tomorrow: true,
    notify_overdue: true,
    exclude_weekends: false,
    min_priority: null,
  };

  return await sendRemindersToUsers(supabase, [userId], [userPrefs], now, true);
}

/**
 * Core logic to send reminders to specified users.
 * Optionally accepts pre-fetched followUps to avoid re-querying.
 */
async function sendRemindersToUsers(
  supabase: AnySupabaseClient,
  userIds: string[],
  prefsData: UserPreferences[],
  now: Date,
  isTestMode: boolean,
  prefetchedFollowUps?: FollowUp[]
): Promise<Response> {
  // Get user profiles
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds);

  const profileMap = ((profiles || []) as Profile[]).reduce((acc, p) => {
    acc[p.id] = { name: p.name, email: p.email };
    return acc;
  }, {} as Record<string, { name: string; email: string }>);

  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Use pre-fetched follow-ups or query fresh
  let eligibleFollowUps: FollowUp[];
  if (prefetchedFollowUps) {
    // Filter to only the users we're notifying
    eligibleFollowUps = prefetchedFollowUps.filter(f => userIds.includes(f.rep_id));
  } else {
    const { data: followUpsData, error: followUpsError } = await supabase
      .from("account_follow_ups")
      .select("id, title, description, priority, due_date, prospect_id, rep_id, reminder_sent_at, secondary_reminder_sent_at, reminder_time")
      .in("rep_id", userIds)
      .eq("status", "pending")
      .eq("reminder_enabled", true)
      .not("due_date", "is", null)
      .lte("due_date", tomorrow);

    if (followUpsError) {
      console.error("[send-task-reminders] Error fetching follow-ups:", followUpsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch follow-up data' }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const followUps = (followUpsData || []) as FollowUp[];

    if (followUps.length === 0) {
      console.log("[send-task-reminders] No follow-ups to remind about");
      return new Response(JSON.stringify({ 
        success: true,
        message: "No follow-ups with reminders enabled found. Create a task with a due date and reminders enabled.", 
        sent: 0 
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // In test mode, skip the "already sent today" check
    if (!isTestMode) {
      const todayStart = new Date(today).toISOString();
      eligibleFollowUps = followUps.filter(f => {
        const primarySentToday = f.reminder_sent_at && new Date(f.reminder_sent_at) >= new Date(todayStart);
        const secondarySentToday = f.secondary_reminder_sent_at && new Date(f.secondary_reminder_sent_at) >= new Date(todayStart);
        return !primarySentToday || !secondarySentToday;
      });

      if (eligibleFollowUps.length === 0) {
        console.log("[send-task-reminders] All reminders already sent today");
        return new Response(JSON.stringify({ message: "All reminders already sent today", sent: 0 }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      eligibleFollowUps = followUps;
    }
  }

  // Get prospect names and Salesforce links
  const prospectIds = [...new Set(eligibleFollowUps.map(f => f.prospect_id))];
  const { data: prospectsData } = await supabase
    .from("prospects")
    .select("id, account_name, prospect_name, salesforce_link")
    .in("id", prospectIds);

  const prospects = (prospectsData || []) as Prospect[];
  const prospectMap = prospects.reduce((acc, p) => {
    acc[p.id] = { 
      name: p.account_name || p.prospect_name,
      salesforceLink: p.salesforce_link 
    };
    return acc;
  }, {} as Record<string, { name: string; salesforceLink: string | null }>);

  // Group follow-ups by user
  const userReminders: Record<string, UserReminders> = {};
  
  for (const followUp of eligibleFollowUps) {
    const userId = followUp.rep_id;
    const profile = profileMap[userId];
    if (!profile) continue;

    // Get user's notification preferences
    const userPrefs = prefsData.find(p => p.user_id === userId);
    if (!userPrefs) continue;

    // Apply priority filtering
    if (userPrefs.min_priority) {
      const minLevel = PRIORITY_ORDER[userPrefs.min_priority] || 0;
      const taskLevel = PRIORITY_ORDER[followUp.priority] || 0;
      if (taskLevel < minLevel) {
        console.log(`[send-task-reminders] Skipping task ${followUp.id} - below min priority ${userPrefs.min_priority}`);
        continue;
      }
    }

    if (!userReminders[userId]) {
      userReminders[userId] = {
        userId,
        email: profile.email,
        name: profile.name,
        overdue: [],
        dueToday: [],
        dueTomorrow: [],
        prospectNames: {},
        prospectSalesforceLinks: {},
      };
    }

    const prospectData = prospectMap[followUp.prospect_id];
    userReminders[userId].prospectNames[followUp.prospect_id] = prospectData?.name || "Unknown Account";
    userReminders[userId].prospectSalesforceLinks[followUp.prospect_id] = prospectData?.salesforceLink || null;

    // Categorize by due date
    if (followUp.due_date < today && userPrefs.notify_overdue) {
      userReminders[userId].overdue.push(followUp);
    } else if (followUp.due_date === today && userPrefs.notify_due_today) {
      userReminders[userId].dueToday.push(followUp);
    } else if (followUp.due_date === tomorrow && userPrefs.notify_due_tomorrow) {
      userReminders[userId].dueTomorrow.push(followUp);
    }
  }

  // Send emails + in-app notifications
  let sentCount = 0;
  let totalTasksNotified = 0;

  for (const [userId, reminders] of Object.entries(userReminders)) {
    const allUserTasks = [...reminders.overdue, ...reminders.dueToday, ...reminders.dueTomorrow];
    const totalTasks = allUserTasks.length;
    if (totalTasks === 0) continue;

    // --- In-app notifications: one per task ---
    const inAppRows: Array<{
      user_id: string;
      type: string;
      title: string;
      message: string;
      link: string;
      related_entity_id: string;
    }> = [];

    const addInApp = (tasks: FollowUp[], type: string) => {
      for (const t of tasks) {
        const acctName = reminders.prospectNames[t.prospect_id] || 'Unknown';
        inAppRows.push({
          user_id: userId,
          type,
          title: t.title,
          message: `Account: ${acctName} · Priority: ${t.priority}`,
          link: '/rep/tasks',
          related_entity_id: t.id,
        });
      }
    };
    addInApp(reminders.overdue, 'task_overdue');
    addInApp(reminders.dueToday, 'task_due_today');
    addInApp(reminders.dueTomorrow, 'task_due_tomorrow');

    if (inAppRows.length > 0) {
      const { error: inAppErr } = await supabase
        .from('in_app_notifications')
        .insert(inAppRows);
      if (inAppErr) {
        console.error(`[send-task-reminders] Failed to insert in-app notifications for ${userId}:`, inAppErr);
      }
    }

    // Build email HTML
    const emailHtml = buildEmailHtml(reminders, isTestMode);
    const subject = isTestMode
      ? `🧪 [TEST] MindForge: ${totalTasks} follow-up${totalTasks > 1 ? "s" : ""} need your attention`
      : `📋 MindForge: ${totalTasks} follow-up${totalTasks > 1 ? "s" : ""} need your attention`;

    try {
      await sendEmail(reminders.email, subject, emailHtml);

      console.log(`[send-task-reminders] Email sent to ${reminders.email} with ${totalTasks} tasks`);
      sentCount++;
      totalTasksNotified += totalTasks;

      // Update reminder_sent_at per-user immediately after successful email (crash resilience)
      if (!isTestMode) {
        // Determine primary vs secondary match for each task
        const userPrefs = prefsData.find(p => p.user_id === userId);
        const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: userPrefs?.timezone || "America/New_York" }));
        const currentMinutes = userLocalTime.getHours() * 60 + userLocalTime.getMinutes();

        const primaryIds: string[] = [];
        const secondaryIds: string[] = [];

        for (const task of allUserTasks) {
          const targetTime = task.reminder_time || userPrefs?.reminder_time || "09:00";
          const primaryMinutes = toMinutes(targetTime);
          const secondaryMinutes = userPrefs?.secondary_reminder_time
            ? toMinutes(userPrefs.secondary_reminder_time)
            : null;

          const primaryMatch = Math.abs(currentMinutes - primaryMinutes) <= 15;
          const secondaryMatch = secondaryMinutes !== null && Math.abs(currentMinutes - secondaryMinutes) <= 15;

          if (primaryMatch) {
            primaryIds.push(task.id);
          } else if (secondaryMatch) {
            secondaryIds.push(task.id);
          } else {
            // Fallback: treat as primary (e.g. test mode edge case)
            primaryIds.push(task.id);
          }
        }

        if (primaryIds.length > 0) {
          const { error: primaryErr } = await supabase
            .from("account_follow_ups")
            .update({ reminder_sent_at: now.toISOString() })
            .in("id", primaryIds);
          if (primaryErr) {
            console.error(`[send-task-reminders] Error updating reminder_sent_at for user ${userId}:`, primaryErr);
          }
        }

        if (secondaryIds.length > 0) {
          const { error: secondaryErr } = await supabase
            .from("account_follow_ups")
            .update({ secondary_reminder_sent_at: now.toISOString() })
            .in("id", secondaryIds);
          if (secondaryErr) {
            console.error(`[send-task-reminders] Error updating secondary_reminder_sent_at for user ${userId}:`, secondaryErr);
          }
        }
      }

      // --- Notification log entries ---
      const logRows = [
        { user_id: userId, channel: 'email', notification_type: 'task_reminder', title: subject, summary: `${totalTasks} task${totalTasks > 1 ? 's' : ''} need attention`, task_count: totalTasks },
        { user_id: userId, channel: 'in_app', notification_type: 'task_reminder', title: 'In-app reminders created', summary: `${inAppRows.length} notification${inAppRows.length > 1 ? 's' : ''}`, task_count: inAppRows.length },
      ];
      const { error: logErr } = await supabase.from('notification_log').insert(logRows);
      if (logErr) console.error(`[send-task-reminders] Failed to write notification log:`, logErr);

      // Rate limit protection - small delay between emails
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (emailError) {
      console.error(`[send-task-reminders] Failed to send email to ${reminders.email}:`, emailError);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      sent: sentCount,
      tasksNotified: totalTasksNotified,
      inAppCreated: Object.values(userReminders).reduce((sum, r) => sum + r.overdue.length + r.dueToday.length + r.dueTomorrow.length, 0),
      message: sentCount > 0 ? `Email sent + in-app notifications created` : "No emails sent"
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
}

function buildEmailHtml(reminders: UserReminders, isTestMode = false): string {
  const priorityEmoji: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🔵",
  };

  const testBanner = isTestMode ? `
    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
      <strong>🧪 This is a test email</strong> — Your reminder system is working correctly!
    </div>
  ` : '';

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      ${testBanner}
      <h1 style="color: #1a1a2e; margin-bottom: 24px;">Hi ${reminders.name.split(" ")[0]},</h1>
      <p style="margin-bottom: 24px;">Here are your follow-up tasks that need attention:</p>
  `;

  // Overdue section
  if (reminders.overdue.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #dc2626; margin-bottom: 12px;">⚠️ Overdue (${reminders.overdue.length})</h3>
        ${reminders.overdue.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], f.prospect_id, reminders.prospectSalesforceLinks[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  // Due today section
  if (reminders.dueToday.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #d97706; margin-bottom: 12px;">📅 Due Today (${reminders.dueToday.length})</h3>
        ${reminders.dueToday.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], f.prospect_id, reminders.prospectSalesforceLinks[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  // Due tomorrow section
  if (reminders.dueTomorrow.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2563eb; margin-bottom: 12px;">📆 Due Tomorrow (${reminders.dueTomorrow.length})</h3>
        ${reminders.dueTomorrow.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], f.prospect_id, reminders.prospectSalesforceLinks[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  html += `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
        <a href="https://projectmindforge.lovable.app/rep/tasks" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View All Tasks →</a>
      </div>
      <p style="margin-top: 32px; color: #666; font-size: 12px;">
        <a href="https://projectmindforge.lovable.app/settings" style="color: #6366f1; text-decoration: underline;">
          Manage notification preferences
        </a>
      </p>
    </body>
    </html>
  `;

  return html;
}

function taskHtml(followUp: FollowUp, accountName: string, prospectId: string, salesforceLink: string | null, priorityEmoji: Record<string, string>): string {
  const emoji = priorityEmoji[followUp.priority] || "🔵";
  
  // MindForge account link - always available since prospect_id is required
  const mindforgeAccountUrl = `https://projectmindforge.lovable.app/rep/tasks`;
  const accountNameHtml = `<a href="${mindforgeAccountUrl}" target="_blank" style="color: #6366f1; text-decoration: none; font-weight: 500;">${accountName}</a>`;
  
  const salesforceLinkHtml = salesforceLink 
    ? `<a href="${salesforceLink}" target="_blank" style="color: #6366f1; text-decoration: none; font-size: 12px; margin-left: 8px;">Open in Salesforce →</a>`
    : '';
  
  return `
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; border-left: 3px solid ${followUp.priority === "high" ? "#dc2626" : followUp.priority === "medium" ? "#d97706" : "#2563eb"};">
      <div style="font-weight: 500;">${emoji} ${followUp.title}</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">
        Account: ${accountNameHtml}${salesforceLinkHtml}
      </div>
    </div>
  `;
}

Deno.serve(handler);
