import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

async function verifyToken(token: string): Promise<string | null> {
  try {
    const decoded = JSON.parse(atob(token));
    const { uid, sig } = decoded;
    if (!uid || !sig) return null;

    const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );

    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map((b: string) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, encoder.encode(uid));

    return valid ? uid : null;
  } catch {
    return null;
  }
}

function htmlResponse(title: string, message: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
      .card { background: white; border-radius: 12px; padding: 48px; max-width: 440px; text-align: center; box-shadow: 0 4px 6px rgba(0,0,0,0.07); }
      h1 { font-size: 24px; margin: 0 0 12px; }
      p { color: #6b7280; font-size: 15px; margin: 0; line-height: 1.5; }
    </style></head>
    <body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`,
    { status, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
  );
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return htmlResponse("Invalid Link", "This unsubscribe link is invalid or expired.", 400);
  }

  const userId = await verifyToken(token);
  if (!userId) {
    return htmlResponse("Invalid Link", "This unsubscribe link is invalid or expired.", 400);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase
      .from("daily_report_configs")
      .update({ enabled: false })
      .eq("user_id", userId);

    if (error) {
      console.error("[unsubscribe-report] Error:", error);
      return htmlResponse("Something Went Wrong", "We couldn't process your request. Please try again or manage your settings in the dashboard.", 500);
    }

    return htmlResponse(
      "✅ Unsubscribed",
      "You've been unsubscribed from daily call reports. You can re-enable them anytime in Settings → Daily Call Report."
    );
  } catch (err) {
    console.error("[unsubscribe-report] Unexpected error:", err);
    return htmlResponse("Something Went Wrong", "We couldn't process your request. Please try again later.", 500);
  }
};

Deno.serve(handler);
