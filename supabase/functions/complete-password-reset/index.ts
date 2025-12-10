import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompleteResetRequest {
  email: string;
  sessionToken: string;
  newPassword: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { email, sessionToken, newPassword }: CompleteResetRequest = await req.json();

    if (!email || !sessionToken || !newPassword) {
      return new Response(
        JSON.stringify({ error: 'Email, session token, and new password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate password complexity
    if (newPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[A-Z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'Password must contain at least one uppercase letter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[a-z]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'Password must contain at least one lowercase letter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!/[0-9]/.test(newPassword)) {
      return new Response(
        JSON.stringify({ error: 'Password must contain at least one number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find user by email
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      console.error('Failed to list users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const targetUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid session' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate session token
    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('password_reset_otps')
      .select('*')
      .eq('user_id', targetUser.id)
      .eq('otp_code', sessionToken)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) {
      console.error('Failed to validate session:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tokenRecord) {
      return new Response(
        JSON.stringify({ error: 'Session expired. Please start over.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark session token as used
    await supabaseAdmin
      .from('password_reset_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // Update password using Admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Failed to update password:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update password' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the password reset
    await supabaseAdmin.from('user_activity_logs').insert({
      user_id: targetUser.id,
      activity_type: 'password_reset_completed',
      metadata: {
        method: 'otp',
        initiated_by: tokenRecord.created_by,
      },
    });

    console.log(`✓ Password reset completed for user ${targetUser.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password updated successfully. You can now sign in with your new password.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in complete-password-reset:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
