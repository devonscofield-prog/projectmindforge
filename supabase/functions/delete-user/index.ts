import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get the calling user
    const { data: { user: callingUser }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !callingUser) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify calling user is an admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', callingUser.id)
      .maybeSingle();

    if (roleError || !roleData || roleData.role !== 'admin') {
      console.error('Role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { targetUserId } = await req.json();

    if (!targetUserId) {
      return new Response(
        JSON.stringify({ error: 'targetUserId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent self-deletion
    if (targetUserId === callingUser.id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user info for logging
    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', targetUserId)
      .maybeSingle();

    if (targetUserError || !targetUser) {
      console.error('Target user not found:', targetUserError);
      return new Response(
        JSON.stringify({ error: 'Target user not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Admin ${callingUser.email} deleting user ${targetUser.email} (${targetUserId})`);

    // Log deletion BEFORE we delete anything (so we have the audit trail)
    const { error: logError } = await supabaseAdmin
      .from('user_activity_logs')
      .insert({
        user_id: callingUser.id,
        activity_type: 'user_deleted',
        metadata: {
          deleted_user_id: targetUserId,
          deleted_user_name: targetUser.name,
          deleted_user_email: targetUser.email,
          deleted_at: new Date().toISOString(),
        }
      });

    if (logError) {
      console.error('Failed to log deletion:', logError);
      // Continue anyway - deletion is more important than logging
    }

    // Delete related data in correct order to avoid FK violations
    // Tables without FK cascade constraints need manual cleanup
    
    console.log('Starting data cleanup for user:', targetUserId);

    // 1. Get stakeholder IDs for this user to delete mentions
    const { data: stakeholderIds } = await supabaseAdmin
      .from('stakeholders')
      .select('id')
      .eq('rep_id', targetUserId);
    
    if (stakeholderIds && stakeholderIds.length > 0) {
      const ids = stakeholderIds.map(s => s.id);
      await supabaseAdmin.from('call_stakeholder_mentions').delete().in('stakeholder_id', ids);
      console.log('Deleted call_stakeholder_mentions');
    }

    // 2. Delete stakeholder relationships
    await supabaseAdmin.from('stakeholder_relationships').delete().eq('rep_id', targetUserId);
    console.log('Deleted stakeholder_relationships');

    // 3. Delete stakeholders
    await supabaseAdmin.from('stakeholders').delete().eq('rep_id', targetUserId);
    console.log('Deleted stakeholders');

    // 4. Get call transcript IDs for this user
    const { data: callIds } = await supabaseAdmin
      .from('call_transcripts')
      .select('id')
      .eq('rep_id', targetUserId);

    if (callIds && callIds.length > 0) {
      const ids = callIds.map(c => c.id);
      // Delete call_products
      await supabaseAdmin.from('call_products').delete().in('call_id', ids);
      console.log('Deleted call_products');
      // Delete transcript_chunks
      await supabaseAdmin.from('transcript_chunks').delete().in('transcript_id', ids);
      console.log('Deleted transcript_chunks');
    }

    // 5. Delete AI analysis
    await supabaseAdmin.from('ai_call_analysis').delete().eq('rep_id', targetUserId);
    console.log('Deleted ai_call_analysis');

    // 6. Delete call transcripts
    await supabaseAdmin.from('call_transcripts').delete().eq('rep_id', targetUserId);
    console.log('Deleted call_transcripts');

    // 7. Delete prospect-related data
    await supabaseAdmin.from('prospect_activities').delete().eq('rep_id', targetUserId);
    console.log('Deleted prospect_activities');

    await supabaseAdmin.from('account_follow_ups').delete().eq('rep_id', targetUserId);
    console.log('Deleted account_follow_ups');

    await supabaseAdmin.from('email_logs').delete().eq('rep_id', targetUserId);
    console.log('Deleted email_logs');

    await supabaseAdmin.from('prospects').delete().eq('rep_id', targetUserId);
    console.log('Deleted prospects');

    // 8. Delete coaching/analysis data
    await supabaseAdmin.from('coaching_trend_analyses').delete().eq('rep_id', targetUserId);
    console.log('Deleted coaching_trend_analyses');

    await supabaseAdmin.from('analysis_sessions').delete().eq('user_id', targetUserId);
    console.log('Deleted analysis_sessions');

    // 9. Delete admin-specific data (in case they were an admin)
    await supabaseAdmin.from('admin_chat_insights').delete().eq('admin_id', targetUserId);
    console.log('Deleted admin_chat_insights');

    await supabaseAdmin.from('admin_custom_presets').delete().eq('admin_id', targetUserId);
    console.log('Deleted admin_custom_presets');

    await supabaseAdmin.from('admin_transcript_selections').delete().eq('admin_id', targetUserId);
    console.log('Deleted admin_transcript_selections');

    // 10. Delete performance/monitoring data
    await supabaseAdmin.from('performance_alert_config').delete().eq('user_id', targetUserId);
    console.log('Deleted performance_alert_config');

    await supabaseAdmin.from('implemented_recommendations').delete().eq('user_id', targetUserId);
    console.log('Deleted implemented_recommendations');

    await supabaseAdmin.from('data_access_logs').delete().eq('user_id', targetUserId);
    console.log('Deleted data_access_logs');

    await supabaseAdmin.from('performance_metrics').delete().eq('user_id', targetUserId);
    console.log('Deleted performance_metrics');

    // 11. Delete auth-related data
    await supabaseAdmin.from('user_trusted_devices').delete().eq('user_id', targetUserId);
    console.log('Deleted user_trusted_devices');

    await supabaseAdmin.from('mfa_enrollment_status').delete().eq('user_id', targetUserId);
    console.log('Deleted mfa_enrollment_status');

    // 12. Delete activity templates
    await supabaseAdmin.from('activity_templates').delete().eq('user_id', targetUserId);
    console.log('Deleted activity_templates');

    // 13. Delete user's own activity logs (but NOT the deletion log we just created)
    await supabaseAdmin.from('user_activity_logs').delete().eq('user_id', targetUserId);
    console.log('Deleted user_activity_logs');

    // 14. Finally, delete the auth user (this cascades to profiles, user_roles, etc.)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(targetUserId);

    if (deleteAuthError) {
      console.error('Failed to delete auth user:', deleteAuthError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to delete user from authentication system',
          details: deleteAuthError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('User deletion complete for:', targetUser.email);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: `User ${targetUser.email} has been permanently deleted`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
