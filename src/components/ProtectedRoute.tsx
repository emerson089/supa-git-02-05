import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { Loader2 } from 'lucide-react';
import { AppRole, ROLE_LANDING_PAGES } from '@/types/roles';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, mustChangePassword, profile } = useRole();
  const location = useLocation();

  const isLoading = authLoading || roleLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // User is inactive
  if (profile?.status === 'inativo') {
    return <Navigate to="/auth" replace />;
  }

  // Must change password - redirect to change password page
  // Unless already on change-password page
  if (mustChangePassword && location.pathname !== '/alterar-senha') {
    return <Navigate to="/alterar-senha" replace />;
  }

  // Role-based access control
  if (allowedRoles && role) {
    if (!allowedRoles.includes(role)) {
      // Redirect to user's landing page based on role
      const landingPage = ROLE_LANDING_PAGES[role] || '/';
      return <Navigate to={landingPage} replace />;
    }
  }

  return <>{children}</>;
}
