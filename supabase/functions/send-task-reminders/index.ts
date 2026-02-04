import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface FollowUp {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  due_date: string;
  prospect_id: string;
}

interface UserReminders {
  userId: string;
  email: string;
  name: string;
  overdue: FollowUp[];
  dueToday: FollowUp[];
  dueTomorrow: FollowUp[];
  prospectNames: Record<string, string>;
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

// Priority ordering for filtering
const PRIORITY_ORDER: Record<string, number> = { high: 3, medium: 2, low: 1 };

// Dynamic import for Resend to avoid module resolution issues
async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "MindForge Reminders <reminders@mindforgenotifications.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Resend API error: ${response.status} ${errorText}`);
  }
  
  await response.text(); // Consume response body
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const currentHour = now.getUTCHours();

    console.log(`[send-task-reminders] Running at ${now.toISOString()}, UTC hour: ${currentHour}`);

    // Get users with email notifications enabled
    const { data: prefsData, error: prefsError } = await supabase
      .from("notification_preferences")
      .select("user_id, reminder_time, secondary_reminder_time, timezone, notify_due_today, notify_due_tomorrow, notify_overdue, exclude_weekends, min_priority")
      .eq("email_enabled", true);

    if (prefsError) {
      console.error("[send-task-reminders] Error fetching preferences:", prefsError);
      return new Response(JSON.stringify({ error: prefsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!prefsData || prefsData.length === 0) {
      console.log("[send-task-reminders] No users with email notifications enabled");
      return new Response(JSON.stringify({ message: "No users to notify", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter users whose local time matches their reminder time (primary or secondary)
    const usersToNotify: string[] = [];
    for (const pref of prefsData as UserPreferences[]) {
      try {
        // Convert current UTC time to user's timezone
        const userLocalTime = new Date(now.toLocaleString("en-US", { timeZone: pref.timezone }));
        const userHour = userLocalTime.getHours();
        const dayOfWeek = userLocalTime.getDay(); // 0 = Sunday, 6 = Saturday

        // Check weekend exclusion
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        if (pref.exclude_weekends && isWeekend) {
          console.log(`[send-task-reminders] Skipping user ${pref.user_id} - weekend exclusion enabled`);
          continue;
        }

        // Parse reminder hours
        const primaryHour = parseInt(pref.reminder_time.split(":")[0], 10);
        const secondaryHour = pref.secondary_reminder_time 
          ? parseInt(pref.secondary_reminder_time.split(":")[0], 10)
          : null;

        // Check if current hour matches primary OR secondary reminder time
        if (userHour === primaryHour || (secondaryHour !== null && userHour === secondaryHour)) {
          usersToNotify.push(pref.user_id);
        }
      } catch {
        console.warn(`[send-task-reminders] Invalid timezone for user ${pref.user_id}:`, pref.timezone);
      }
    }

    if (usersToNotify.length === 0) {
      console.log("[send-task-reminders] No users match current time window");
      return new Response(JSON.stringify({ message: "No users in current time window", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-task-reminders] ${usersToNotify.length} users to notify`);

    // Get user profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", usersToNotify);

    const profileMap = (profiles || []).reduce((acc, p) => {
      acc[p.id] = { name: p.name, email: p.email };
      return acc;
    }, {} as Record<string, { name: string; email: string }>);

    // Get follow-ups with reminder_enabled and due dates
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const { data: followUps, error: followUpsError } = await supabase
      .from("account_follow_ups")
      .select("id, title, description, priority, due_date, prospect_id, rep_id, reminder_sent_at")
      .in("rep_id", usersToNotify)
      .eq("status", "pending")
      .eq("reminder_enabled", true)
      .not("due_date", "is", null)
      .lte("due_date", tomorrow);

    if (followUpsError) {
      console.error("[send-task-reminders] Error fetching follow-ups:", followUpsError);
      return new Response(JSON.stringify({ error: followUpsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!followUps || followUps.length === 0) {
      console.log("[send-task-reminders] No follow-ups to remind about");
      return new Response(JSON.stringify({ message: "No follow-ups to remind about", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Filter out already-sent reminders for today
    const todayStart = new Date(today).toISOString();
    const eligibleFollowUps = followUps.filter(f => {
      if (!f.reminder_sent_at) return true;
      return new Date(f.reminder_sent_at) < new Date(todayStart);
    });

    if (eligibleFollowUps.length === 0) {
      console.log("[send-task-reminders] All reminders already sent today");
      return new Response(JSON.stringify({ message: "All reminders already sent today", sent: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get prospect names
    const prospectIds = [...new Set(eligibleFollowUps.map(f => f.prospect_id))];
    const { data: prospects } = await supabase
      .from("prospects")
      .select("id, account_name, prospect_name")
      .in("id", prospectIds);

    const prospectMap = (prospects || []).reduce((acc, p) => {
      acc[p.id] = p.account_name || p.prospect_name;
      return acc;
    }, {} as Record<string, string>);

    // Group follow-ups by user
    const userReminders: Record<string, UserReminders> = {};
    
    for (const followUp of eligibleFollowUps) {
      const userId = followUp.rep_id;
      const profile = profileMap[userId];
      if (!profile) continue;

      // Get user's notification preferences
      const userPrefs = (prefsData as UserPreferences[]).find(p => p.user_id === userId);
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
        };
      }

      userReminders[userId].prospectNames[followUp.prospect_id] = prospectMap[followUp.prospect_id] || "Unknown Account";

      // Categorize by due date
      if (followUp.due_date < today && userPrefs.notify_overdue) {
        userReminders[userId].overdue.push(followUp);
      } else if (followUp.due_date === today && userPrefs.notify_due_today) {
        userReminders[userId].dueToday.push(followUp);
      } else if (followUp.due_date === tomorrow && userPrefs.notify_due_tomorrow) {
        userReminders[userId].dueTomorrow.push(followUp);
      }
    }

    // Send emails
    let sentCount = 0;
    const followUpIdsToUpdate: string[] = [];

    for (const [_userId, reminders] of Object.entries(userReminders)) {
      const totalTasks = reminders.overdue.length + reminders.dueToday.length + reminders.dueTomorrow.length;
      if (totalTasks === 0) continue;

      // Build email HTML
      const emailHtml = buildEmailHtml(reminders);
      const subject = `📋 MindForge: ${totalTasks} follow-up${totalTasks > 1 ? "s" : ""} need your attention`;

      try {
        await sendEmail(reminders.email, subject, emailHtml);

        console.log(`[send-task-reminders] Email sent to ${reminders.email} with ${totalTasks} tasks`);
        sentCount++;

        // Collect follow-up IDs to mark as sent
        [...reminders.overdue, ...reminders.dueToday, ...reminders.dueTomorrow].forEach(f => {
          followUpIdsToUpdate.push(f.id);
        });
        // Rate limit protection - small delay between emails
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (emailError) {
        console.error(`[send-task-reminders] Failed to send email to ${reminders.email}:`, emailError);
      }
    }

    // Update reminder_sent_at for sent reminders
    if (followUpIdsToUpdate.length > 0) {
      const { error: updateError } = await supabase
        .from("account_follow_ups")
        .update({ reminder_sent_at: now.toISOString() })
        .in("id", followUpIdsToUpdate);

      if (updateError) {
        console.error("[send-task-reminders] Error updating reminder_sent_at:", updateError);
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: sentCount, tasksNotified: followUpIdsToUpdate.length }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-task-reminders] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

function buildEmailHtml(reminders: UserReminders): string {
  const priorityEmoji: Record<string, string> = {
    high: "🔴",
    medium: "🟡",
    low: "🔵",
  };

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a2e; margin-bottom: 24px;">Hi ${reminders.name.split(" ")[0]},</h1>
      <p style="margin-bottom: 24px;">Here are your follow-up tasks that need attention:</p>
  `;

  // Overdue section
  if (reminders.overdue.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #dc2626; margin-bottom: 12px;">⚠️ Overdue (${reminders.overdue.length})</h3>
        ${reminders.overdue.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  // Due today section
  if (reminders.dueToday.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #d97706; margin-bottom: 12px;">📅 Due Today (${reminders.dueToday.length})</h3>
        ${reminders.dueToday.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  // Due tomorrow section
  if (reminders.dueTomorrow.length > 0) {
    html += `
      <div style="margin-bottom: 24px;">
        <h3 style="color: #2563eb; margin-bottom: 12px;">📆 Due Tomorrow (${reminders.dueTomorrow.length})</h3>
        ${reminders.dueTomorrow.map(f => taskHtml(f, reminders.prospectNames[f.prospect_id], priorityEmoji)).join("")}
      </div>
    `;
  }

  html += `
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e5e5;">
        <a href="https://projectmindforge.lovable.app" style="display: inline-block; background: #6366f1; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">View All Tasks →</a>
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

function taskHtml(followUp: FollowUp, accountName: string, priorityEmoji: Record<string, string>): string {
  const emoji = priorityEmoji[followUp.priority] || "🔵";
  return `
    <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 8px; border-left: 3px solid ${followUp.priority === "high" ? "#dc2626" : followUp.priority === "medium" ? "#d97706" : "#2563eb"};">
      <div style="font-weight: 500;">${emoji} ${followUp.title}</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">Account: ${accountName}</div>
    </div>
  `;
}

serve(handler);
