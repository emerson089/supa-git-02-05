import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';
import { Loader2 } from 'lucide-react';
import { AppRole, ROLE_LANDING_PAGES } from '@/types/roles';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { role, loading: roleLoading, mustChangePassword, profile } = useRole();
  const location = useLocation();
  const hasShownToast = useRef(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const isLoading = authLoading || roleLoading;
  
  // Check if access is denied based on role
  const isAccessDenied = !isLoading && user && role && allowedRoles && !allowedRoles.includes(role);

  // Show toast when access is denied and trigger delayed redirect
  useEffect(() => {
    if (isAccessDenied && !hasShownToast.current) {
      hasShownToast.current = true;
      toast.error('Acesso negado', {
        description: 'Você não tem permissão para acessar esta página.',
        duration: 4000,
      });
      
      // Delay redirect to allow toast to be visible
      const timer = setTimeout(() => {
        setShouldRedirect(true);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [isAccessDenied]);

  // Reset flags when route changes
  useEffect(() => {
    hasShownToast.current = false;
    setShouldRedirect(false);
  }, [location.pathname]);

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

  // Role-based access control - wait for delayed redirect after toast
  if (isAccessDenied) {
    if (shouldRedirect) {
      const landingPage = ROLE_LANDING_PAGES[role!] || '/';
      return <Navigate to={landingPage} replace />;
    }
    
    // Show loading while waiting for redirect (toast is visible)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
