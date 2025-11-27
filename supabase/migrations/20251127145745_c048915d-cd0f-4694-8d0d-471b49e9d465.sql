-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('rep', 'manager', 'admin');

-- Create enum for activity types
CREATE TYPE public.activity_type AS ENUM ('cold_calls', 'emails', 'linkedin', 'demos', 'meetings', 'proposals');

-- Create profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  team_id UUID,
  hire_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table (secure role storage)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'rep',
  UNIQUE(user_id, role)
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add foreign key for team_id in profiles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- Create rep_performance_snapshots table
CREATE TABLE public.rep_performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_type TEXT NOT NULL DEFAULT 'month',
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  revenue_closed NUMERIC(12,2) NOT NULL DEFAULT 0,
  demos_set INTEGER NOT NULL DEFAULT 0,
  demo_goal INTEGER NOT NULL DEFAULT 0,
  revenue_goal NUMERIC(12,2) NOT NULL DEFAULT 0,
  pipeline_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(rep_id, period_year, period_month)
);

-- Create coaching_sessions table
CREATE TABLE public.coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  focus_area TEXT NOT NULL,
  notes TEXT,
  action_items TEXT,
  follow_up_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create activity_logs table
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  activity_type activity_type NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rep_performance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Create security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Create function to check if user is manager of a team
CREATE OR REPLACE FUNCTION public.is_manager_of_user(_manager_id UUID, _rep_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.teams t ON p.team_id = t.id
    WHERE p.id = _rep_id AND t.manager_id = _manager_id
  )
$$;

-- Profiles RLS policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Managers can view team profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager') AND
    team_id IN (SELECT id FROM public.teams WHERE manager_id = auth.uid())
  );

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = id);

-- User roles RLS policies
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Teams RLS policies
CREATE POLICY "Authenticated users can view teams" ON public.teams
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage teams" ON public.teams
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Performance snapshots RLS policies
CREATE POLICY "Reps can view own performance" ON public.rep_performance_snapshots
  FOR SELECT USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team performance" ON public.rep_performance_snapshots
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager') AND
    public.is_manager_of_user(auth.uid(), rep_id)
  );

CREATE POLICY "Admins can view all performance" ON public.rep_performance_snapshots
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage performance" ON public.rep_performance_snapshots
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Coaching sessions RLS policies
CREATE POLICY "Reps can view own coaching sessions" ON public.coaching_sessions
  FOR SELECT USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view/manage team coaching sessions" ON public.coaching_sessions
  FOR SELECT USING (
    auth.uid() = manager_id OR
    (public.has_role(auth.uid(), 'manager') AND public.is_manager_of_user(auth.uid(), rep_id))
  );

CREATE POLICY "Managers can insert coaching sessions" ON public.coaching_sessions
  FOR INSERT WITH CHECK (
    auth.uid() = manager_id AND
    public.has_role(auth.uid(), 'manager') AND
    public.is_manager_of_user(auth.uid(), rep_id)
  );

CREATE POLICY "Managers can update own coaching sessions" ON public.coaching_sessions
  FOR UPDATE USING (auth.uid() = manager_id);

CREATE POLICY "Admins can manage all coaching sessions" ON public.coaching_sessions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Activity logs RLS policies
CREATE POLICY "Reps can view own activity" ON public.activity_logs
  FOR SELECT USING (auth.uid() = rep_id);

CREATE POLICY "Reps can insert own activity" ON public.activity_logs
  FOR INSERT WITH CHECK (auth.uid() = rep_id);

CREATE POLICY "Reps can update own activity" ON public.activity_logs
  FOR UPDATE USING (auth.uid() = rep_id);

CREATE POLICY "Managers can view team activity" ON public.activity_logs
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager') AND
    public.is_manager_of_user(auth.uid(), rep_id)
  );

CREATE POLICY "Admins can manage all activity" ON public.activity_logs
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger for automatic profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.email),
    NEW.email
  );
  -- Default to rep role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'rep');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at triggers to all tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rep_performance_snapshots_updated_at BEFORE UPDATE ON public.rep_performance_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_coaching_sessions_updated_at BEFORE UPDATE ON public.coaching_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_activity_logs_updated_at BEFORE UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_profiles_team_id ON public.profiles(team_id);
CREATE INDEX idx_teams_manager_id ON public.teams(manager_id);
CREATE INDEX idx_rep_performance_snapshots_rep_id ON public.rep_performance_snapshots(rep_id);
CREATE INDEX idx_rep_performance_snapshots_period ON public.rep_performance_snapshots(period_year, period_month);
CREATE INDEX idx_coaching_sessions_rep_id ON public.coaching_sessions(rep_id);
CREATE INDEX idx_coaching_sessions_manager_id ON public.coaching_sessions(manager_id);
CREATE INDEX idx_activity_logs_rep_id ON public.activity_logs(rep_id);
CREATE INDEX idx_activity_logs_date ON public.activity_logs(activity_date);