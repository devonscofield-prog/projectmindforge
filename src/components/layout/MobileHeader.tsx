import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Menu, TrendingUp, UserPlus, Mic, Upload, ChevronLeft } from 'lucide-react';
import { NotificationBell } from '@/components/notifications/NotificationBell';

// Map routes to page titles
function getPageTitle(pathname: string, _role: string | null): string {
  // Handle dynamic routes first (with IDs)
  if (pathname.match(/\/calls\/[^/]+/)) return 'Call Details';
  if (pathname.match(/\/sdr\/history\/[^/]+/)) return 'Transcript Details';
  if (pathname.match(/\/sdr-manager\/rep\/[^/]+/)) return 'Rep Details';
  if (pathname.match(/\/prospects\/[^/]+/) || pathname.match(/\/accounts\/[^/]+/)) return 'Account Details';
  if (pathname.match(/\/users\/[^/]+/)) return 'User Details';
  if (pathname.match(/\/rep\/[^/]+/) && pathname.includes('/manager/')) return 'Rep Details';
  if (pathname.match(/\/training\/roleplay\/[^/]+/)) return 'Practice Session';
  if (pathname.match(/\/training\/session\/[^/]+/)) return 'Session Review';

  // Static routes
  const routeTitles: Record<string, string> = {
    // Admin routes
    '/admin': 'Dashboard',
    '/admin/history': 'Call History',
    '/admin/accounts': 'Accounts',
    '/admin/transcripts': 'Transcripts',
    '/admin/coaching': 'Coaching Trends',
    '/admin/users': 'Users',
    '/admin/teams': 'Teams',
    '/admin/users/invite': 'Invite User',
    '/admin/bulk-upload': 'Bulk Upload',
    '/admin/performance': 'Performance',
    '/admin/audit-log': 'Audit Log',
    // Manager routes
    '/manager': 'Team Overview',
    '/manager/history': 'Call History',
    '/manager/accounts': 'Accounts',
    '/manager/transcripts': 'Transcripts',
    '/manager/coaching': 'Coaching',
    '/manager/training': 'Training Center',
    // Rep routes
    '/rep': 'Submit Call',
    '/rep/history': 'Call History',
    '/rep/prospects': 'Accounts',
    '/rep/coaching': 'My Coaching',
    // SDR routes
    '/sdr': 'SDR Dashboard',
    '/sdr/history': 'Transcript History',
    // SDR manager routes
    '/sdr-manager': 'Team Dashboard',
    '/sdr-manager/transcripts': 'Team Transcripts',
    '/sdr-manager/coaching': 'Coaching Prompts',
    '/sdr-manager/invite': 'Invite Members',
    // Settings
    '/settings': 'Settings',
    // Training routes
    '/training': 'Training',
    '/training/history': 'Training History',
    '/training/progress': 'My Progress',
  };

  return routeTitles[pathname] || 'StormWind';
}

// Get primary action based on role
function getPrimaryAction(role: string | null): { href: string; label: string; icon: React.ElementType } | null {
  switch (role) {
    case 'rep':
      return { href: '/rep', label: 'New Call', icon: Mic };
    case 'manager':
      return { href: '/manager/coaching', label: 'Coaching', icon: TrendingUp };
    case 'admin':
      return { href: '/admin/users/invite', label: 'Invite', icon: UserPlus };
    case 'sdr':
      return { href: '/sdr', label: 'Upload', icon: Upload };
    case 'sdr_manager':
      return { href: '/sdr-manager/invite', label: 'Invite', icon: UserPlus };
    default:
      return null;
  }
}

export function MobileHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();
  
  const pageTitle = getPageTitle(location.pathname, role);
  const primaryAction = getPrimaryAction(role);

  // Don't show primary action if we're already on that page
  const showPrimaryAction = primaryAction && location.pathname !== primaryAction.href;

  // Show back button on detail/sub-pages (pathname depth > 2 segments, e.g. /calls/123)
  const pathSegments = location.pathname.split('/').filter(Boolean);
  const isSubPage = pathSegments.length > 2 || location.pathname.match(/\/[^/]+\/[^/]+$/);

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b bg-background px-3 md:hidden"
      role="banner"
    >
      {isSubPage ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={() => navigate(-1)}
          aria-label="Go back"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </Button>
      ) : (
        <SidebarTrigger className="h-9 w-9 shrink-0" aria-label="Toggle navigation menu">
          <Menu className="h-5 w-5" aria-hidden="true" />
        </SidebarTrigger>
      )}
      
      <h1 className="font-semibold text-sm truncate flex-1">
        {pageTitle}
      </h1>
      
      {showPrimaryAction && (
        <Button
          size="sm"
          variant="default"
          className="h-8 px-3 text-xs gap-1.5 shrink-0"
          onClick={() => navigate(primaryAction.href)}
          aria-label={primaryAction.label}
        >
          <primaryAction.icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xs:inline">{primaryAction.label}</span>
        </Button>
      )}
      
      <NotificationBell />
      <ThemeToggle />
    </header>
  );
}
