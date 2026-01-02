import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session, RealtimeChannel, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { UserRole, Profile } from '@/types/database';
import { toast } from 'sonner';
import { logUserActivity } from '@/api/userActivityLogs';
import { preloadRoleRoutes } from '@/lib/routePreloader';
import { createLogger } from '@/lib/logger';
import { getDeviceId } from '@/lib/deviceId';

const log = createLogger('auth');

type MFAStatus = 'loading' | 'verified' | 'needs-enrollment' | 'needs-verification';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: UserRole | null;
  loading: boolean;
  mfaStatus: MFAStatus;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  setMfaVerified: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaStatus, setMfaStatus] = useState<MFAStatus>('loading');
  const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
  const hasLoggedLogin = useRef(false);
  const hasHandledSessionExpiry = useRef(false);
  const mfaManuallyVerified = useRef(false);

  // Handle session expiry gracefully
  const handleSessionExpired = () => {
    // Prevent multiple redirects
    if (hasHandledSessionExpiry.current) return;
    hasHandledSessionExpiry.current = true;

    log.info('Session expired, redirecting to auth');
    
    // Clear local state
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setMfaStatus('loading');
    hasLoggedLogin.current = false;

    // Show friendly toast
    toast.info('Your session has expired. Please sign in again.');

    // Redirect to auth page with expired flag (only if not already on auth page)
    if (!window.location.pathname.includes('/auth')) {
      window.location.href = '/auth?expired=true';
    }

    // Reset the flag after a delay to allow future expiry handling
    setTimeout(() => {
      hasHandledSessionExpiry.current = false;
    }, 5000);
  };

  // Update last_seen_at in database
  const updateLastSeen = async (userId: string) => {
    try {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', userId);
    } catch (error) {
      // Check if this is a session-related error
      if (error instanceof Error && error.message.includes('refresh_token')) {
        handleSessionExpired();
      }
    }
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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_active')
        .eq('id', userId)
        .maybeSingle();
      
      // Check for session-related errors
      if (error) {
        const errorMessage = error.message?.toLowerCase() || '';
        if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('jwt')) {
          handleSessionExpired();
          return false;
        }
      }
      
      return data?.is_active ?? false;
    } catch (error) {
      log.error('Error checking user active status', { error });
      return false;
    }
  };

  // Check MFA status - returns the MFA state
  const checkMfaStatus = async (userId: string): Promise<MFAStatus> => {
    try {
      const deviceId = getDeviceId();
      
      // Check trusted device and MFA factors in parallel
      const [trustedDeviceResult, factorsResult] = await Promise.all([
        supabase
          .from('user_trusted_devices')
          .select('id, expires_at')
          .eq('user_id', userId)
          .eq('device_id', deviceId)
          .maybeSingle(),
        supabase.auth.mfa.listFactors()
      ]);

      const trustedDevice = trustedDeviceResult.data;
      const factors = factorsResult.data;

      // If device is trusted and not expired
      if (trustedDevice?.expires_at && new Date(trustedDevice.expires_at) > new Date()) {
        // Update last_used_at in background (don't await)
        supabase
          .from('user_trusted_devices')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', trustedDevice.id)
          .then(() => {});
        
        return 'verified';
      }

      // Check if user has verified TOTP
      const hasVerifiedTOTP = factors?.totp?.some(f => f.status === 'verified');

      if (hasVerifiedTOTP) {
        return 'needs-verification';
      } else {
        return 'needs-enrollment';
      }
    } catch (error) {
      log.error('Error checking MFA status', { error });
      return 'needs-enrollment';
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      log.info('fetchUserData start', { userId });
      
      // Use Promise.allSettled so one failure doesn't block others
      const results = await Promise.allSettled([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .maybeSingle(),
        mfaManuallyVerified.current 
          ? Promise.resolve('verified' as MFAStatus) 
          : checkMfaStatus(userId)
      ]);

      const [profileSettled, roleSettled, mfaSettled] = results;

      // Handle profile result
      if (profileSettled.status === 'fulfilled') {
        const { data: profileData, error: profileError } = profileSettled.value;
        
        if (profileError) {
          const errorMessage = profileError.message?.toLowerCase() || '';
          if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('jwt')) {
            handleSessionExpired();
            return;
          }
          log.warn('Profile fetch failed', { error: profileError.message });
        } else if (profileData) {
          if (!profileData.is_active) {
            toast.error('Your account has been deactivated. Please contact an administrator.');
            await supabase.auth.signOut();
            return;
          }
          setProfile(profileData as Profile);
        }
      } else {
        log.error('Profile fetch rejected', { reason: profileSettled.reason });
      }

      // Handle role result with RPC fallback
      let resolvedRole: UserRole | null = null;
      
      if (roleSettled.status === 'fulfilled') {
        const { data: roleData, error: roleError } = roleSettled.value;
        
        if (roleError) {
          const errorMessage = roleError.message?.toLowerCase() || '';
          if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('jwt')) {
            handleSessionExpired();
            return;
          }
          log.warn('Role fetch failed, trying RPC fallback', { error: roleError.message });
        } else if (roleData) {
          resolvedRole = roleData.role as UserRole;
        }
      } else {
        log.warn('Role fetch rejected, trying RPC fallback', { reason: roleSettled.reason });
      }

      // If role not resolved, try RPC fallback
      if (!resolvedRole) {
        try {
          const { data: rpcRole } = await supabase.rpc('get_user_role', { _user_id: userId });
          if (rpcRole) {
            resolvedRole = rpcRole as UserRole;
            log.info('Role resolved via RPC fallback', { role: resolvedRole });
          }
        } catch (rpcError) {
          log.error('RPC role fallback also failed', { error: rpcError });
        }
      }

      if (resolvedRole) {
        setRole(resolvedRole);
        preloadRoleRoutes(resolvedRole);
      }

      // Handle MFA result
      if (mfaSettled.status === 'fulfilled') {
        setMfaStatus(mfaSettled.value);
      } else {
        log.warn('MFA check failed, defaulting to needs-enrollment', { reason: mfaSettled.reason });
        setMfaStatus('needs-enrollment');
      }
      
      log.info('fetchUserData complete', { hasProfile: !!profileSettled, hasRole: !!resolvedRole });
    } catch (error) {
      log.error('Error fetching user data', { error });
      // Even on error, set a sensible default MFA state so user isn't stuck
      setMfaStatus('needs-enrollment');
    }
  };

  // Function to mark MFA as verified (called by MFAGate after successful verification)
  const setMfaVerified = () => {
    mfaManuallyVerified.current = true;
    setMfaStatus('verified');
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        log.info('Auth state change', { event, hasSession: !!session });
        
        // Handle token refresh failure
        if (event === 'TOKEN_REFRESHED' && !session) {
          log.warn('Token refresh failed - no session returned');
          handleSessionExpired();
          return;
        }

        // Handle sign out
        if (event === 'SIGNED_OUT') {
          mfaManuallyVerified.current = false;
          setSession(null);
          setUser(null);
          setProfile(null);
          setRole(null);
          setMfaStatus('loading');
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer data fetching with setTimeout to avoid deadlock
        if (session?.user) {
          // Ensure we don't get stuck in a permanent loading state
          setLoading(true);
          setTimeout(() => {
            fetchUserData(session.user.id)
              .catch(() => {})
              .finally(() => setLoading(false));
          }, 0);
        } else {
          setProfile(null);
          setRole(null);
          setMfaStatus('loading');
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth
      .getSession()
      .then(({ data: { session }, error }) => {
        // Check for session errors (invalid refresh token, etc.)
        if (error) {
          const errorMessage = (error as AuthError).message?.toLowerCase() || '';
          if (errorMessage.includes('refresh') || errorMessage.includes('token') || errorMessage.includes('invalid')) {
            log.warn('Invalid session on load', { error: errorMessage });
            handleSessionExpired();
            setLoading(false);
            return;
          }
        }

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          fetchUserData(session.user.id)
            .catch((err) => log.error('fetchUserData failed on getSession', { error: err }))
            .finally(() => setLoading(false));
          // Log login for existing session (page load/refresh)
          if (!hasLoggedLogin.current) {
            hasLoggedLogin.current = true;
            logUserActivity({
              user_id: session.user.id,
              activity_type: 'login',
            }).catch(() => {}); // Fire and forget
          }
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        // If getSession throws/rejects, don't leave the app stuck on a loader
        log.error('getSession failed', { error });
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  // Periodic check for user active status (every 60 seconds)
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const isActive = await checkUserActive(user.id);
      if (!isActive && user) {
        toast.error('Your account has been deactivated. You have been signed out.');
        await supabase.auth.signOut();
      }
    }, 60000); // Check every 60 seconds

    return () => clearInterval(interval);
  }, [user]);

  const signIn = async (email: string, password: string) => {
    // Only perform auth - do NOT await any database calls here
    // to prevent the login button from spinning indefinitely
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    
    if (error) {
      return { error: error as Error };
    }

    // Log login activity in background (don't await)
    if (data.user) {
      hasLoggedLogin.current = true;
      logUserActivity({
        user_id: data.user.id,
        activity_type: 'login',
      }).catch(() => {}); // Fire and forget
    }

    // Active check and data fetch will happen via onAuthStateChange -> fetchUserData
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
      try {
        await logUserActivity({
          user_id: user.id,
          activity_type: 'logout',
        });
      } catch (e) {
        // Ignore logging errors during sign out
      }
    }
    
    hasLoggedLogin.current = false;
    mfaManuallyVerified.current = false;
    
    // Clear local state first - this ensures UI updates even if server call fails
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
    setMfaStatus('loading');
    
    // Then attempt server-side signout (may fail if session already invalid after MFA)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      log.info('Sign out API call failed (session may already be invalid)', { error });
      // This is fine - local state is already cleared
    }
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    
    if (!error && user) {
      // Log password change activity
      await logUserActivity({
        user_id: user.id,
        activity_type: 'password_reset_requested',
      });
    }
    
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      loading,
      mfaStatus,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
      setMfaVerified
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
