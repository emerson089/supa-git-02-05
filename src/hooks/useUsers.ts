import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, UserProfile } from '@/types/roles';
import { toast } from 'sonner';

interface UserListItem {
  id: string;
  user_id: string;
  nome: string | null;
  email: string;
  status: 'ativo' | 'inativo';
  must_change_password: boolean;
  last_sign_in_at: string | null;
  role: AppRole | null;
  created_at: string;
}

interface InviteUserParams {
  email: string;
  nome: string;
  role: AppRole;
}

interface InviteUserResult {
  success: boolean;
  tempPassword?: string;
  error?: string;
}

export function useUsers() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) {
        throw profilesError;
      }

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) {
        throw rolesError;
      }

      // Combine profiles with roles
      const rolesMap = new Map(roles?.map(r => [r.user_id, r.role]) || []);
      
      const combinedUsers: UserListItem[] = (profiles || []).map(profile => ({
        id: profile.id,
        user_id: profile.user_id,
        nome: profile.nome,
        email: profile.email,
        status: profile.status as 'ativo' | 'inativo',
        must_change_password: profile.must_change_password ?? false,
        last_sign_in_at: profile.last_sign_in_at,
        role: rolesMap.get(profile.user_id) as AppRole | null,
        created_at: profile.created_at,
      }));

      setUsers(combinedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }, []);

  const inviteUser = useCallback(async (params: InviteUserParams): Promise<InviteUserResult> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        return { success: false, error: 'Usuário não autenticado' };
      }

    const response = await supabase.functions.invoke('invite-user', {
      body: params,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

      if (response.error) {
        const errorMessage = response.error.message || 'Erro ao criar usuário';
        return { success: false, error: errorMessage };
      }

      const data = response.data;
      
      if (!data.success) {
        return { success: false, error: data.error || 'Erro ao criar usuário' };
      }

      // Refresh user list
      await fetchUsers();

      return { 
        success: true, 
        tempPassword: data.tempPassword 
      };
    } catch (err) {
      console.error('Error inviting user:', err);
      return { success: false, error: 'Erro ao criar usuário' };
    }
  }, [fetchUsers]);

  const updateUserRole = useCallback(async (userId: string, newRole: AppRole): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const response = await supabase.functions.invoke('update-user-role', {
        body: { userId, newRole },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Erro ao atualizar role');
        return false;
      }

      const data = response.data;
      
      if (!data.success) {
        toast.error(data.error || 'Erro ao atualizar role');
        return false;
      }

      toast.success('Role atualizado com sucesso');
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Error updating role:', err);
      toast.error('Erro ao atualizar role');
      return false;
    }
  }, [fetchUsers]);

  const toggleUserStatus = useCallback(async (userId: string, newStatus: 'ativo' | 'inativo'): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const response = await supabase.functions.invoke('toggle-user-status', {
        body: { userId, status: newStatus },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Erro ao atualizar status');
        return false;
      }

      const data = response.data;
      
      if (!data.success) {
        toast.error(data.error || 'Erro ao atualizar status');
        return false;
      }

      toast.success(data.message);
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Error toggling status:', err);
      toast.error('Erro ao atualizar status');
      return false;
    }
  }, [fetchUsers]);

  const resetUserPassword = useCallback(async (userId: string): Promise<string | null> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Usuário não autenticado');
        return null;
      }

      const response = await supabase.functions.invoke('admin-reset-password', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Erro ao resetar senha');
        return null;
      }

      const data = response.data;
      
      if (!data.success) {
        toast.error(data.error || 'Erro ao resetar senha');
        return null;
      }

      toast.success('Senha resetada com sucesso');
      return data.tempPassword;
    } catch (err) {
      console.error('Error resetting password:', err);
      toast.error('Erro ao resetar senha');
      return null;
    }
  }, []);

  const deleteUser = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        toast.error('Usuário não autenticado');
        return false;
      }

      const response = await supabase.functions.invoke('delete-user', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.error) {
        toast.error(response.error.message || 'Erro ao excluir usuário');
        return false;
      }

      const data = response.data;
      
      if (!data.success) {
        toast.error(data.error || 'Erro ao excluir usuário');
        return false;
      }

      toast.success('Usuário excluído com sucesso');
      await fetchUsers();
      return true;
    } catch (err) {
      console.error('Error deleting user:', err);
      toast.error('Erro ao excluir usuário');
      return false;
    }
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    inviteUser,
    updateUserRole,
    toggleUserStatus,
    resetUserPassword,
    deleteUser,
  };
}
