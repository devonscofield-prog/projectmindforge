import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { getDashboardUrl } from '@/lib/routes';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItem[];
  /** Override the default dashboard label */
  dashboardLabel?: string;
}

/**
 * Role-aware breadcrumb navigation component.
 * Automatically adds the home/dashboard link based on user role.
 */
export function PageBreadcrumb({ items, dashboardLabel }: PageBreadcrumbProps) {
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
      className="flex items-center text-sm text-muted-foreground" 
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center">
        {/* Home/Dashboard Link */}
        <li className="flex items-center">
          <Link 
            to={getDashboardUrl(role)} 
            className="flex items-center hover:text-foreground transition-colors"
            title={getDashboardLabel()}
          >
            <Home className="h-4 w-4" />
            <span className="sr-only">{getDashboardLabel()}</span>
          </Link>
        </li>

        {/* Dynamic Items */}
        {items.map((item, index) => (
          <li key={index} className="flex items-center">
            <ChevronRight className="h-4 w-4 mx-2 flex-shrink-0" />
            {item.href ? (
              <Link 
                to={item.href} 
                className="hover:text-foreground transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium truncate max-w-[200px]">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
