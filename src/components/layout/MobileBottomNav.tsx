import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Mic, History, UserCheck, LayoutDashboard, Users, MessageSquare, TrendingUp, FileText } from 'lucide-react';

export function MobileBottomNav() {
  const { role } = useAuth();
  const location = useLocation();

  const navItems = role === 'admin' 
    ? [
        { href: '/admin', label: 'Home', icon: LayoutDashboard },
        { href: '/admin/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/admin/coaching', label: 'Coaching', icon: TrendingUp },
        { href: '/admin/transcripts', label: 'Transcripts', icon: FileText },
      ]
    : role === 'manager'
    ? [
        { href: '/manager', label: 'Overview', icon: LayoutDashboard },
        { href: '/manager/accounts', label: 'Accounts', icon: UserCheck },
        { href: '/manager/coaching', label: 'Coaching', icon: MessageSquare },
      ]
    : [
        { href: '/rep', label: 'New Call', icon: Mic },
        { href: '/rep/history', label: 'History', icon: History },
        { href: '/rep/prospects', label: 'Accounts', icon: UserCheck },
      ];

  const isActive = (href: string) => {
    if (href === '/admin' || href === '/manager' || href === '/rep') {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <ul className="flex h-16 items-center justify-around px-2" role="menubar">
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
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2 px-3 text-xs transition-all duration-200 rounded-lg",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  active 
                    ? "text-primary bg-primary/10" 
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-primary")} aria-hidden="true" />
                <span className="font-medium">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
