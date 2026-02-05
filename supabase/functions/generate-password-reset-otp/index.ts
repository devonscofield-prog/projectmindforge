import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateOTPRequest {
  userId: string;
}

function generateOTP(): string {
  // Generate cryptographically secure 6-digit code
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return String(array[0] % 1000000).padStart(6, '0');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId }: GenerateOTPRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting: Check recent OTPs for this user (max 3 per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabaseAdmin
      .from('password_reset_otps')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo);

    if (recentCount && recentCount >= 3) {
      return new Response(
        JSON.stringify({ error: 'Too many reset requests. Please wait before trying again.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get target user info
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: targetProfile } = await supabaseAdmin
      .from('profiles')
      .select('name, email')
      .eq('id', userId)
      .single();

    const userName = targetProfile?.name || 'there';
    const userEmail = targetProfile?.email || userData.user.email!;

    // Invalidate any existing unused OTPs for this user
    await supabaseAdmin
      .from('password_reset_otps')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('used_at', null);

    // Generate new OTP
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    // Store OTP
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_otps')
      .insert({
        user_id: userId,
        otp_code: otpCode,
        expires_at: expiresAt,
        created_by: user.id,
      });

    if (insertError) {
      console.error('Failed to store OTP:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to generate reset code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✓ OTP generated for user ${userId}`);

    // Send email via Resend
    let emailSent = false;
    let emailError: string | null = null;

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        
        const customDomain = Deno.env.get('CUSTOM_DOMAIN');
        const loginUrl = customDomain 
          ? `https://${customDomain}/auth`
          : `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/auth`;

        const { error: resendError } = await resend.emails.send({
          from: 'StormWind Studios <noreply@stormwindstudios.com>',
          to: [userEmail],
          subject: 'Your Password Reset Code - StormWind Studios',
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; border-radius: 12px 12px 0 0; text-align: center;">
                  <h1 style="color: white; margin: 0; font-size: 24px;">Password Reset Code</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 30px 20px; border-radius: 0 0 12px 12px; border: 1px solid #e9ecef; border-top: none;">
                  <p style="margin-top: 0;">Hi ${userName},</p>
                  
                  <p>Your password reset code is:</p>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <div style="display: inline-block; background: #1a1a2e; color: white; padding: 20px 40px; border-radius: 12px; font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px;">
                      ${otpCode}
                    </div>
                  </div>
                  
                  <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; color: #856404; font-size: 14px;">
                      <strong>⏱️ This code expires in 15 minutes.</strong>
                    </p>
                  </div>
                  
                  <p><strong>To reset your password:</strong></p>
                  <ol style="padding-left: 20px;">
                    <li>Go to <a href="${loginUrl}" style="color: #667eea;">${loginUrl}</a></li>
                    <li>Click "Have a reset code?"</li>
                    <li>Enter the 6-digit code above</li>
                    <li>Set your new password</li>
                  </ol>
                  
                  <hr style="border: none; border-top: 1px solid #e9ecef; margin: 25px 0;">
                  
                  <p style="font-size: 12px; color: #6c757d; margin-bottom: 0;">
                    If you didn't request this code, you can safely ignore this email.
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
          console.log(`✓ OTP email sent to ${userEmail}`);
        }
      } catch (err) {
        console.error('Failed to send email via Resend:', err);
        emailError = err instanceof Error ? err.message : 'Unknown email error';
      }
    } else {
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
        method: 'otp',
        email_sent: emailSent,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: emailSent 
          ? 'Reset code sent to user\'s email'
          : 'Reset code generated but email failed',
        email: userEmail,
        emailSent,
        emailError,
        expiresAt,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in generate-password-reset-otp:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
