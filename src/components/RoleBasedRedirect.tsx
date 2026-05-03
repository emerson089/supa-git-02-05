import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRole } from '@/contexts/RoleContext';
import { ROLE_LANDING_PAGES } from '@/types/roles';
import { Loader2 } from 'lucide-react';

export function RoleBasedRedirect() {
  const { role, loading } = useRole();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (hasRedirected.current) return;

    const landingPage = role ? ROLE_LANDING_PAGES[role] : '/auth';
    hasRedirected.current = true;
    navigate(landingPage, { replace: true });
  }, [role, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
