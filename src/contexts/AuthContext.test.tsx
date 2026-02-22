import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

// Mock all external dependencies
vi.mock('@/integrations/supabase/client', () => {
  const mockSubscription = { unsubscribe: vi.fn() };
  let authChangeCallback: ((event: string, session: unknown) => void) | null = null;

  return {
    supabase: {
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
          authChangeCallback = callback;
          return { data: { subscription: mockSubscription } };
        }),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn().mockResolvedValue({}),
        mfa: { listFactors: vi.fn().mockResolvedValue({ data: { totp: [] } }) },
        resetPasswordForEmail: vi.fn(),
        updateUser: vi.fn(),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
      rpc: vi.fn().mockResolvedValue({ data: null }),
      channel: vi.fn(() => ({
        subscribe: vi.fn(),
        track: vi.fn(),
        unsubscribe: vi.fn(),
      })),
      // Expose the callback for tests
      __getAuthChangeCallback: () => authChangeCallback,
    },
  };
});

vi.mock('@/api/userActivityLogs', () => ({
  logUserActivity: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/routePreloader', () => ({
  preloadRoleRoutes: vi.fn(),
}));

vi.mock('@/lib/deviceId', () => ({
  getDeviceIdAsync: vi.fn().mockResolvedValue('test-device-id'),
}));

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Helper component that renders auth context values
function AuthConsumer() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(auth.loading)}</span>
      <span data-testid="user">{auth.user ? 'logged-in' : 'logged-out'}</span>
      <span data-testid="role">{auth.role || 'none'}</span>
      <span data-testid="mfa-status">{auth.mfaStatus}</span>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useAuth outside provider', () => {
    it('should return safe defaults when used outside AuthProvider', () => {
      render(<AuthConsumer />);
      expect(screen.getByTestId('loading').textContent).toBe('true');
      expect(screen.getByTestId('user').textContent).toBe('logged-out');
      expect(screen.getByTestId('role').textContent).toBe('none');
      expect(screen.getByTestId('mfa-status').textContent).toBe('loading');
    });
  });

  describe('AuthProvider', () => {
    it('should render children', async () => {
      render(
        <AuthProvider>
          <div>Child content</div>
        </AuthProvider>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('should start in loading state and resolve to logged-out when no session', async () => {
      render(
        <AuthProvider>
          <AuthConsumer />
        </AuthProvider>
      );

      // After getSession resolves with null, loading should become false
      await waitFor(() => {
        expect(screen.getByTestId('loading').textContent).toBe('false');
      });
      expect(screen.getByTestId('user').textContent).toBe('logged-out');
    });

    it('should provide signIn function that calls supabase auth', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } },
        error: null,
      });

      let signInFn: ((email: string, password: string) => Promise<{ error: Error | null }>) | null = null;

      function CaptureAuth() {
        const auth = useAuth();
        signInFn = auth.signIn;
        return null;
      }

      render(
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      );

      await waitFor(() => expect(signInFn).not.toBeNull());

      const result = await signInFn!('test@example.com', 'password123');
      expect(result.error).toBeNull();
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('should return error when signIn fails', async () => {
      const { supabase } = await import('@/integrations/supabase/client');
      (supabase.auth.signInWithPassword as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: { user: null, session: null },
        error: new Error('Invalid credentials'),
      });

      let signInFn: ((email: string, password: string) => Promise<{ error: Error | null }>) | null = null;

      function CaptureAuth() {
        const auth = useAuth();
        signInFn = auth.signIn;
        return null;
      }

      render(
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      );

      await waitFor(() => expect(signInFn).not.toBeNull());

      const result = await signInFn!('test@example.com', 'wrong');
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error!.message).toBe('Invalid credentials');
    });

    it('should clear state on signOut', async () => {
      const { supabase } = await import('@/integrations/supabase/client');

      let signOutFn: (() => Promise<void>) | null = null;

      function CaptureAuth() {
        const auth = useAuth();
        signOutFn = auth.signOut;
        return <span data-testid="user-state">{auth.user ? 'in' : 'out'}</span>;
      }

      render(
        <AuthProvider>
          <CaptureAuth />
        </AuthProvider>
      );

      await waitFor(() => expect(signOutFn).not.toBeNull());

      await act(async () => {
        await signOutFn!();
      });

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(screen.getByTestId('user-state').textContent).toBe('out');
    });
  });
});
