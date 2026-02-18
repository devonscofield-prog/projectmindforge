import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Mic, UserCheck, LayoutDashboard, MessageSquare, TrendingUp, GraduationCap, Target, FileText, Sparkles, UserPlus, Settings } from 'lucide-react';

export function MobileBottomNav() {
  const { role } = useAuth();
  const location = useLocation();

  const navItems = role === 'admin' 
    ? [
        { href: '/admin', label: 'Home', icon: LayoutDashboard },
        { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
        { href: '/manager/training', label: 'Training', icon: GraduationCap },
      ]
    : role === 'manager'
    ? [
        { href: '/manager', label: 'Overview', icon: LayoutDashboard },
        { href: '/manager/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/manager/coaching', label: 'Coaching', icon: MessageSquare },
      ]
    : role === 'sdr'
    ? [
        { href: '/sdr', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/sdr/history', label: 'History', icon: FileText },
        { href: '/settings', label: 'Settings', icon: Settings },
      ]
    : role === 'sdr_manager'
    ? [
        { href: '/sdr-manager', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/sdr-manager/transcripts', label: 'Transcripts', icon: FileText },
        { href: '/sdr-manager/coaching', label: 'Coaching', icon: Sparkles },
        { href: '/sdr-manager/invite', label: 'Invite', icon: UserPlus },
      ]
    : [
        { href: '/rep', label: 'New Call', icon: Mic },
        { href: '/rep/tasks', label: 'Tasks', icon: Target },
        { href: '/rep/prospects', label: 'Accounts', icon: UserCheck },
        { href: '/training', label: 'Training', icon: GraduationCap },
      ];

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/manager' || href === '/rep' || href === '/training' || href === '/sdr' || href === '/sdr-manager') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 border-t frosted-glass md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul className="flex h-[72px] items-center justify-around px-2 pb-safe" role="menubar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <li key={item.href} role="none">
              <Link
                to={item.href}
                role="menuitem"
                aria-label={`Navigate to ${item.label}`}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 min-h-[56px] min-w-[56px] px-3 text-xs transition-all duration-200 rounded-xl",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className={cn("h-6 w-6", active && "text-primary")} aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
