import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useRole } from '@/contexts/RoleContext';

export interface UserLocation {
  id: string;
  localId: string;
  localNome: string;
  localTipo: 'central' | 'loja' | 'banca';
  canView: boolean;
  canAdjustStock: boolean;
  canEditPrice: boolean;
}

/**
 * Hook para obter os locais permitidos do usuário atual.
 * 
 * - Para ADMIN e GERENTE: retorna todos os locais (sem restrição)
 * - Para VENDEDOR: retorna apenas os locais vinculados na tabela user_locations
 */
export function useUserLocations() {
  const { user } = useAuth();
  const { role, isAdmin, isGerente, isVendedor } = useRole();

  return useQuery({
    queryKey: ['user-locations', user?.id, role],
    queryFn: async (): Promise<UserLocation[]> => {
      if (!user?.id) return [];

      // Admin e Gerente têm acesso total a todos os locais
      if (isAdmin || isGerente) {
        const { data, error } = await supabase
          .from('estoque_locais')
          .select('*')
          .eq('ativo', true)
          .order('created_at', { ascending: true });

        if (error) throw error;

        return (data || []).map(local => ({
          id: local.id,
          localId: local.id,
          localNome: local.nome,
          localTipo: local.tipo as 'central' | 'loja' | 'banca',
          canView: true,
          canAdjustStock: true,
          canEditPrice: true,
        }));
      }

      // Vendedor: buscar apenas locais permitidos
      const { data, error } = await supabase
        .from('user_locations')
        .select(`
          id,
          local_id,
          can_view,
          can_adjust_stock,
          can_edit_price,
          estoque_locais!inner (
            id,
            nome,
            tipo
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      return (data || []).map((ul: any) => ({
        id: ul.id,
        localId: ul.local_id,
        localNome: ul.estoque_locais.nome,
        localTipo: ul.estoque_locais.tipo as 'central' | 'loja' | 'banca',
        canView: ul.can_view,
        canAdjustStock: ul.can_adjust_stock,
        canEditPrice: ul.can_edit_price,
      }));
    },
    enabled: !!user?.id && !!role,
    staleTime: 60000, // 1 minuto - permissões mudam pouco
  });
}

/**
 * Hook para verificar se o usuário tem acesso a um local específico
 */
export function useHasLocationAccess(localId: string | null) {
  const { data: userLocations, isLoading } = useUserLocations();
  const { isAdmin, isGerente } = useRole();

  if (isAdmin || isGerente) {
    return {
      hasAccess: true,
      canView: true,
      canAdjustStock: true,
      canEditPrice: true,
      isLoading: false,
    };
  }

  const location = userLocations?.find(ul => ul.localId === localId);

  return {
    hasAccess: !!location?.canView,
    canView: !!location?.canView,
    canAdjustStock: !!location?.canAdjustStock,
    canEditPrice: !!location?.canEditPrice,
    isLoading,
  };
}

/**
 * Hook para obter o local padrão do vendedor (primeiro local permitido tipo 'loja')
 */
export function useDefaultVendedorLocation() {
  const { data: userLocations, isLoading } = useUserLocations();
  const { isVendedor } = useRole();

  const defaultLocation = isVendedor
    ? userLocations?.find(ul => ul.localTipo === 'loja' && ul.canView)
    : null;

  return {
    defaultLocation,
    isLoading,
  };
}
