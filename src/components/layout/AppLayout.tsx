import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
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
        { href: '/admin/users', label: 'Users', icon: Users },
        { href: '/admin/teams', label: 'Teams', icon: Users },
        { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
        { href: '/admin/transcripts', label: 'Transcripts', icon: FileText },
      ]
    : role === 'manager'
    ? [
        { href: '/manager', label: 'Team Overview', icon: LayoutDashboard },
        { href: '/manager/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/manager/coaching', label: 'Coaching', icon: MessageSquare },
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
        <div>
          <h1 className="text-xl font-bold text-sidebar-primary-foreground">StormWind</h1>
          <p className="text-sm text-sidebar-foreground/70">Sales Hub</p>
        </div>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href || 
              (item.href !== '/admin' && item.href !== '/manager' && item.href !== '/rep' && location.pathname.startsWith(item.href));
            
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.label}
                  className="h-11"
                >
                  <Link to={item.href} onClick={handleNavClick}>
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <div className="h-9 w-9 rounded-full bg-sidebar-accent flex items-center justify-center">
            <span className="text-sm font-medium text-sidebar-accent-foreground">
              {profile?.name?.charAt(0).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile?.name || 'User'}</p>
            <p className="text-xs text-sidebar-foreground/70 capitalize">{role}</p>
          </div>
          <ThemeToggle />
        </div>
        <Button 
          variant="ghost" 
          className="w-full justify-start h-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </>
  );
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-svh w-full">
        <Sidebar collapsible="offcanvas">
          <SidebarNav />
        </Sidebar>
        
        <SidebarInset>
          {/* Mobile header */}
          <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background px-4 md:hidden">
            <SidebarTrigger className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <h1 className="font-semibold flex-1">StormWind</h1>
            <ThemeToggle />
          </header>
          
          {/* Main content */}
          <main className="flex-1 overflow-auto pb-20 md:pb-0">
            <div className="p-4 md:p-6 lg:p-8">
              {children}
            </div>
          </main>
        </SidebarInset>
        
        {/* Mobile bottom navigation */}
        <MobileBottomNav />
      </div>
    </SidebarProvider>
  );
}
