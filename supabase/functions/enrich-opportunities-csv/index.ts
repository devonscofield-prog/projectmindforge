import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify admin role via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the calling user is an admin
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleData?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { accountNames } = await req.json() as { accountNames: string[] };
    if (!accountNames || !Array.isArray(accountNames) || accountNames.length === 0) {
      return new Response(JSON.stringify({ error: "accountNames array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit batch size
    const names = accountNames.slice(0, 500);
    const lowerNames = names.map((n) => n.toLowerCase().trim());

    // 1. Find matching prospects (case-insensitive)
    const { data: prospects } = await adminClient
      .from("prospects")
      .select("id, prospect_name, account_name, rep_id, heat_score, account_heat_score, account_heat_analysis, ai_extracted_info, status, potential_revenue, active_revenue, last_contact_date, industry")
      .is("deleted_at", null);

    // Build a map: lowercase account_name -> prospect
    const prospectMap = new Map<string, typeof prospects extends (infer T)[] | null ? T : never>();
    for (const p of prospects ?? []) {
      const key = (p.account_name || p.prospect_name || "").toLowerCase().trim();
      if (key && lowerNames.includes(key)) {
        // Keep the one with the highest heat score if duplicates
        const existing = prospectMap.get(key);
        if (!existing || (p.account_heat_score ?? 0) > (existing.account_heat_score ?? 0)) {
          prospectMap.set(key, p);
        }
      }
    }

    // Collect matched prospect IDs for batch queries
    const matchedProspects = Array.from(prospectMap.values());
    const prospectIds = matchedProspects.map((p) => p.id);

    // 2. Batch query call_transcripts for matched prospects
    let callsByProspect = new Map<string, { total: number; lastDate: string; callTypes: string[] }>();
    if (prospectIds.length > 0) {
      const { data: calls } = await adminClient
        .from("call_transcripts")
        .select("id, prospect_id, call_date, call_type")
        .in("prospect_id", prospectIds)
        .is("deleted_at", null)
        .order("call_date", { ascending: false });

      for (const c of calls ?? []) {
        if (!c.prospect_id) continue;
        const existing = callsByProspect.get(c.prospect_id);
        if (existing) {
          existing.total++;
          if (c.call_type && !existing.callTypes.includes(c.call_type)) {
            existing.callTypes.push(c.call_type);
          }
        } else {
          callsByProspect.set(c.prospect_id, {
            total: 1,
            lastDate: c.call_date,
            callTypes: c.call_type ? [c.call_type] : [],
          });
        }
      }
    }

    // 3. Get latest AI analysis per prospect (via call)
    let analysisByProspect = new Map<string, Record<string, unknown>>();
    if (prospectIds.length > 0) {
      // Get the latest call per prospect, then its analysis
      const { data: latestCalls } = await adminClient
        .from("call_transcripts")
        .select("id, prospect_id")
        .in("prospect_id", prospectIds)
        .is("deleted_at", null)
        .order("call_date", { ascending: false });

      // Deduplicate to get only the latest call per prospect
      const latestCallByProspect = new Map<string, string>();
      for (const c of latestCalls ?? []) {
        if (c.prospect_id && !latestCallByProspect.has(c.prospect_id)) {
          latestCallByProspect.set(c.prospect_id, c.id);
        }
      }

      const latestCallIds = Array.from(latestCallByProspect.values());
      if (latestCallIds.length > 0) {
        const { data: analyses } = await adminClient
          .from("ai_call_analysis")
          .select("call_id, call_summary, call_effectiveness_score, discovery_score, objection_handling_score, rapport_communication_score, product_knowledge_score, deal_advancement_score, deal_heat_analysis, prospect_intel, deal_gaps, strengths, opportunities, analysis_behavior, deal_tags, skill_tags")
          .in("call_id", latestCallIds)
          .is("deleted_at", null);

        for (const a of analyses ?? []) {
          // Find the prospect_id for this call
          for (const [pid, cid] of latestCallByProspect.entries()) {
            if (cid === a.call_id) {
              analysisByProspect.set(pid, a as Record<string, unknown>);
              break;
            }
          }
        }
      }
    }

    // 4. Stakeholders per prospect
    let stakeholdersByProspect = new Map<string, { names: string[]; titles: string[]; influenceLevels: string[]; championScores: number[] }>();
    if (prospectIds.length > 0) {
      const { data: stakeholders } = await adminClient
        .from("stakeholders")
        .select("prospect_id, name, job_title, influence_level, champion_score")
        .in("prospect_id", prospectIds)
        .is("deleted_at", null);

      for (const s of stakeholders ?? []) {
        const existing = stakeholdersByProspect.get(s.prospect_id);
        if (existing) {
          existing.names.push(s.name);
          if (s.job_title) existing.titles.push(s.job_title);
          if (s.influence_level) existing.influenceLevels.push(s.influence_level);
          if (s.champion_score != null) existing.championScores.push(s.champion_score);
        } else {
          stakeholdersByProspect.set(s.prospect_id, {
            names: [s.name],
            titles: s.job_title ? [s.job_title] : [],
            influenceLevels: s.influence_level ? [s.influence_level] : [],
            championScores: s.champion_score != null ? [s.champion_score] : [],
          });
        }
      }
    }

    // 5. Follow-ups per prospect
    let followUpsByProspect = new Map<string, { count: number; nextDue: string | null; titles: string[] }>();
    if (prospectIds.length > 0) {
      const { data: followUps } = await adminClient
        .from("account_follow_ups")
        .select("prospect_id, title, due_date, status")
        .in("prospect_id", prospectIds)
        .in("status", ["pending", "in_progress"])
        .order("due_date", { ascending: true });

      for (const f of followUps ?? []) {
        const existing = followUpsByProspect.get(f.prospect_id);
        if (existing) {
          existing.count++;
          existing.titles.push(f.title);
          if (!existing.nextDue && f.due_date) existing.nextDue = f.due_date;
        } else {
          followUpsByProspect.set(f.prospect_id, {
            count: 1,
            nextDue: f.due_date,
            titles: [f.title],
          });
        }
      }
    }

    // 6. Build enrichment results keyed by lowercase account name
    const results: Record<string, Record<string, string>> = {};

    for (const name of lowerNames) {
      const prospect = prospectMap.get(name);
      if (!prospect) {
        results[name] = { "SW_Match_Status": "No Match" };
        continue;
      }

      const calls = callsByProspect.get(prospect.id);
      const analysis = analysisByProspect.get(prospect.id);
      const stakeholders = stakeholdersByProspect.get(prospect.id);
      const followUps = followUpsByProspect.get(prospect.id);

      // Parse AI extracted info
      const aiInfo = prospect.ai_extracted_info as Record<string, unknown> | null;
      const heatAnalysis = prospect.account_heat_analysis as Record<string, unknown> | null;

      // Extract MEDDPICC from analysis
      const behavior = analysis?.analysis_behavior as Record<string, unknown> | null;
      const dealHeat = analysis?.deal_heat_analysis as Record<string, unknown> | null;
      const prospectIntel = analysis?.prospect_intel as Record<string, unknown> | null;

      results[name] = {
        "SW_Match_Status": "Matched",
        // Heat Score
        "SW_Account_Heat_Score": String(prospect.account_heat_score ?? ""),
        "SW_Temperature": String(heatAnalysis?.temperature ?? ""),
        "SW_Heat_Trend": String(heatAnalysis?.trend ?? ""),
        "SW_Account_Status": prospect.status ?? "",
        "SW_Potential_Revenue": String(prospect.potential_revenue ?? ""),
        "SW_Active_Revenue": String(prospect.active_revenue ?? ""),
        "SW_Last_Contact": prospect.last_contact_date ?? "",
        "SW_Industry": prospect.industry ?? "",
        // AI Insights
        "SW_Deal_Blockers": jsonArrayToString(aiInfo?.deal_blockers),
        "SW_Buying_Signals": jsonArrayToString(aiInfo?.buying_signals),
        "SW_Stall_Signals": jsonArrayToString(aiInfo?.stall_signals),
        "SW_Relationship_Trajectory": String(aiInfo?.relationship_trajectory ?? ""),
        "SW_Next_Best_Action": String(aiInfo?.next_best_action ?? ""),
        "SW_Pain_Points": jsonArrayToString(aiInfo?.pain_points),
        "SW_Competitors_Mentioned": jsonArrayToString(aiInfo?.competitors_mentioned ?? prospectIntel?.competitors_mentioned),
        // Call Activity
        "SW_Total_Calls": String(calls?.total ?? 0),
        "SW_Last_Call_Date": calls?.lastDate ?? "",
        "SW_Call_Types": (calls?.callTypes ?? []).join("; "),
        // Latest Analysis
        "SW_Call_Summary": String(analysis?.call_summary ?? ""),
        "SW_Effectiveness_Score": String(analysis?.call_effectiveness_score ?? ""),
        "SW_Discovery_Score": String(analysis?.discovery_score ?? ""),
        "SW_Objection_Handling": String(analysis?.objection_handling_score ?? ""),
        "SW_Rapport_Score": String(analysis?.rapport_communication_score ?? ""),
        "SW_Product_Knowledge": String(analysis?.product_knowledge_score ?? ""),
        "SW_Deal_Advancement": String(analysis?.deal_advancement_score ?? ""),
        "SW_Coach_Grade": String(behavior?.overall_score ?? ""),
        "SW_Deal_Tags": jsonArrayToString(analysis?.deal_tags),
        "SW_Skill_Tags": jsonArrayToString(analysis?.skill_tags),
        "SW_Deal_Gaps": jsonArrayToString(analysis?.deal_gaps),
        "SW_Strengths": jsonArrayToString(analysis?.strengths),
        "SW_Opportunities": jsonArrayToString(analysis?.opportunities),
        // Deal Heat
        "SW_Deal_Temperature": String(dealHeat?.temperature ?? ""),
        "SW_Deal_Momentum": String(dealHeat?.momentum ?? ""),
        // Stakeholders
        "SW_Stakeholder_Names": (stakeholders?.names ?? []).join("; "),
        "SW_Stakeholder_Titles": (stakeholders?.titles ?? []).join("; "),
        "SW_Influence_Levels": (stakeholders?.influenceLevels ?? []).join("; "),
        "SW_Champion_Scores": (stakeholders?.championScores ?? []).join("; "),
        // Follow-Ups
        "SW_Pending_FollowUps": String(followUps?.count ?? 0),
        "SW_Next_FollowUp_Due": followUps?.nextDue ?? "",
        "SW_FollowUp_Titles": (followUps?.titles ?? []).slice(0, 5).join("; "),
      };
    }

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Enrichment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function jsonArrayToString(val: unknown): string {
  if (!val) return "";
  if (Array.isArray(val)) {
    return val
      .map((item) => {
        if (typeof item === "string") return item;
        if (typeof item === "object" && item !== null) {
          // Handle objects like {label: "...", description: "..."}
          return (item as Record<string, unknown>).label || (item as Record<string, unknown>).description || (item as Record<string, unknown>).text || JSON.stringify(item);
        }
        return String(item);
      })
      .join("; ");
  }
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}
