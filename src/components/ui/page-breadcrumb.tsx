import { memo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardUrl } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  /** Optional icon to display before the label */
  icon?: React.ReactNode;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  /** Override the default dashboard label */
  dashboardLabel?: string;
  /** Show compact version without background */
  compact?: boolean;
  /** Additional className for the container */
  className?: string;
}

/**
 * Role-aware breadcrumb navigation component with animated transitions.
 * Automatically adds the home/dashboard link based on user role.
 * Features a visual trail with clickable intermediate links.
 */
export const PageBreadcrumb = memo(function PageBreadcrumb({
  items,
  dashboardLabel,
  compact = false,
  className
}: PageBreadcrumbProps) {
  const { role } = useAuth();

  const getDashboardLabel = () => {
    if (dashboardLabel) return dashboardLabel;
    switch (role) {
      case 'admin': return 'Admin Dashboard';
      case 'manager': return 'Manager Dashboard';
      default: return 'Dashboard';
    }
  };

  return (
    <nav 
      className={cn(
        "flex items-center text-sm animate-fade-in",
        !compact && "px-3 py-2 rounded-lg bg-muted/40 border border-border/50",
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center flex-wrap gap-1">
        {/* Home/Dashboard Link */}
        <li 
          className="flex items-center animate-fade-in"
          style={{ animationDelay: '0ms' }}
        >
          <Link 
            to={getDashboardUrl(role)} 
            className={cn(
              "group flex items-center gap-1.5 px-2 py-1 rounded-md",
              "text-muted-foreground",
              "transition-all duration-200 ease-out",
              "hover:text-foreground hover:bg-accent/50 hover:scale-105",
              "active:scale-95"
            )}
            title={getDashboardLabel()}
          >
            <Home className="h-4 w-4 transition-transform duration-200 group-hover:rotate-6" />
            <span className="hidden sm:inline text-xs font-medium">
              {getDashboardLabel()}
            </span>
          </Link>
        </li>

        {/* Dynamic Items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const delay = (index + 1) * 50;
          
          return (
            <li 
              key={index} 
              className="flex items-center animate-fade-in"
              style={{ animationDelay: `${delay}ms` }}
            >
              <ChevronRight 
                className={cn(
                  "h-3.5 w-3.5 mx-1 text-muted-foreground/60 flex-shrink-0",
                  "transition-transform duration-200",
                  "animate-[slide-in-right_0.2s_ease-out]"
                )}
                style={{ animationDelay: `${delay}ms` }}
              />
              
              {item.href && !isLast ? (
                <Link 
                  to={item.href} 
                  className={cn(
                    "group flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "text-muted-foreground",
                    "transition-all duration-200 ease-out",
                    "hover:text-foreground hover:bg-accent/50 hover:scale-105",
                    "active:scale-95",
                    "max-w-[180px]"
                  )}
                >
                  {item.icon && (
                    <span className="transition-transform duration-200 group-hover:scale-110">
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate relative">
                    {item.label}
                    {/* Animated underline on hover */}
                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left" />
                  </span>
                </Link>
              ) : (
                <span 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "font-medium",
                    isLast && "bg-primary/10 text-primary",
                    !isLast && "text-foreground",
                    "max-w-[200px]",
                    "animate-scale-in"
                  )}
                  style={{ animationDelay: `${delay + 50}ms` }}
                >
                  {item.icon && (
                    <span className="flex-shrink-0">{item.icon}</span>
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
});

/**
 * Compact breadcrumb variant for use in tight spaces
 */
export function CompactBreadcrumb(props: Omit<PageBreadcrumbProps, 'compact'>) {
  return <PageBreadcrumb {...props} compact />;
}
