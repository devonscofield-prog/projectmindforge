import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SeedUser {
  email: string
  name: string
  role: 'admin' | 'manager' | 'rep'
  teamKey?: 'east' | 'west'
  notes?: string
}

// Generate a cryptographically secure random password
function generateSecurePassword(length: number = 16): string {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  const array = new Uint8Array(length)
  crypto.getRandomValues(array)
  return Array.from(array, byte => charset[byte % charset.length]).join('')
}

// User definitions WITHOUT hardcoded passwords
const SEED_USERS: SeedUser[] = [
  // Admin
  {
    email: 'admin@example.com',
    name: 'Alex Administrator',
    role: 'admin',
    notes: 'System administrator with full access to all teams and data.'
  },
  // Managers
  {
    email: 'manager.east@example.com',
    name: 'Emily Eastman',
    role: 'manager',
    teamKey: 'east',
    notes: 'Leads the Enterprise East team. Focused on enterprise accounts in the Eastern region.'
  },
  {
    email: 'manager.west@example.com',
    name: 'William Westbrook',
    role: 'manager',
    teamKey: 'west',
    notes: 'Leads the Enterprise West team. Specializes in tech sector clients.'
  },
  // East Reps
  {
    email: 'rep.east.1@example.com',
    name: 'Sarah Chen',
    role: 'rep',
    teamKey: 'east',
    notes: 'Strong at discovery calls. Needs improvement on closing techniques.'
  },
  {
    email: 'rep.east.2@example.com',
    name: 'Michael Torres',
    role: 'rep',
    teamKey: 'east',
    notes: 'Excellent closer. Working on increasing pipeline volume.'
  },
  {
    email: 'rep.east.3@example.com',
    name: 'Jennifer Park',
    role: 'rep',
    teamKey: 'east',
    notes: 'Top performer last quarter. Mentoring newer team members.'
  },
  {
    email: 'rep.east.4@example.com',
    name: 'David Williams',
    role: 'rep',
    teamKey: 'east',
    notes: 'New hire, ramping up. Shows strong potential in cold outreach.'
  },
  // West Reps
  {
    email: 'rep.west.1@example.com',
    name: 'Amanda Johnson',
    role: 'rep',
    teamKey: 'west',
    notes: 'Consistent performer. Excellent at objection handling.'
  },
  {
    email: 'rep.west.2@example.com',
    name: 'Ryan Martinez',
    role: 'rep',
    teamKey: 'west',
    notes: 'Strong LinkedIn prospecting. Needs to focus on demo conversion.'
  },
  {
    email: 'rep.west.3@example.com',
    name: 'Lisa Thompson',
    role: 'rep',
    teamKey: 'west',
    notes: 'At risk of missing quota. Requires additional coaching support.'
  },
  {
    email: 'rep.west.4@example.com',
    name: 'Kevin Brown',
    role: 'rep',
    teamKey: 'west',
    notes: 'Exceeding targets consistently. Ready for senior rep promotion.'
  },
]

const FOCUS_AREAS = ['Discovery', 'Objection Handling', 'Closing', 'Time Management', 'Pipeline Building', 'Demo Skills']
const ACTIVITY_TYPES = ['cold_calls', 'emails', 'linkedin', 'demos', 'meetings', 'proposals'] as const

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the user is authenticated and is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create a client with the user's JWT to verify their identity
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    })

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Check if user has admin role
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (roleError || !roleData) {
      console.log(`User ${user.email} attempted seed-demo-data without admin role`)
      return new Response(
        JSON.stringify({ error: 'Admin role required for this operation' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Admin ${user.email} initiated seed-demo-data`)

    const results: string[] = []
    const userIds: Record<string, string> = {}
    const teamIds: Record<string, string> = {}
    
    // Store generated credentials to return to the caller
    const generatedCredentials: Array<{ email: string; password: string; role: string }> = []

    // Step 1: Create or get auth users
    results.push('=== Creating Auth Users ===')
    for (const user of SEED_USERS) {
      // Check if user exists
      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = existingUsers?.users.find(u => u.email === user.email)
      
      if (existingUser) {
        userIds[user.email] = existingUser.id
        results.push(`User ${user.email} already exists (${existingUser.id})`)
      } else {
        // Generate a secure random password for each new user
        const password = generateSecurePassword(20)
        
        const { data: newUser, error } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: password,
          email_confirm: true,
          user_metadata: { name: user.name }
        })
        
        if (error) {
          results.push(`Error creating ${user.email}: ${error.message}`)
          continue
        }
        
        userIds[user.email] = newUser.user.id
        results.push(`Created user ${user.email} (${newUser.user.id})`)
        
        // Store the credentials to return (only for newly created users)
        generatedCredentials.push({
          email: user.email,
          password: password,
          role: user.role
        })
      }
    }

    // Step 2: Create teams (need manager IDs first)
    results.push('\n=== Creating Teams ===')
    const eastManagerId = userIds['manager.east@example.com']
    const westManagerId = userIds['manager.west@example.com']

    // Delete existing teams with these names first
    await supabaseAdmin.from('teams').delete().eq('name', 'Enterprise East')
    await supabaseAdmin.from('teams').delete().eq('name', 'Enterprise West')

    const { data: eastTeam, error: eastError } = await supabaseAdmin
      .from('teams')
      .insert({ name: 'Enterprise East', manager_id: eastManagerId })
      .select()
      .single()
    
    if (eastError) {
      results.push(`Error creating East team: ${eastError.message}`)
    } else {
      teamIds['east'] = eastTeam.id
      results.push(`Created team Enterprise East (${eastTeam.id})`)
    }

    const { data: westTeam, error: westError } = await supabaseAdmin
      .from('teams')
      .insert({ name: 'Enterprise West', manager_id: westManagerId })
      .select()
      .single()
    
    if (westError) {
      results.push(`Error creating West team: ${westError.message}`)
    } else {
      teamIds['west'] = westTeam.id
      results.push(`Created team Enterprise West (${westTeam.id})`)
    }

    // Step 3: Update profiles with team assignments and notes
    results.push('\n=== Updating Profiles ===')
    for (const user of SEED_USERS) {
      const userId = userIds[user.email]
      if (!userId) continue

      const hireDate = new Date()
      hireDate.setMonth(hireDate.getMonth() - (3 + Math.floor(Math.random() * 9))) // 3-12 months ago
      
      const teamId = user.teamKey ? teamIds[user.teamKey] : null
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({
          name: user.name,
          team_id: user.role === 'rep' ? teamId : (user.role === 'manager' ? teamId : null),
          hire_date: hireDate.toISOString().split('T')[0],
          is_active: true,
          notes: user.notes || null
        })
        .eq('id', userId)
      
      if (error) {
        results.push(`Error updating profile ${user.email}: ${error.message}`)
      } else {
        results.push(`Updated profile for ${user.email}`)
      }
    }

    // Step 4: Update user roles
    results.push('\n=== Setting User Roles ===')
    for (const user of SEED_USERS) {
      const userId = userIds[user.email]
      if (!userId) continue

      // Update existing role or insert new one
      const { error } = await supabaseAdmin
        .from('user_roles')
        .update({ role: user.role })
        .eq('user_id', userId)
      
      if (error) {
        results.push(`Error updating role for ${user.email}: ${error.message}`)
      } else {
        results.push(`Set role ${user.role} for ${user.email}`)
      }
    }

    // Step 5: Create performance snapshots for reps
    results.push('\n=== Creating Performance Snapshots ===')
    const reps = SEED_USERS.filter(u => u.role === 'rep')
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() + 1
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear

    // Performance profiles for variety
    const performanceProfiles = [
      { demoGoal: 12, revenueGoal: 10000, currentDemos: 8, currentRevenue: 7500, prevDemos: 11, prevRevenue: 9800 },
      { demoGoal: 15, revenueGoal: 12000, currentDemos: 14, currentRevenue: 13500, prevDemos: 16, prevRevenue: 14000 },
      { demoGoal: 10, revenueGoal: 8000, currentDemos: 3, currentRevenue: 2000, prevDemos: 8, prevRevenue: 7000 },
      { demoGoal: 12, revenueGoal: 10000, currentDemos: 6, currentRevenue: 5000, prevDemos: 10, prevRevenue: 9500 },
      { demoGoal: 14, revenueGoal: 11000, currentDemos: 12, currentRevenue: 10500, prevDemos: 13, prevRevenue: 11200 },
      { demoGoal: 10, revenueGoal: 9000, currentDemos: 11, currentRevenue: 10000, prevDemos: 9, prevRevenue: 8500 },
      { demoGoal: 13, revenueGoal: 12000, currentDemos: 4, currentRevenue: 3500, prevDemos: 7, prevRevenue: 6000 },
      { demoGoal: 15, revenueGoal: 15000, currentDemos: 17, currentRevenue: 16500, prevDemos: 14, prevRevenue: 15200 },
    ]

    for (let i = 0; i < reps.length; i++) {
      const rep = reps[i]
      const userId = userIds[rep.email]
      if (!userId) continue

      const profile = performanceProfiles[i % performanceProfiles.length]
      
      // Delete existing snapshots for this rep
      await supabaseAdmin
        .from('rep_performance_snapshots')
        .delete()
        .eq('rep_id', userId)

      // Current month
      const { error: currentError } = await supabaseAdmin
        .from('rep_performance_snapshots')
        .insert({
          rep_id: userId,
          period_type: 'month',
          period_year: currentYear,
          period_month: currentMonth,
          demo_goal: profile.demoGoal,
          revenue_goal: profile.revenueGoal,
          demos_set: profile.currentDemos,
          revenue_closed: profile.currentRevenue,
          pipeline_count: 10 + Math.floor(Math.random() * 15)
        })

      if (currentError) {
        results.push(`Error creating current snapshot for ${rep.email}: ${currentError.message}`)
      }

      // Previous month
      const { error: prevError } = await supabaseAdmin
        .from('rep_performance_snapshots')
        .insert({
          rep_id: userId,
          period_type: 'month',
          period_year: prevYear,
          period_month: prevMonth,
          demo_goal: profile.demoGoal,
          revenue_goal: profile.revenueGoal,
          demos_set: profile.prevDemos,
          revenue_closed: profile.prevRevenue,
          pipeline_count: 8 + Math.floor(Math.random() * 12)
        })

      if (prevError) {
        results.push(`Error creating prev snapshot for ${rep.email}: ${prevError.message}`)
      } else {
        results.push(`Created snapshots for ${rep.email}`)
      }
    }

    // Step 6: Create coaching sessions
    results.push('\n=== Creating Coaching Sessions ===')
    const coachingNotes = [
      { notes: 'Reviewed discovery call recordings. Identified opportunities to dig deeper on pain points.', actions: 'Practice open-ended questions. Schedule role-play session next week.' },
      { notes: 'Discussed pipeline health and deal velocity. Need to focus on moving stalled deals.', actions: 'Follow up with 3 stalled deals by Friday. Update CRM notes.' },
      { notes: 'Worked on objection handling for pricing concerns. Good progress on value articulation.', actions: 'Create ROI calculator for top 5 prospects. Share with team.' },
      { notes: 'Time management review. Too much time on low-probability deals.', actions: 'Implement deal scoring system. Review pipeline weekly.' },
      { notes: 'Demo skills assessment. Strong technical knowledge, needs smoother transitions.', actions: 'Record next 3 demos for review. Focus on storytelling.' },
    ]

    for (const rep of reps) {
      const repId = userIds[rep.email]
      const managerId = rep.teamKey === 'east' ? eastManagerId : westManagerId
      if (!repId || !managerId) continue

      // Delete existing sessions for this rep
      await supabaseAdmin
        .from('coaching_sessions')
        .delete()
        .eq('rep_id', repId)

      // Create 2-3 sessions per rep
      const numSessions = 2 + Math.floor(Math.random() * 2)
      for (let j = 0; j < numSessions; j++) {
        const sessionDate = new Date()
        sessionDate.setDate(sessionDate.getDate() - (j * 14)) // Every 2 weeks back
        
        const coaching = coachingNotes[Math.floor(Math.random() * coachingNotes.length)]
        const focusArea = FOCUS_AREAS[Math.floor(Math.random() * FOCUS_AREAS.length)]
        
        const followUpDate = new Date(sessionDate)
        followUpDate.setDate(followUpDate.getDate() + 14)

        await supabaseAdmin
          .from('coaching_sessions')
          .insert({
            rep_id: repId,
            manager_id: managerId,
            session_date: sessionDate.toISOString().split('T')[0],
            focus_area: focusArea,
            notes: coaching.notes,
            action_items: coaching.actions,
            follow_up_date: followUpDate.toISOString().split('T')[0]
          })
      }
      results.push(`Created ${numSessions} coaching sessions for ${rep.email}`)
    }

    // Step 7: Create activity logs
    results.push('\n=== Creating Activity Logs ===')
    const activityRanges = {
      cold_calls: [20, 60],
      emails: [10, 30],
      linkedin: [3, 10],
      demos: [0, 3],
      meetings: [0, 3],
      proposals: [0, 2],
    }

    for (const rep of reps) {
      const repId = userIds[rep.email]
      if (!repId) continue

      // Delete existing activity logs for this rep
      await supabaseAdmin
        .from('activity_logs')
        .delete()
        .eq('rep_id', repId)

      // Create 14 days of activity
      let totalActivities = 0
      for (let day = 0; day < 14; day++) {
        const activityDate = new Date()
        activityDate.setDate(activityDate.getDate() - day)
        
        // Skip weekends
        if (activityDate.getDay() === 0 || activityDate.getDay() === 6) continue

        // 2-4 activity types per day
        const numActivities = 2 + Math.floor(Math.random() * 3)
        const shuffledTypes = [...ACTIVITY_TYPES].sort(() => Math.random() - 0.5)
        
        for (let k = 0; k < numActivities; k++) {
          const activityType = shuffledTypes[k]
          const [min, max] = activityRanges[activityType]
          const count = min + Math.floor(Math.random() * (max - min + 1))
          
          if (count > 0) {
            await supabaseAdmin
              .from('activity_logs')
              .insert({
                rep_id: repId,
                activity_date: activityDate.toISOString().split('T')[0],
                activity_type: activityType,
                count: count,
                notes: null
              })
            totalActivities++
          }
        }
      }
      results.push(`Created ${totalActivities} activity logs for ${rep.email}`)
    }

    results.push('\n=== Seed Complete ===')
    results.push(`Total users: ${Object.keys(userIds).length}`)
    results.push(`Total teams: ${Object.keys(teamIds).length}`)
    
    // Log credentials securely (only visible in function logs, not persisted)
    if (generatedCredentials.length > 0) {
      results.push('\n=== Generated Credentials (SAVE THESE - ONE TIME ONLY) ===')
      results.push('These passwords are randomly generated and not stored anywhere.')
      results.push('You must save them now or reset passwords manually later.')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        log: results.join('\n'),
        // Return credentials so they can be captured - only for newly created users
        credentials: generatedCredentials.length > 0 ? generatedCredentials : undefined,
        warning: generatedCredentials.length > 0 
          ? 'IMPORTANT: Save the credentials immediately. They are randomly generated and will not be shown again.'
          : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
