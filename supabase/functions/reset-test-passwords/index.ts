import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  password?: string;
}

const TEST_USERS = [
  'admin@example.com',
  'manager.east@example.com',
  'manager.west@example.com',
  'rep.east.1@example.com',
  'rep.west.1@example.com',
];

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

    const { password = 'TestPassword123!' }: ResetPasswordRequest = await req.json();

    console.log('Resetting passwords for test users...');

    const results = [];

    for (const email of TEST_USERS) {
      // Find user by email
      const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (listError) {
        console.error(`Error listing users: ${listError.message}`);
        results.push({ email, success: false, error: listError.message });
        continue;
      }

      const user = users.users.find(u => u.email === email);
      
      if (!user) {
        console.log(`User not found: ${email}`);
        results.push({ email, success: false, error: 'User not found' });
        continue;
      }

      // Update user password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        user.id,
        { password }
      );

      if (updateError) {
        console.error(`Failed to update password for ${email}: ${updateError.message}`);
        results.push({ email, success: false, error: updateError.message });
      } else {
        console.log(`Successfully reset password for ${email}`);
        results.push({ email, success: true });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        message: `Reset complete: ${successCount}/${TEST_USERS.length} users updated`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in reset-test-passwords function:', error);
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
