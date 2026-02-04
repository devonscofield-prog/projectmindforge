import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  name: string;
  role: 'rep' | 'manager' | 'admin' | 'trainee';
  teamId?: string;
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
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
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

    const { email, name, role, teamId, sendEmail = true, redirectTo }: InviteRequest = await req.json();

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

    // Generate invite link for the user to set their own password
    const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: {
        redirectTo: redirectTo || `https://projectmindforge.lovable.app/auth`
      }
    });

    if (resetError) {
      console.error('Failed to generate magic link:', resetError);
    }

    const inviteLink = resetData?.properties?.action_link || null;

    // Send invitation email via Resend
    let emailSent = false;
    let emailError: string | null = null;

    if (sendEmail && inviteLink && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const roleDisplayName = {
          rep: 'Sales Rep',
          manager: 'Manager',
          admin: 'Administrator',
          trainee: 'Trainee'
        }[role];

        const { error: sendError } = await resend.emails.send({
          from: 'MindForge <invitations@mindforgenotifications.com>',
          to: [email],
          subject: `You've been invited to join MindForge`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to MindForge!</h1>
              </div>
              
              <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
                <p style="font-size: 18px; margin-top: 0;">Hi <strong>${name}</strong>,</p>
                
                <p>You've been invited to join <strong>MindForge</strong> as a <strong>${roleDisplayName}</strong>.</p>
                
                <p>Click the button below to set up your account and get started:</p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${inviteLink}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Accept Invitation
                  </a>
                </div>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #666;">
                    <strong>What's next?</strong><br>
                    1. Click the link to create your password<br>
                    2. Set up two-factor authentication (2FA) for security<br>
                    Have an authenticator app ready (like Google Authenticator or Authy).
                  </p>
                </div>
                
                <p style="color: #666; font-size: 13px; margin-bottom: 0;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <a href="${inviteLink}" style="color: #6366f1; word-break: break-all;">${inviteLink}</a>
                </p>
                
                <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 25px 0;">
                
                <p style="color: #999; font-size: 12px; margin-bottom: 0;">
                  This invitation link will expire in 24 hours. If you didn't expect this invitation, you can safely ignore this email.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (sendError) {
          console.error('Failed to send invitation email:', sendError);
          emailError = sendError.message;
        } else {
          emailSent = true;
          console.log(`✓ Invitation email sent to ${email}`);
        }
      } catch (err) {
        console.error('Error sending invitation email:', err);
        emailError = err instanceof Error ? err.message : 'Unknown email error';
      }
    } else if (sendEmail && !resendApiKey) {
      console.warn('RESEND_API_KEY not configured - skipping email send');
      emailError = 'Email service not configured';
    }

    console.log(`✓ Invitation complete for ${email} (email sent: ${emailSent})`);

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
        email_sent: emailSent,
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
        emailSent: emailSent,
        emailError: emailError,
        instructions: emailSent 
          ? 'An email invitation has been sent to the user'
          : inviteLink 
            ? 'Share the invite link with the user to set their password'
            : 'User created but no invite link generated',
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
