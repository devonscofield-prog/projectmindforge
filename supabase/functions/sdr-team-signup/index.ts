import { createClient } from "@supabase/supabase-js";
import { getCorsHeaders } from "../_shared/cors.ts";

const ALLOWED_EMAIL_DOMAIN = 'stormwindlive.com';

interface SignupRequest {
  inviteToken: string;
  email: string;
  name: string;
  password: string;
}

interface ValidateRequest {
  inviteToken: string;
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const body = await req.json();

    // If only inviteToken is provided, this is a validation request
    if (body.inviteToken && !body.email) {
      return handleValidate(supabaseAdmin, body as ValidateRequest);
    }

    // Otherwise, this is a signup request
    return handleSignup(supabaseAdmin, body as SignupRequest);
  } catch (error) {
    const requestId = crypto.randomUUID().slice(0, 8);
    console.error(`[sdr-team-signup] Error ${requestId}:`, error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.', requestId }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function handleValidate(supabaseAdmin: any, { inviteToken }: ValidateRequest) {
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('sdr_team_invites')
    .select('id, team_id, is_active, max_uses, times_used, expires_at, sdr_teams(id, name)')
    .eq('invite_token', inviteToken)
    .single();

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: 'Invalid invite link' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!invite.is_active) {
    return new Response(
      JSON.stringify({ error: 'This invite link is no longer active' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'This invite link has expired' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (invite.max_uses && invite.times_used >= invite.max_uses) {
    return new Response(
      JSON.stringify({ error: 'This invite link has reached its maximum number of uses' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  return new Response(
    JSON.stringify({
      valid: true,
      teamName: invite.sdr_teams?.name || 'Unknown Team',
      allowedDomain: ALLOWED_EMAIL_DOMAIN,
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

async function handleSignup(supabaseAdmin: any, { inviteToken, email, name, password }: SignupRequest) {
  // Validate all required fields
  if (!inviteToken || !email || !name || !password) {
    return new Response(
      JSON.stringify({ error: 'Invite token, email, name, and password are all required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate email domain
  const emailDomain = email.toLowerCase().split('@')[1];
  if (emailDomain !== ALLOWED_EMAIL_DOMAIN) {
    return new Response(
      JSON.stringify({ error: `Only @${ALLOWED_EMAIL_DOMAIN} email addresses are allowed` }),
      {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate password strength
  if (password.length < 8) {
    return new Response(
      JSON.stringify({ error: 'Password must be at least 8 characters' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate invite token
  const { data: invite, error: inviteError } = await supabaseAdmin
    .from('sdr_team_invites')
    .select('id, team_id, is_active, max_uses, times_used, expires_at')
    .eq('invite_token', inviteToken)
    .single();

  if (inviteError || !invite) {
    return new Response(
      JSON.stringify({ error: 'Invalid invite link' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (!invite.is_active) {
    return new Response(
      JSON.stringify({ error: 'This invite link is no longer active' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new Response(
      JSON.stringify({ error: 'This invite link has expired' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  if (invite.max_uses && invite.times_used >= invite.max_uses) {
    return new Response(
      JSON.stringify({ error: 'This invite link has reached its maximum number of uses' }),
      {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Check if user already exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
  const userExists = existingUsers?.users.some((u: any) => u.email === email.toLowerCase());

  if (userExists) {
    return new Response(
      JSON.stringify({ error: 'An account with this email already exists. Please sign in instead.' }),
      {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(`Self-signup: ${email} via invite token for team ${invite.team_id}`);

  // Create the user
  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });

  if (createError || !newUser.user) {
    console.error('Failed to create user:', createError);
    return new Response(
      JSON.stringify({ error: 'Failed to create account' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  console.log(`✓ User created: ${email} (${newUser.user.id})`);

  // Update role from default 'rep' to 'sdr'
  const { error: roleUpdateError } = await supabaseAdmin
    .from('user_roles')
    .update({ role: 'sdr' })
    .eq('user_id', newUser.user.id);

  if (roleUpdateError) {
    console.error('Failed to update role:', roleUpdateError);
  } else {
    console.log(`✓ Role assigned: sdr`);
  }

  // Add to SDR team
  const { error: teamMemberError } = await supabaseAdmin
    .from('sdr_team_members')
    .insert({
      team_id: invite.team_id,
      user_id: newUser.user.id,
    });

  if (teamMemberError) {
    console.error('Failed to add to SDR team:', teamMemberError);
  } else {
    console.log(`✓ Added to SDR team: ${invite.team_id}`);
  }

  // Increment invite usage count
  await supabaseAdmin
    .from('sdr_team_invites')
    .update({
      times_used: invite.times_used + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invite.id);

  // Log the self-signup
  await supabaseAdmin.from('user_activity_logs').insert({
    user_id: newUser.user.id,
    activity_type: 'self_signup',
    metadata: {
      invite_token_id: invite.id,
      team_id: invite.team_id,
      role: 'sdr',
    },
  });

  console.log(`✓ Self-signup complete for ${email}`);

  return new Response(
    JSON.stringify({
      success: true,
      message: 'Account created successfully. You can now sign in.',
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 201,
    }
  );
}
