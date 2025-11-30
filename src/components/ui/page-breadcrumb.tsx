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
 * Role-aware breadcrumb navigation component.
 * Automatically adds the home/dashboard link based on user role.
 * Features a visual trail with clickable intermediate links.
 */
export function PageBreadcrumb({ 
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
        "flex items-center text-sm",
        !compact && "px-3 py-2 rounded-lg bg-muted/40 border border-border/50",
        className
      )}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center flex-wrap gap-1">
        {/* Home/Dashboard Link */}
        <li className="flex items-center">
          <Link 
            to={getDashboardUrl(role)} 
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md",
              "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              "transition-all duration-200"
            )}
            title={getDashboardLabel()}
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline text-xs font-medium">
              {getDashboardLabel()}
            </span>
          </Link>
        </li>

        {/* Dynamic Items */}
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <li key={index} className="flex items-center">
              <ChevronRight className="h-3.5 w-3.5 mx-1 text-muted-foreground/60 flex-shrink-0" />
              
              {item.href && !isLast ? (
                <Link 
                  to={item.href} 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    "transition-all duration-200",
                    "max-w-[180px] truncate"
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </Link>
              ) : (
                <span 
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md",
                    "text-foreground font-medium",
                    isLast && "bg-primary/10 text-primary",
                    "max-w-[200px] truncate"
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Compact breadcrumb variant for use in tight spaces
 */
export function CompactBreadcrumb(props: Omit<PageBreadcrumbProps, 'compact'>) {
  return <PageBreadcrumb {...props} compact />;
}
