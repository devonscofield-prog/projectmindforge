import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock Supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      then: (resolve: (value: { data: unknown[]; error: null; count: number }) => unknown) =>
        resolve({ data: [], error: null, count: 0 }),
      [Symbol.toStringTag]: 'Promise',
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// Mock all heavy dependencies
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

vi.mock('@/hooks/usePerformanceAlertToasts', () => ({
  usePerformanceAlertToasts: vi.fn(),
}));

vi.mock('@/hooks/useInAppNotifications', () => ({
  useNotificationRealtime: vi.fn(),
}));

vi.mock('@/hooks/usePullToRefreshOnboarding', () => ({
  usePullToRefreshOnboarding: vi.fn(),
}));

vi.mock('@/contexts/PullToRefreshContext', () => ({
  PullToRefreshProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  usePullToRefreshContext: () => ({ refreshHandler: null, isEnabled: false }),
}));

vi.mock('@/components/notifications/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell">bell</div>,
}));

vi.mock('@/components/admin/AdminAssistantChat', () => ({
  AdminAssistantChat: () => null,
}));

vi.mock('@/components/ThemeToggle', () => ({
  ThemeToggle: () => <div>theme</div>,
}));

vi.mock('@/components/ui/page-transition', () => ({
  PageTransition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('./MobileBottomNav', () => ({
  MobileBottomNav: () => null,
}));

vi.mock('./MobileHeader', () => ({
  MobileHeader: () => null,
}));

import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from './AppLayout';

const mockAuth = (role: string, name = 'Test User') => {
  (useAuth as ReturnType<typeof vi.fn>).mockReturnValue({
    user: { id: 'user-1' },
    session: {},
    profile: { name },
    role,
    loading: false,
    mfaStatus: 'verified',
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPassword: vi.fn(),
    updatePassword: vi.fn(),
    setMfaVerified: vi.fn(),
  });
};

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
}

function renderWithRouter(role: string) {
  mockAuth(role);
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AppLayout>
          <div data-testid="page-content">Page content</div>
        </AppLayout>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render children content', () => {
    renderWithRouter('admin');
    expect(screen.getByTestId('page-content')).toBeInTheDocument();
  });

  it('should display StormWind branding', () => {
    renderWithRouter('admin');
    expect(screen.getByText('StormWind')).toBeInTheDocument();
  });

  it('should display the user role in sidebar', () => {
    renderWithRouter('manager');
    // The role is displayed in the sidebar footer profile card
    const roleElements = screen.getAllByText('manager');
    expect(roleElements.length).toBeGreaterThan(0);
  });

  it('should display user profile initial', () => {
    mockAuth('rep', 'Alice');
    const queryClient = createTestQueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <AppLayout>
            <div>content</div>
          </AppLayout>
        </MemoryRouter>
      </QueryClientProvider>
    );
    const initials = screen.getAllByText('A');
    expect(initials.length).toBeGreaterThan(0);
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('should show admin navigation items for admin role', () => {
    renderWithRouter('admin');
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getByText('Call History')).toBeInTheDocument();
    expect(screen.getByText('Performance')).toBeInTheDocument();
  });

  it('should show manager navigation items for manager role', () => {
    renderWithRouter('manager');
    expect(screen.getByText('Team Overview')).toBeInTheDocument();
    expect(screen.getByText('Coaching Sessions')).toBeInTheDocument();
    expect(screen.getByText('AI Coaching Trends')).toBeInTheDocument();
    // Manager should NOT see admin-only items
    expect(screen.queryByText('Bulk Upload')).not.toBeInTheDocument();
    expect(screen.queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('should show rep navigation items for rep role', () => {
    renderWithRouter('rep');
    expect(screen.getByText('Submit a Call')).toBeInTheDocument();
    expect(screen.getByText('My Tasks')).toBeInTheDocument();
    expect(screen.getByText('Call History')).toBeInTheDocument();
    expect(screen.getByText('Accounts')).toBeInTheDocument();
    // Rep should NOT see admin/manager items
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    expect(screen.queryByText('Team Overview')).not.toBeInTheDocument();
  });

  it('should show Sign Out button', () => {
    renderWithRouter('admin');
    expect(screen.getByText('Sign Out')).toBeInTheDocument();
  });

  it('should show Settings button', () => {
    renderWithRouter('admin');
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('should have skip to main content link', () => {
    renderWithRouter('admin');
    const skipLink = screen.getByText('Skip to main content');
    expect(skipLink).toBeInTheDocument();
    expect(skipLink).toHaveAttribute('href', '#main-content');
  });

  it('should render main content area with correct id', () => {
    renderWithRouter('admin');
    const main = document.getElementById('main-content');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('role', 'main');
  });
});
