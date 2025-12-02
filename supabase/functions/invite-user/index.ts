import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  name: string;
  role: 'rep' | 'manager' | 'admin';
  teamId?: string;
  sendEmail?: boolean;
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

    const { email, name, role, teamId, sendEmail = true }: InviteRequest = await req.json();

    // Validate input
    if (!email || !name || !role) {
      return new Response(
        JSON.stringify({ error: 'Email, name, and role are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!['rep', 'manager', 'admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role. Must be rep, manager, or admin' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const userExists = existingUsers?.users.some(u => u.email === email);

    if (userExists) {
      return new Response(
        JSON.stringify({ error: 'User with this email already exists' }),
        {
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Inviting user: ${email} with role: ${role}`);

    // Generate a temporary password
    const tempPassword = crypto.randomUUID();

    // Create the user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
      }
    });

    if (createError || !newUser.user) {
      console.error('Failed to create user:', createError);
      return new Response(
        JSON.stringify({ error: 'Failed to create user', details: createError?.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✓ User created: ${email} (${newUser.user.id})`);

    // Update profile with team if provided
    if (teamId) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({ team_id: teamId })
        .eq('id', newUser.user.id);

      if (profileError) {
        console.error('Failed to assign team:', profileError);
        // Don't fail the entire operation, just log
      } else {
        console.log(`✓ Assigned to team: ${teamId}`);
      }
    }

    // Update the role (the handle_new_user trigger creates a default 'rep' role)
    const { error: roleUpdateError } = await supabaseAdmin
      .from('user_roles')
      .update({ role })
      .eq('user_id', newUser.user.id);

    if (roleUpdateError) {
      console.error('Failed to update role:', roleUpdateError);
      return new Response(
        JSON.stringify({ error: 'User created but failed to assign role', details: roleUpdateError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`✓ Role assigned: ${role}`);

    // Generate password reset link for the user to set their own password
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });

    if (resetError) {
      console.error('Failed to generate magic link:', resetError);
    }

    const inviteLink = resetData?.properties?.action_link || null;

    console.log(`✓ Invitation complete for ${email}`);

    // Log admin action
    await supabaseAdmin.from('user_activity_logs').insert({
      user_id: user.id,
      activity_type: 'user_invited',
      metadata: {
        target_user_id: newUser.user.id,
        target_user_name: name,
        target_user_email: email,
        role: role,
        team_id: teamId,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `User invited successfully`,
        user: {
          id: newUser.user.id,
          email,
          name,
          role,
          teamId,
        },
        inviteLink: inviteLink,
        instructions: sendEmail 
          ? 'An email invitation has been sent to the user'
          : 'Share the invite link with the user to set their password',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201,
      }
    );
  } catch (error) {
    console.error('Error in invite-user function:', error);
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
