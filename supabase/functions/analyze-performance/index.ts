import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CACHE_KEY = 'performance_recommendations';
const CACHE_TTL_HOURS = 1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for forceRefresh parameter
    const body = await req.json().catch(() => ({}));
    const forceRefresh = body.forceRefresh === true;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('dashboard_cache')
        .select('cache_data, computed_at')
        .eq('cache_key', CACHE_KEY)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();

      if (cached?.cache_data) {
        console.log('Returning cached recommendations');
        // Add cache metadata to response
        const cachedResponse = {
          ...(cached.cache_data as object),
          _cached: true,
          _cachedAt: cached.computed_at,
        };
        return new Response(JSON.stringify(cachedResponse), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("Fetching performance metrics for analysis...");

    // Get performance summary from the last 24 hours
    const { data: performanceSummary, error: summaryError } = await supabase.rpc(
      "get_performance_summary",
      { p_hours: 24 }
    );

    if (summaryError) {
      console.error("Error fetching performance summary:", summaryError);
      throw summaryError;
    }

    // Get recent raw metrics for pattern detection
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentMetrics, error: metricsError } = await supabase
      .from("performance_metrics")
      .select("metric_type, metric_name, duration_ms, status, created_at")
      .gte("created_at", cutoffTime)
      .order("created_at", { ascending: false })
      .limit(500);

    if (metricsError) {
      console.error("Error fetching recent metrics:", metricsError);
      throw metricsError;
    }

    // Identify problematic operations
    const slowQueries = (performanceSummary || [])
      .filter((m: { metric_type: string; avg_duration_ms: number }) => 
        m.metric_type === "query" && m.avg_duration_ms > 500
      )
      .sort((a: { avg_duration_ms: number }, b: { avg_duration_ms: number }) => 
        b.avg_duration_ms - a.avg_duration_ms
      )
      .slice(0, 5);

    const slowEdgeFunctions = (performanceSummary || [])
      .filter((m: { metric_type: string; avg_duration_ms: number }) => 
        m.metric_type === "edge_function" && m.avg_duration_ms > 3000
      )
      .sort((a: { avg_duration_ms: number }, b: { avg_duration_ms: number }) => 
        b.avg_duration_ms - a.avg_duration_ms
      )
      .slice(0, 5);

    const highErrorOperations = (performanceSummary || [])
      .filter((m: { error_rate: number }) => m.error_rate > 1)
      .sort((a: { error_rate: number }, b: { error_rate: number }) => 
        b.error_rate - a.error_rate
      )
      .slice(0, 5);

const prompt = `You are a performance optimization expert analyzing a web application's backend performance metrics.

## Current Performance Data (Last 24 Hours)

### Slow Database Queries (>500ms avg):
${slowQueries.length > 0 
  ? slowQueries.map((q: { 
      metric_name: string; 
      avg_duration_ms: number; 
      p99_duration_ms: number; 
      total_count: number 
    }) => 
      `- ${q.metric_name}: avg=${q.avg_duration_ms}ms, p99=${q.p99_duration_ms}ms, calls=${q.total_count}`
    ).join('\n')
  : 'No slow queries detected'}

### Slow Edge Functions (>3s avg):
${slowEdgeFunctions.length > 0
  ? slowEdgeFunctions.map((f: { 
      metric_name: string; 
      avg_duration_ms: number; 
      p99_duration_ms: number; 
      total_count: number 
    }) => 
      `- ${f.metric_name}: avg=${f.avg_duration_ms}ms, p99=${f.p99_duration_ms}ms, calls=${f.total_count}`
    ).join('\n')
  : 'No slow edge functions detected'}

### High Error Rate Operations (>1%):
${highErrorOperations.length > 0
  ? highErrorOperations.map((o: { 
      metric_name: string; 
      metric_type: string; 
      error_rate: number; 
      error_count: number; 
      total_count: number 
    }) => 
      `- ${o.metric_name} (${o.metric_type}): error_rate=${o.error_rate}%, errors=${o.error_count}/${o.total_count}`
    ).join('\n')
  : 'No high error rate operations detected'}

### Overall Statistics:
- Total operations tracked: ${(performanceSummary || []).length}
- Total calls: ${(performanceSummary || []).reduce((sum: number, m: { total_count: number }) => sum + m.total_count, 0)}
- Total errors: ${(performanceSummary || []).reduce((sum: number, m: { error_count: number }) => sum + m.error_count, 0)}

Based on this data, provide 3-5 specific, actionable recommendations to improve performance. Focus on:
1. The most impactful optimizations (high call count + slow performance)
2. Quick wins that can be implemented easily
3. Error reduction strategies

Format each recommendation with a clear title, priority (high/medium/low), category, and detailed explanation.`;

    console.log("Calling Lovable AI for performance analysis...");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a backend performance optimization expert. Analyze the provided metrics and return recommendations in the following JSON format only, no other text:
{
  "recommendations": [
    {
      "title": "Short descriptive title",
      "priority": "high|medium|low",
      "category": "database|edge_function|caching|error_handling|scaling",
      "impact": "High|Medium|Low",
      "effort": "Low|Medium|High",
      "description": "Detailed explanation of the issue and why this optimization matters",
      "action": "Specific actionable steps to implement this optimization",
      "affectedOperations": ["operation_name_1", "operation_name_2"]
    }
  ],
  "summary": "One sentence overall assessment of the system's health",
  "healthScore": 0-100
}`
          },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("AI analysis complete, parsing response...");

    // Parse the JSON response
    let recommendations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      // Return a fallback response
      recommendations = {
        recommendations: [
          {
            title: "Unable to generate detailed recommendations",
            priority: "medium",
            category: "error_handling",
            impact: "Medium",
            effort: "Low",
            description: "The AI analysis could not be completed. Please check the raw performance data in the drill-down view.",
            action: "Review the performance drill-down data manually and look for operations with high latency or error rates.",
            affectedOperations: [],
          },
        ],
        summary: "Analysis incomplete - please review metrics manually",
        healthScore: 50,
      };
    }

    // Store in cache for future requests
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_HOURS * 60 * 60 * 1000);
    
    await supabase.from('dashboard_cache').upsert({
      cache_key: CACHE_KEY,
      cache_data: recommendations,
      computed_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      metadata: { 
        source: 'analyze-performance',
        metrics_count: (performanceSummary || []).length,
        force_refreshed: forceRefresh,
      }
    }, { onConflict: 'cache_key' });

    console.log('Recommendations cached successfully');

    return new Response(JSON.stringify(recommendations), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in analyze-performance:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
