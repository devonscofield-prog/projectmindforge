import { useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/database';
import { getDashboardUrl } from '@/lib/routes';
import { MFAGate } from '@/components/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const wasAuthenticatedRef = useRef(false);

  // Track that we've successfully authenticated before
  if (user && role) wasAuthenticatedRef.current = true;

  if (loading) {
    // If user was previously authenticated, keep children mounted
    // to prevent destructive unmounts during brief auth re-checks (e.g. tab switch)
    if (wasAuthenticatedRef.current) {
      return <MFAGate>{children}</MFAGate>;
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    wasAuthenticatedRef.current = false;
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to={getDashboardUrl(role)} replace />;
  }

  return <MFAGate>{children}</MFAGate>;
}
