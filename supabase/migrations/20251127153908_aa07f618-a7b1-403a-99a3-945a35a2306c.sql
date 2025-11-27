-- Fix RLS policies: Change from RESTRICTIVE to PERMISSIVE
-- RESTRICTIVE = ALL policies must pass (AND logic)
-- PERMISSIVE = ANY policy can pass (OR logic)

-- ============================================
-- FIX rep_performance_snapshots policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage performance" ON public.rep_performance_snapshots;
DROP POLICY IF EXISTS "Admins can view all performance" ON public.rep_performance_snapshots;
DROP POLICY IF EXISTS "Managers can view team performance" ON public.rep_performance_snapshots;
DROP POLICY IF EXISTS "Reps can view own performance" ON public.rep_performance_snapshots;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all performance"
ON public.rep_performance_snapshots
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view team performance"
ON public.rep_performance_snapshots
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Reps can view own performance"
ON public.rep_performance_snapshots
FOR SELECT
TO authenticated
USING (auth.uid() = rep_id);

-- ============================================
-- FIX coaching_sessions policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all coaching sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Managers can insert coaching sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Managers can update own coaching sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Managers can view/manage team coaching sessions" ON public.coaching_sessions;
DROP POLICY IF EXISTS "Reps can view own coaching sessions" ON public.coaching_sessions;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all coaching sessions"
ON public.coaching_sessions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can insert coaching sessions"
ON public.coaching_sessions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = manager_id 
  AND has_role(auth.uid(), 'manager'::user_role) 
  AND is_manager_of_user(auth.uid(), rep_id)
);

CREATE POLICY "Managers can update own coaching sessions"
ON public.coaching_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = manager_id);

CREATE POLICY "Managers can view team coaching sessions"
ON public.coaching_sessions
FOR SELECT
TO authenticated
USING (
  auth.uid() = manager_id 
  OR (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id))
);

CREATE POLICY "Reps can view own coaching sessions"
ON public.coaching_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = rep_id);

-- ============================================
-- FIX activity_logs policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage all activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Managers can view team activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Reps can insert own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Reps can update own activity" ON public.activity_logs;
DROP POLICY IF EXISTS "Reps can view own activity" ON public.activity_logs;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all activity"
ON public.activity_logs
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Managers can view team activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::user_role) AND is_manager_of_user(auth.uid(), rep_id));

CREATE POLICY "Reps can insert own activity"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own activity"
ON public.activity_logs
FOR UPDATE
TO authenticated
USING (auth.uid() = rep_id);

CREATE POLICY "Reps can view own activity"
ON public.activity_logs
FOR SELECT
TO authenticated
USING (auth.uid() = rep_id);

-- ============================================
-- FIX profiles policies
-- ============================================
DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view team profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all profiles"
ON public.profiles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Managers can view team profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::user_role) 
  AND team_id IN (SELECT id FROM teams WHERE manager_id = auth.uid())
);

-- ============================================
-- FIX user_roles policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- FIX teams policies
-- ============================================
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Authenticated users can view teams" ON public.teams;

-- Recreate as PERMISSIVE policies
CREATE POLICY "Admins can manage all teams"
ON public.teams
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Authenticated users can view teams"
ON public.teams
FOR SELECT
TO authenticated
USING (true);