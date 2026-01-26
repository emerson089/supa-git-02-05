import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export interface UserLocationPermission {
  id: string;
  user_id: string;
  local_id: string;
  can_view: boolean;
  can_adjust_stock: boolean;
  can_edit_price: boolean;
  local_nome?: string;
}

export function useUserLocationManagement() {
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const fetchUserLocations = useCallback(async (userId: string): Promise<UserLocationPermission[]> => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          id,
          user_id,
          local_id,
          can_view,
          can_adjust_stock,
          can_edit_price
        `)
        .eq('user_id', userId);

      if (error) throw error;

      // Fetch location names separately
      if (data && data.length > 0) {
        const localIds = data.map(ul => ul.local_id);
        const { data: locais } = await supabase
          .from('estoque_locais')
          .select('id, nome')
          .in('id', localIds);

        const locaisMap = new Map(locais?.map(l => [l.id, l.nome]) || []);
        
        return data.map(ul => ({
          ...ul,
          local_nome: locaisMap.get(ul.local_id) || 'Local desconhecido'
        }));
      }

      return data || [];
    } catch (error: any) {
      console.error('Error fetching user locations:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAvailableLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('estoque_locais')
        .select('id, nome, tipo')
        .eq('ativo', true)
        .neq('tipo', 'central'); // Exclude Central from available locations for vendedor

      if (error) throw error;
      return data || [];
    } catch (error: any) {
      console.error('Error fetching available locations:', error);
      return [];
    }
  }, []);

  const addUserLocation = useCallback(async (
    userId: string,
    localId: string,
    permissions: { can_view: boolean; can_adjust_stock: boolean; can_edit_price: boolean }
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .insert({
          user_id: userId,
          local_id: localId,
          can_view: permissions.can_view,
          can_adjust_stock: permissions.can_adjust_stock,
          can_edit_price: permissions.can_edit_price
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este usuário já possui acesso a este local');
        } else {
          throw error;
        }
        return false;
      }

      toast.success('Acesso ao local adicionado com sucesso');
      queryClient.invalidateQueries({ queryKey: ['user-locations'] });
      return true;
    } catch (error: any) {
      console.error('Error adding user location:', error);
      toast.error('Erro ao adicionar acesso ao local');
      return false;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  const updateUserLocation = useCallback(async (
    id: string,
    permissions: { can_view: boolean; can_adjust_stock: boolean; can_edit_price: boolean }
  ): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .update({
          can_view: permissions.can_view,
          can_adjust_stock: permissions.can_adjust_stock,
          can_edit_price: permissions.can_edit_price,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      toast.success('Permissões atualizadas com sucesso');
      queryClient.invalidateQueries({ queryKey: ['user-locations'] });
      return true;
    } catch (error: any) {
      console.error('Error updating user location:', error);
      toast.error('Erro ao atualizar permissões');
      return false;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  const removeUserLocation = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Acesso ao local removido');
      queryClient.invalidateQueries({ queryKey: ['user-locations'] });
      return true;
    } catch (error: any) {
      console.error('Error removing user location:', error);
      toast.error('Erro ao remover acesso ao local');
      return false;
    } finally {
      setLoading(false);
    }
  }, [queryClient]);

  return {
    loading,
    fetchUserLocations,
    fetchAvailableLocations,
    addUserLocation,
    updateUserLocation,
    removeUserLocation
  };
}
