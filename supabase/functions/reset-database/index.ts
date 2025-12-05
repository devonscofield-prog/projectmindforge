import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetRequest {
  newAdminEmail: string;
  confirmToken: string;
}

// Rate limiting: 3 attempts per hour per user (very strict for this sensitive operation)
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  
  // Passive cleanup of expired entries
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
  
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitMap.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }
  
  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }
  
  userLimit.count++;
  return { allowed: true };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has admin role using the service role client
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (roleError || !roleData) {
      console.log(`User ${user.email} attempted database reset without admin role`);
      return new Response(
        JSON.stringify({ error: 'Admin role required for this operation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limit check - strict limit for this sensitive operation
    const rateLimit = checkRateLimit(user.id);
    if (!rateLimit.allowed) {
      console.log(`Rate limit exceeded for admin ${user.email} on reset-database`);
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. This operation is limited to 3 attempts per hour.',
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter)
          } 
        }
      );
    }

    console.log(`Admin ${user.email} initiated database reset (attempt ${rateLimitMap.get(user.id)?.count || 1}/3)`);

    const { newAdminEmail, confirmToken }: ResetRequest = await req.json();

    // Simple confirmation token check
    if (confirmToken !== 'CONFIRM_RESET_DATABASE') {
      return new Response(
        JSON.stringify({ error: 'Invalid confirmation token' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!newAdminEmail || !newAdminEmail.includes('@')) {
      return new Response(
        JSON.stringify({ error: 'Valid email required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Starting database reset...');
    console.log(`New admin email will be: ${newAdminEmail}`);

    // Step 1: Delete all data in correct foreign key order
    const tables = [
      // MFA tables first (reference auth.users)
      'user_trusted_devices',
      'mfa_enrollment_status',
      // Performance snapshots
      'rep_performance_snapshots',
      // Original tables
      'call_stakeholder_mentions',
      'call_products',
      'ai_call_analysis',
      'coaching_trend_analyses',
      'coaching_sessions',
      'account_follow_ups',
      'prospect_activities',
      'email_logs',
      'stakeholder_relationships',
      'stakeholders',
      'call_transcripts',
      'prospects',
      'activity_logs',
      'analysis_sessions',
      'admin_chat_insights',
      'admin_custom_presets',
      'admin_transcript_selections',
      'performance_alert_config',
      'performance_alert_history',
      'implemented_recommendations',
      'data_access_logs',
      'activity_templates',
      'dashboard_cache',
      'performance_metrics',
      'user_activity_logs',
      'transcript_chunks',
    ];

    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.error(`Error deleting from ${table}:`, error);
      } else {
        console.log(`✓ Deleted all records from ${table}`);
      }
    }

    // Step 2: Delete all teams
    console.log('Updating profiles to remove team assignments...');
    const { error: unassignError } = await supabaseAdmin
      .from('profiles')
      .update({ team_id: null })
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (unassignError) {
      console.error('Error unassigning teams:', unassignError);
    }

    console.log('Deleting all teams...');
    const { error: teamsError } = await supabaseAdmin
      .from('teams')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');
    
    if (teamsError) {
      console.error('Error deleting teams:', teamsError);
    } else {
      console.log('✓ Deleted all teams');
    }

    // Step 3: Delete all users using Admin API
    console.log('Fetching all users...');
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(
        JSON.stringify({ error: 'Failed to list users', details: listError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${users.users.length} users to delete`);
    
    for (const user of users.users) {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (deleteError) {
        console.error(`Error deleting user ${user.email}:`, deleteError);
      } else {
        console.log(`✓ Deleted user: ${user.email}`);
      }
    }

    // Step 4: Store pending admin email in app_settings
    console.log('Setting pending admin email...');
    const { error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .upsert({ 
        key: 'pending_admin_email', 
        value: newAdminEmail 
      });
    
    if (settingsError) {
      console.error('Error setting pending admin email:', settingsError);
      return new Response(
        JSON.stringify({ error: 'Failed to set pending admin email', details: settingsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('✓ Database reset complete!');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Database reset successfully',
        pendingAdminEmail: newAdminEmail,
        instructions: `Sign up with ${newAdminEmail} to receive admin access automatically.`,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in reset-database function:', error);
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
