import { ReactNode } from 'react';
import { useRole } from '@/contexts/RoleContext';
import { AppRole } from '@/types/roles';

interface RoleGateProps {
  children: ReactNode;
  allowedRoles?: AppRole[];
  requiredPermission?: string;
  fallback?: ReactNode;
}

/**
 * Component that conditionally renders children based on user role or permission.
 * If user doesn't have required role/permission, renders fallback (or nothing).
 */
export function RoleGate({ 
  children, 
  allowedRoles, 
  requiredPermission,
  fallback = null 
}: RoleGateProps) {
  const { role, hasPermission, loading } = useRole();

  // While loading, don't render anything
  if (loading) {
    return null;
  }

  // If no role restrictions, render children
  if (!allowedRoles && !requiredPermission) {
    return <>{children}</>;
  }

  // Check role-based access
  if (allowedRoles && role) {
    if (!allowedRoles.includes(role)) {
      return <>{fallback}</>;
    }
  }

  // Check permission-based access
  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
}

/**
 * Hook-based alternative for programmatic role checking
 */
export function useRoleGate(allowedRoles?: AppRole[], requiredPermission?: string): boolean {
  const { role, hasPermission, loading } = useRole();

  if (loading) return false;

  if (allowedRoles && role) {
    if (!allowedRoles.includes(role)) {
      return false;
    }
  }

  if (requiredPermission) {
    if (!hasPermission(requiredPermission)) {
      return false;
    }
  }

  return true;
}
