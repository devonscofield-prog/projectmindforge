import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
  sendEmail?: boolean;
  redirectTo?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin
    const { data: userRole, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || userRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { userId, sendEmail = true, redirectTo }: ResetPasswordRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Generating password reset for user: ${userId}`);

    // Get user email
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate password reset link (recovery type, not magiclink)
    // Use custom domain from env if available, otherwise fall back to lovableproject.com
    const customDomain = Deno.env.get('CUSTOM_DOMAIN');
    const defaultRedirect = customDomain 
      ? `https://${customDomain}/auth`
      : `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/auth`;
    
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userData.user.email!,
      options: {
        redirectTo: redirectTo || defaultRedirect
      }
    });

    if (resetError) {
      console.error('Failed to generate password reset link:', resetError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset link', details: resetError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✓ Password reset link generated for ${userData.user.email}`);

    // Log admin action
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();

    await supabaseAdmin.from('user_activity_logs').insert({
      user_id: user.id,
      activity_type: 'password_reset_requested',
      metadata: {
        target_user_id: userId,
        target_user_name: targetProfile?.name || 'Unknown',
        target_user_email: targetProfile?.email || userData.user.email,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset link generated',
        resetLink: resetData.properties.action_link,
        email: userData.user.email,
        instructions: sendEmail 
          ? 'Reset link has been sent to the user\'s email'
          : 'Share the reset link with the user',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in reset-user-password function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
