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
  Menu,
  FileText,
  TrendingUp,
  Activity,
  Settings,
  Upload,
  PanelLeftClose,
  PanelLeft,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { useIsMobile } from '@/hooks/use-mobile';

interface AppLayoutProps {
  children: React.ReactNode;
}

function SidebarNav() {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { setOpenMobile, isMobile } = useSidebar();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const navItems = role === 'admin' 
    ? [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/history', label: 'Call History', icon: History },
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/teams', label: 'Teams', icon: Users },
        { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
        { href: '/admin/transcripts', label: 'Transcripts', icon: FileText },
        { href: '/admin/bulk-upload', label: 'Bulk Upload', icon: Upload },
        { href: '/admin/performance', label: 'Performance', icon: Activity },
        { href: '/admin/audit-log', label: 'Audit Log', icon: History },
      ]
    : role === 'manager'
    ? [
        { href: '/manager', label: 'Team Overview', icon: LayoutDashboard },
        { href: '/manager/history', label: 'Call History', icon: History },
        { href: '/manager/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/manager/coaching', label: 'Coaching', icon: MessageSquare },
        { href: '/manager/transcripts', label: 'Transcripts', icon: FileText },
      ]
    : [
        { href: '/rep', label: 'Submit a Call', icon: Mic },
        { href: '/rep/history', label: 'Call History', icon: History },
        { href: '/rep/prospects', label: 'Accounts', icon: UserCheck },
      ];

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <img 
            src="/mindforge-logo.png" 
            alt="Mindforge Logo" 
            className="h-10 w-10 object-contain"
          />
          <div>
            <h1 className="text-xl font-bold text-sidebar-primary-foreground">StormWind</h1>
            <p className="text-sm text-sidebar-foreground/70">Sales Hub</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu role="menubar" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href !== '/admin' && item.href !== '/manager' && item.href !== '/rep' && location.pathname.startsWith(item.href));
            
            return (
              <SidebarMenuItem key={item.href} role="none">
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className={cn(
                    "h-11 transition-all duration-200",
                    isActive && "sidebar-active-pill text-primary font-medium bg-primary/5"
                  )}
                >
                  <Link 
                    to={item.href} 
                    onClick={handleNavClick}
                    role="menuitem"
                    aria-label={`Navigate to ${item.label}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className={cn("h-5 w-5", isActive && "text-primary")} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
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
        <div className="space-y-1">
          <Button 
            variant="ghost" 
            className="w-full justify-start h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
            className="w-full justify-start h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
    <div className="hidden md:flex sticky top-0 z-40 h-12 items-center border-b bg-background px-4">
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
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  // Enable real-time performance alert toasts for admins
  usePerformanceAlertToasts();

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
            
            {/* Mobile header */}
            <header 
              className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden"
              role="banner"
            >
              <SidebarTrigger className="h-9 w-9" aria-label="Toggle navigation menu">
                <Menu className="h-5 w-5" aria-hidden="true" />
              </SidebarTrigger>
              <h1 className="font-semibold flex-1">StormWind</h1>
              <ThemeToggle />
            </header>
            
            {/* Main content */}
            <main id="main-content" className="flex flex-col flex-1" role="main">
              <MainContent>{children}</MainContent>
            </main>
          </SidebarInset>
          
          {/* Mobile bottom navigation */}
          <MobileBottomNav />
        </div>
      </SidebarProvider>
    </PullToRefreshProvider>
  );
}
