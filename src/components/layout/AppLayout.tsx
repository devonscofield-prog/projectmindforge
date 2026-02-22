import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/ui/page-transition';
import { PullToRefresh } from '@/components/ui/pull-to-refresh';
import { PullToRefreshProvider, usePullToRefreshContext } from '@/contexts/PullToRefreshContext';
import { usePerformanceAlertToasts } from '@/hooks/usePerformanceAlertToasts';
import { 
  LayoutDashboard, 
  Users, 
  LogOut,
  MessageSquare,
  Mic,
  History,
  UserCheck,
  FileText,
  TrendingUp,
  Activity,
  Settings,
  Upload,
  PanelLeftClose,
  PanelLeft,
  UserPlus,
  Plus,
  Sparkles,
  BookOpen,
  Swords,
  GraduationCap,
  Target,
  Database,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarInset,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileHeader } from './MobileHeader';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePullToRefreshOnboarding } from '@/hooks/usePullToRefreshOnboarding';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotificationRealtime } from '@/hooks/useInAppNotifications';
import { AdminAssistantChat } from '@/components/admin/AdminAssistantChat';
import { useQuery } from '@tanstack/react-query';
import { getPendingTaskCountForRep, getPendingAccountsCountForRep, getCoachingOverdueCount } from '@/api/accountFollowUps';
import { Badge } from '@/components/ui/badge';
import { useOnboarding } from '@/hooks/useOnboarding';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';

interface AppLayoutProps {
  children: React.ReactNode;
}

// Navigation configuration by role with grouped sections
const adminNavGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounts & Calls',
    items: [
      { href: '/admin/history', label: 'Call History', icon: History },
      { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
      { href: '/admin/transcripts', label: 'Transcripts', icon: FileText },
    ],
  },
  {
    label: 'Coaching',
    items: [
      { href: '/admin/coaching', label: 'Coaching Trends', icon: TrendingUp },
      { href: '/admin/sales-coach', label: 'Coach History', icon: MessageSquare },
      { href: '/admin/playbook', label: 'Sales Playbook', icon: BookOpen },
      { href: '/admin/competitors', label: 'Competitor Intel', icon: Swords },
    ],
  },
  {
    label: 'Training',
    items: [
      { href: '/manager/training', label: 'Training Center', icon: GraduationCap },
      { href: '/training', label: 'Practice Roleplay', icon: Mic },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/teams', label: 'Teams', icon: Users },
      { href: '/admin/sdr', label: 'SDR Oversight', icon: Mic },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/admin/reporting', label: 'Reporting', icon: BarChart3 },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/knowledge-base', label: 'Knowledge Base', icon: Database },
      { href: '/admin/training-personas', label: 'Training Personas', icon: Users },
      { href: '/admin/bulk-upload', label: 'Bulk Upload', icon: Upload },
      { href: '/admin/performance', label: 'Performance', icon: Activity },
      { href: '/admin/audit-log', label: 'Audit Log', icon: History },
    ],
  },
];

const managerNavGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/manager', label: 'Team Overview', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Accounts & Calls',
    items: [
      { href: '/manager/history', label: 'Call History', icon: History },
      { href: '/manager/accounts', label: 'Accounts', icon: UserCheck },
      { href: '/manager/transcripts', label: 'Transcripts', icon: FileText },
    ],
  },
  {
    label: 'Coaching',
    items: [
      { href: '/manager/training', label: 'Training Center', icon: GraduationCap },
      { href: '/manager/coaching-trends', label: 'AI Coaching Trends', icon: Sparkles },
      { href: '/manager/playbook', label: 'Sales Playbook', icon: BookOpen },
      { href: '/manager/coaching', label: 'Coaching Sessions', icon: MessageSquare },
      { href: '/admin/competitors', label: 'Competitor Intel', icon: Swords },
    ],
  },
  {
    label: 'Reporting',
    items: [
      { href: '/manager/reporting', label: 'Reporting', icon: BarChart3 },
    ],
  },
];

const repNavGroups = [
  {
    label: 'Quick Actions',
    items: [
      { href: '/rep', label: 'Submit a Call', icon: Mic },
    ],
  },
  {
    label: 'My Work',
    items: [
      { href: '/rep/tasks', label: 'My Tasks', icon: Target },
      { href: '/rep/history', label: 'Call History', icon: History },
      { href: '/rep/prospects', label: 'Accounts', icon: UserCheck },
    ],
  },
  {
    label: 'Resources',
    items: [
      { href: '/training', label: 'Practice Roleplay', icon: GraduationCap },
      { href: '/admin/competitors', label: 'Competitor Intel', icon: Swords },
    ],
  },
];

const sdrNavGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/sdr', label: 'Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Calls',
    items: [
      { href: '/sdr/history', label: 'Transcript History', icon: History },
    ],
  },
];

const sdrManagerNavGroups = [
  {
    label: 'Overview',
    items: [
      { href: '/sdr-manager', label: 'Team Dashboard', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Team',
    items: [
      { href: '/sdr-manager/transcripts', label: 'Team Transcripts', icon: FileText },
      { href: '/sdr-manager/coaching', label: 'Coaching Prompts', icon: Sparkles },
      { href: '/sdr-manager/invite', label: 'Invite Members', icon: UserPlus },
    ],
  },
];

// Quick actions for footer by role
const adminQuickActions = [
  { href: '/admin/users/invite', label: 'Invite User', icon: UserPlus },
];

const managerQuickActions = [
  { href: '/manager/coaching', label: 'Coaching Report', icon: TrendingUp },
];

const repQuickActions = [
  { href: '/rep', label: 'Submit Call', icon: Plus },
];

const sdrQuickActions = [
  { href: '/sdr', label: 'Upload Transcript', icon: Upload },
];

const sdrManagerQuickActions = [
  { href: '/sdr-manager/invite', label: 'Invite Member', icon: UserPlus },
];


function SidebarNav() {
  const { profile, role, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();

  // Fetch pending task count for rep sidebar badge
  const { data: pendingTaskCount = 0 } = useQuery({
    queryKey: ['rep-tasks-count', user?.id],
    queryFn: () => getPendingTaskCountForRep(user!.id),
    enabled: !!user?.id && role === 'rep',
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch pending accounts count for rep "Accounts" badge
  const { data: pendingAccountsCount = 0 } = useQuery({
    queryKey: ['rep-pending-accounts', user?.id],
    queryFn: () => getPendingAccountsCountForRep(user!.id),
    enabled: !!user?.id && role === 'rep',
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch coaching overdue count for manager "Team Overview" badge
  const { data: coachingOverdueCount = 0 } = useQuery({
    queryKey: ['manager-coaching-overdue', user?.id, role],
    queryFn: () => getCoachingOverdueCount(user!.id, role!),
    enabled: !!user?.id && (role === 'manager' || role === 'admin'),
    staleTime: 2 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Get navigation groups based on role
  const navGroups = role === 'admin' 
    ? adminNavGroups 
    : role === 'manager' 
    ? managerNavGroups 
    : role === 'sdr'
    ? sdrNavGroups
    : role === 'sdr_manager'
    ? sdrManagerNavGroups
    : repNavGroups;

  // Get quick actions based on role
  const quickActions = role === 'admin'
    ? adminQuickActions
    : role === 'manager'
    ? managerQuickActions
    : role === 'sdr'
    ? sdrQuickActions
    : role === 'sdr_manager'
    ? sdrManagerQuickActions
    : repQuickActions;

  // Prefix-based active detection (exact match for dashboards)
  const isActive = (href: string) => {
    // Exact match for dashboard routes
    if (href === '/admin' || href === '/manager' || href === '/rep' || href === '/training' || href === '/sdr' || href === '/sdr-manager') {
      return location.pathname === href;
    }
    // Prefix match for all other routes
    return location.pathname.startsWith(href);
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <img 
            src="/mindforge-logo.png" 
            alt="Mindforge Logo" 
            className="h-8 w-8 object-contain"
          />
          <div>
            <h1 className="text-lg font-bold text-sidebar-primary-foreground">StormWind</h1>
            <p className="text-xs text-sidebar-foreground/70 flex items-center gap-1.5">
              <span className="capitalize font-medium text-sidebar-primary-foreground/80">{role || 'User'}</span>
              <span className="opacity-50">•</span>
              <span>Sales Hub</span>
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-1">
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-[11px] font-bold uppercase tracking-widest text-sidebar-foreground/80 px-3 py-1.5 mb-0.5">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu role="menubar" aria-label={`${group.label} navigation`}>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  
                  return (
                    <SidebarMenuItem key={item.href} role="none">
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={cn(
                          "h-10 transition-all duration-200",
                          active 
                            ? "sidebar-active-pill text-primary font-medium bg-primary/5" 
                            : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Link 
                          to={item.href} 
                          onClick={handleNavClick}
                          role="menuitem"
                          aria-label={`Navigate to ${item.label}`}
                          aria-current={active ? 'page' : undefined}
                          className="group"
                        >
                          <Icon 
                            className={cn(
                              "h-5 w-5 transition-all duration-200 ease-out",
                              active 
                                ? "text-primary" 
                                : "text-sidebar-foreground/50 group-hover:scale-110 group-hover:text-sidebar-foreground"
                            )} 
                            aria-hidden="true" 
                          />
                          <span>{item.label}</span>
                          {item.href === '/rep/tasks' && pendingTaskCount > 0 && (
                            <Badge variant="default" className="ml-auto h-5 min-w-5 px-1.5 text-xs font-semibold">
                              {pendingTaskCount > 99 ? '99+' : pendingTaskCount}
                            </Badge>
                          )}
                          {item.href === '/rep/prospects' && pendingAccountsCount > 0 && (
                            <Badge variant="default" className="ml-auto h-5 min-w-5 px-1.5 text-xs font-semibold">
                              {pendingAccountsCount > 99 ? '99+' : pendingAccountsCount}
                            </Badge>
                          )}
                          {item.href === '/manager' && coachingOverdueCount > 0 && (
                            <Badge variant="destructive" className="ml-auto h-5 min-w-5 px-1.5 text-xs font-semibold">
                              {coachingOverdueCount > 99 ? '99+' : coachingOverdueCount}
                            </Badge>
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {/* Profile floating card */}
        <div className="bg-sidebar-accent/50 rounded-xl p-3 mb-3">
          <div className="flex items-center gap-3" role="status" aria-label="Current user information">
            <div 
              className="h-10 w-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center"
              aria-hidden="true"
            >
              <span className="text-sm font-semibold text-primary">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{profile?.name || 'User'}</p>
              <p className="text-xs text-sidebar-foreground/70 capitalize">{role}</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-2 mb-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Button 
                key={action.href}
                variant="gradient"
                className="w-full rounded-full"
                onClick={() => {
                  navigate(action.href);
                  if (isMobile) {
                    setOpenMobile(false);
                  }
                }}
                aria-label={action.label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {action.label}
              </Button>
            );
          })}
        </div>

        <div className="border-t border-sidebar-border pt-2 space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-start h-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={() => {
              navigate('/settings');
              if (isMobile) {
                setOpenMobile(false);
              }
            }}
            aria-label="Open settings"
          >
            <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
            Settings
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start h-10 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={handleSignOut}
            aria-label="Sign out of your account"
          >
            <LogOut className="h-4 w-4 mr-2" aria-hidden="true" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </>
  );
}

function MainContent({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const { refreshHandler, isEnabled } = usePullToRefreshContext();
  
  // Show one-time pull-to-refresh hint on mobile
  usePullToRefreshOnboarding();

  const handleRefresh = async () => {
    if (refreshHandler) {
      await refreshHandler();
    }
  };

  const content = (
    <div className="p-4 md:p-6 lg:p-8">
      <PageTransition>
        {children}
      </PageTransition>
    </div>
  );

  // Only enable pull-to-refresh on mobile when a handler is registered
  if (isMobile && refreshHandler && isEnabled) {
    return (
      <PullToRefresh 
        onRefresh={handleRefresh} 
        className="flex-1 pb-20"
      >
        {content}
      </PullToRefresh>
    );
  }

  return (
    <div className="flex-1 overflow-auto pb-20 md:pb-0">
      {content}
    </div>
  );
}

function DesktopSidebarToggle() {
  const { state } = useSidebar();
  const isExpanded = state === 'expanded';
  
  return (
    <div className="hidden md:flex sticky top-0 z-40 h-12 items-center justify-between border-b bg-background px-4">
      <div className="flex items-center">
        <SidebarTrigger 
          className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-md transition-colors" 
          aria-label={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
        >
          {isExpanded ? (
            <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
          ) : (
            <PanelLeft className="h-5 w-5" aria-hidden="true" />
          )}
        </SidebarTrigger>
        <span className="ml-2 text-xs text-muted-foreground hidden lg:inline">
          ⌘B
        </span>
      </div>
      <NotificationBell />
    </div>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, role } = useAuth();
  const { showOnboarding, completeOnboarding, dismissOnboarding } = useOnboarding(user?.id);

  // Enable real-time performance alert toasts for admins
  usePerformanceAlertToasts();
  // Enable real-time notification toasts
  useNotificationRealtime();

  return (
    <PullToRefreshProvider>
      <SidebarProvider>
        <div className="flex min-h-svh w-full">
          {/* Skip link for keyboard navigation */}
          <a href="#main-content" className="skip-link">
            Skip to main content
          </a>
          
          <Sidebar collapsible="offcanvas" aria-label="Main sidebar">
            <SidebarNav />
          </Sidebar>
          
          <SidebarInset>
            {/* Desktop sidebar toggle */}
            <DesktopSidebarToggle />
            
            {/* Mobile header with page title and primary action */}
            <MobileHeader />
            
            {/* Main content */}
            <main id="main-content" className="flex flex-col flex-1" role="main">
              <MainContent>{children}</MainContent>
            </main>
          </SidebarInset>
          
          {/* Mobile bottom navigation */}
          <MobileBottomNav />
          
          {/* Admin AI Assistant */}
          <AdminAssistantChat />

          {/* Onboarding flow for first-time users */}
          {showOnboarding && profile && role && (
            <OnboardingFlow
              profile={profile}
              role={role}
              onComplete={completeOnboarding}
              onDismiss={dismissOnboarding}
            />
          )}
        </div>
      </SidebarProvider>
    </PullToRefreshProvider>
  );
}
