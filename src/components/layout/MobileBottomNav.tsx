import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Mic, History, UserCheck, LayoutDashboard, Users, MessageSquare } from 'lucide-react';

export function MobileBottomNav() {
  const { role } = useAuth();
  const location = useLocation();

  const navItems = role === 'admin' 
    ? [
        { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
        { href: '/admin/teams', label: 'Teams', icon: Users },
        { href: '/admin/users', label: 'Users', icon: Users },
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
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <div className="flex h-16 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-primary")} />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
