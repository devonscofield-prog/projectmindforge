import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  userId: string;
  sendEmail?: boolean;
  skipEmail?: boolean; // New: explicitly skip email delivery
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

    const { userId, sendEmail = true, skipEmail = false, redirectTo }: ResetPasswordRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Generating password reset for user: ${userId}, skipEmail: ${skipEmail}`);

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
    const baseUrl = customDomain 
      ? `https://${customDomain}`
      : `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}`;
    
    const defaultRedirect = `${baseUrl}/auth`;
    
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

    // Get target user profile for personalization
    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();

    const userName = targetProfile?.name || 'there';
    const userEmail = targetProfile?.email || userData.user.email;
    
    // The raw Supabase reset link
    const supabaseResetLink = resetData.properties.action_link;
    
    // Create an intermediate landing page link that requires user interaction
    // This prevents corporate email scanners from consuming the one-time token
    const encodedSupabaseLink = btoa(supabaseResetLink);
    const resetLink = `${baseUrl}/auth/reset-verify?link=${encodeURIComponent(encodedSupabaseLink)}`;

    // Send email via Resend if not explicitly skipped
    let emailSent = false;
    let emailError: string | null = null;

    if (!skipEmail && sendEmail && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const { error: resendError } = await resend.emails.send({
          from: 'StormWind Studios <noreply@stormwindstudios.com>',
          to: [userEmail!],
          subject: 'Reset Your Password - StormWind Studios',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Request</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
                  <p style="margin-top: 0;">Hi ${userName},</p>
                  
                  <p>An administrator has requested a password reset for your StormWind Studios account.</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${resetLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                      Reset My Password
                    </a>
                  </div>
                  
                  <div style="background: #d4edda; border: 1px solid #28a745; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; color: #155724; font-size: 14px;">
                      <strong>✓ Scanner-Safe Link:</strong> This link uses a confirmation page that prevents 
                      corporate email security scanners from invalidating your reset. Simply click the button 
                      and confirm on the next page.
                    </p>
                  </div>
                  
                  <p style="font-size: 14px; color: #6c757d;">
                    This link will expire in 24 hours. If you didn't request this reset, you can safely ignore this email.
                  </p>
                  
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;">
                  
                  <p style="font-size: 12px; color: #6c757d; margin-bottom: 0;">
                    If the button doesn't work, copy and paste this link into your browser:<br>
                    <span style="word-break: break-all; color: #667eea;">${resetLink}</span>
                  </p>
                </div>
                
                <p style="text-align: center; font-size: 12px; color: #adb5bd; margin-top: 20px;">
                  © ${new Date().getFullYear()} StormWind Studios. All rights reserved.
                </p>
              </body>
            </html>
          `,
        });

        if (resendError) {
          console.error('Resend email error:', resendError);
          emailError = resendError.message;
        } else {
          emailSent = true;
          console.log(`✓ Password reset email sent to ${userEmail}`);
        }
      } catch (err) {
        console.error('Failed to send email via Resend:', err);
        emailError = err instanceof Error ? err.message : 'Unknown email error';
      }
    } else if (skipEmail) {
      console.log('Email skipped by request - link only mode');
    } else if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured - email not sent');
      emailError = 'Email service not configured';
    }

    // Log admin action
    await supabaseAdmin.from('user_activity_logs').insert({
      user_id: user.id,
      activity_type: 'password_reset_requested',
      metadata: {
        target_user_id: userId,
        target_user_name: userName,
        target_user_email: userEmail,
        email_sent: emailSent,
        email_skipped: skipEmail,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? 'Password reset email sent successfully'
          : skipEmail 
            ? 'Password reset link generated (email skipped)'
            : 'Password reset link generated',
        resetLink,
        email: userEmail,
        emailSent,
        emailSkipped: skipEmail,
        emailError,
        instructions: emailSent 
          ? 'An email has been sent to the user with reset instructions.'
          : skipEmail
            ? 'Share the reset link directly with the user via Slack, Teams, or another secure channel.'
            : emailError
              ? `Email delivery failed: ${emailError}. Please share the link manually.`
              : 'Share the reset link with the user.',
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
