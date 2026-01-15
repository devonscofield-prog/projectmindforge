import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SubmitCallTranscriptPayload {
  callDate: string;
  rawText: string;
  accountName: string;
  callType: string;
  callTypeOther?: string;
  salesforceAccountLink?: string;
  potentialRevenue?: number;
  managerId?: string;
  additionalSpeakers?: string[];
  isUnqualified?: boolean;
  primaryStakeholderName?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with user's token
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to verify authentication
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !user) {
      console.error("User authentication failed:", userError?.message);
      return new Response(
        JSON.stringify({ 
          error: "Your session has expired. Please sign in again.",
          code: "AUTH_FAILED"
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    // Parse the request body
    const payload: SubmitCallTranscriptPayload = await req.json();

    // Validate required fields
    if (!payload.callDate) {
      return new Response(
        JSON.stringify({ error: "Call date is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.rawText || payload.rawText.trim().length < 50) {
      return new Response(
        JSON.stringify({ error: "Transcript must be at least 50 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!payload.accountName || payload.accountName.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Account name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role client for insert to bypass RLS
    // Security is enforced by deriving rep_id from authenticated user
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Insert the transcript with rep_id derived from authenticated user (not from client payload)
    const insertData = {
      rep_id: user.id, // CRITICAL: Always use authenticated user's ID
      call_date: payload.callDate,
      source: 'other' as const,
      raw_text: payload.rawText,
      notes: null,
      analysis_status: 'pending' as const,
      primary_stakeholder_name: payload.primaryStakeholderName || '',
      account_name: payload.accountName,
      salesforce_demo_link: payload.salesforceAccountLink || null,
      potential_revenue: payload.potentialRevenue ?? null,
      call_type: payload.callType,
      call_type_other: payload.callType === 'other' ? payload.callTypeOther : null,
      manager_id: payload.managerId || null,
      additional_speakers: payload.additionalSpeakers || [],
      is_unqualified: payload.isUnqualified ?? false,
    };

    console.log("Inserting transcript for rep:", user.id, "account:", payload.accountName);

    const { data: transcript, error: insertError } = await serviceClient
      .from('call_transcripts')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create call transcript",
          details: insertError.message 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Transcript created successfully:", transcript.id);

    return new Response(
      JSON.stringify({ 
        success: true,
        transcript: {
          id: transcript.id,
          rep_id: transcript.rep_id,
          call_date: transcript.call_date,
          account_name: transcript.account_name,
          analysis_status: transcript.analysis_status,
        }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
