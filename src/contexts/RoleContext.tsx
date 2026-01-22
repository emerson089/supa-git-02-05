import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserProfile, ROLE_PERMISSIONS } from '@/types/roles';

interface RoleContextType {
  role: AppRole | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  hasPermission: (permission: string) => boolean;
  hasRole: (roles: AppRole | AppRole[]) => boolean;
  isAdmin: boolean;
  isGerente: boolean;
  isVendedor: boolean;
  mustChangePassword: boolean;
  refreshProfile: () => Promise<void>;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

interface RoleProviderProps {
  children: ReactNode;
}

export function RoleProvider({ children }: RoleProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setRole(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the RPC function to get profile with role
      const { data, error: fetchError } = await supabase.rpc('get_my_profile');

      if (fetchError) {
        console.error('Failed to fetch profile:', fetchError);
        setError('Erro ao carregar perfil');
        setRole(null);
        setProfile(null);
        return;
      }

      if (data && data.length > 0) {
        const profileData = data[0] as UserProfile;
        setProfile(profileData);
        setRole(profileData.role);

        // Update last sign in
        await supabase
          .from('profiles')
          .update({ last_sign_in_at: new Date().toISOString() })
          .eq('user_id', user.id);
      } else {
        // Profile doesn't exist yet (shouldn't happen with trigger, but fallback)
        console.warn('Profile not found for user:', user.id);
        setRole(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading, fetchProfile]);

  const hasPermission = useCallback((permission: string): boolean => {
    if (!role) return false;
    const permissions = ROLE_PERMISSIONS[role] || [];
    return permissions.includes(permission);
  }, [role]);

  const hasRole = useCallback((roles: AppRole | AppRole[]): boolean => {
    if (!role) return false;
    if (Array.isArray(roles)) {
      return roles.includes(role);
    }
    return role === roles;
  }, [role]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const value: RoleContextType = {
    role,
    profile,
    loading: authLoading || loading,
    error,
    hasPermission,
    hasRole,
    isAdmin: role === 'admin',
    isGerente: role === 'gerente',
    isVendedor: role === 'vendedor',
    mustChangePassword: profile?.must_change_password ?? false,
    refreshProfile,
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextType {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
