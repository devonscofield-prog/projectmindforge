import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetRequest {
  newAdminEmail: string;
  confirmToken: string;
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
