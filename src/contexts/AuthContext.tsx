import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, Profile } from '@/types/database';
import { toast } from 'sonner';
import { logUserActivity } from '@/api/userActivityLogs';
import { preloadRoleRoutes } from '@/lib/routePreloader';
import { createLogger } from '@/lib/logger';

const log = createLogger('auth');

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
  const hasLoggedLogin = useRef(false);

  // Update last_seen_at in database
  const updateLastSeen = async (userId: string) => {
    await supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', userId);
  };

  // Set up presence tracking and last_seen updates
  useEffect(() => {
    if (!user) {
      if (presenceChannel) {
        presenceChannel.unsubscribe();
        setPresenceChannel(null);
      }
      return;
    }

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: user.id,
        },
      },
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          user_id: user.id,
          online_at: new Date().toISOString(),
        });
        // Update last_seen when first connecting
        updateLastSeen(user.id);
      }
    });

    setPresenceChannel(channel);

    // Periodically update last_seen_at (every 30 seconds)
    const lastSeenInterval = setInterval(() => {
      updateLastSeen(user.id);
    }, 30000);

    return () => {
      channel.unsubscribe();
      clearInterval(lastSeenInterval);
    };
  }, [user?.id]);

  const checkUserActive = async (userId: string): Promise<boolean> => {
    const { data } = await supabase
      .from('profiles')
      .select('is_active')
      .eq('id', userId)
      .maybeSingle();
    
    return data?.is_active ?? false;
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        // Check if user is active
        if (!profileData.is_active) {
          toast.error('Your account has been deactivated. Please contact an administrator.');
          await supabase.auth.signOut();
          return;
        }
        setProfile(profileData as Profile);
      }

      // Fetch role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle();

      if (roleData) {
        const userRole = roleData.role as UserRole;
        setRole(userRole);
        // Preload routes for this role to improve navigation performance
        preloadRoleRoutes(userRole);
      }
    } catch (error) {
      log.error('Error fetching user data', { error });
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer data fetching with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
        }

        if (event === 'SIGNED_OUT') {
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserData(session.user.id).then(() => setLoading(false));
        // Log login for existing session (page load/refresh)
        if (!hasLoggedLogin.current) {
          hasLoggedLogin.current = true;
          logUserActivity({
            user_id: session.user.id,
            activity_type: 'login',
          });
        }
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Periodic check for user active status (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const isActive = await checkUserActive(user.id);
      if (!isActive) {
        toast.error('Your account has been deactivated. You have been signed out.');
        await supabase.auth.signOut();
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { error: error as Error };
    }

    // Check if user is active after successful auth
    if (data.user) {
      const isActive = await checkUserActive(data.user.id);
      if (!isActive) {
        // Sign them out immediately
        await supabase.auth.signOut();
        return { 
          error: new Error('Your account has been deactivated. Please contact an administrator.') 
        };
      }
      
      // Log login activity
      hasLoggedLogin.current = true;
      logUserActivity({
        user_id: data.user.id,
        activity_type: 'login',
      });
    }

    return { error: null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { name }
      }
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    // Log logout activity before signing out
    if (user) {
      await logUserActivity({
        user_id: user.id,
        activity_type: 'logout',
      });
    }
    hasLoggedLogin.current = false;
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      signIn,
      signUp,
      signOut
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
