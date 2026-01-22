import { Navigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { ROLE_LANDING_PAGES } from '@/types/roles';
import { Loader2 } from 'lucide-react';

export function RoleBasedRedirect() {
  const { role, loading } = useRole();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const landingPage = role ? ROLE_LANDING_PAGES[role] : '/auth';
  return <Navigate to={landingPage} replace />;
}
