import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user: requestingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await userClient
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUser.id)
      .single();

    if (roleError || !roleData || roleData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can reset MFA' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { targetUserId } = await req.json();
    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'Target user ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${requestingUser.id} resetting MFA for user ${targetUserId}`);

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the user's MFA factors
    const { data: factorsData, error: factorsError } = await adminClient.auth.admin.mfa.listFactors({
      userId: targetUserId
    });

    if (factorsError) {
      console.error('Failed to list MFA factors:', factorsError);
    }

    // Delete all MFA factors
    let deletedCount = 0;
    if (factorsData?.factors) {
      for (const factor of factorsData.factors) {
        const { error: deleteError } = await adminClient.auth.admin.mfa.deleteFactor({
          userId: targetUserId,
          id: factor.id
        });
        if (!deleteError) {
          deletedCount++;
        }
      }
    }

    // Clear all trusted devices
    await adminClient
      .from('user_trusted_devices')
      .delete()
      .eq('user_id', targetUserId);

    // Update MFA enrollment status
    await adminClient
      .from('mfa_enrollment_status')
      .upsert({
        user_id: targetUserId,
        is_enrolled: false,
        enrolled_at: null,
        reset_at: new Date().toISOString(),
        reset_by: requestingUser.id,
        updated_at: new Date().toISOString()
      });

    // Log the action
    await adminClient.from('user_activity_logs').insert({
      user_id: requestingUser.id,
      activity_type: 'user_profile_updated',
      metadata: {
        action: 'mfa_reset',
        target_user_id: targetUserId,
        factors_deleted: deletedCount
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'MFA has been reset. User will need to set up MFA again on next login.',
        factorsDeleted: deletedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error resetting MFA:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
