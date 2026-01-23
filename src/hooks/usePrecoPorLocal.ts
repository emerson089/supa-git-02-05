import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface PrecoPorLocal {
  id: string;
  itemId: string;
  localId: string;
  precoVenda: number;
}

// Buscar preços por local para um local específico
export function usePrecosPorLocal(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['precos-por-local', localId, user?.id],
    queryFn: async (): Promise<Map<string, number>> => {
      if (!localId || !user?.id) return new Map();

      const { data, error } = await supabase
        .from('precos_por_local')
        .select('item_id, preco_venda')
        .eq('local_id', localId)
        .eq('user_id', user.id);

      if (error) throw error;

      return new Map((data || []).map(p => [p.item_id, Number(p.preco_venda)]));
    },
    enabled: !!localId && !!user?.id,
  });
}

// Buscar preço específico de um item em um local
export function usePrecoPorLocalItem(itemId: string | null, localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['preco-por-local-item', itemId, localId, user?.id],
    queryFn: async (): Promise<number | null> => {
      if (!itemId || !localId || !user?.id) return null;

      const { data, error } = await supabase
        .from('precos_por_local')
        .select('preco_venda')
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      return data ? Number(data.preco_venda) : null;
    },
    enabled: !!itemId && !!localId && !!user?.id,
  });
}

interface SetPrecoParams {
  itemId: string;
  localId: string;
  precoVenda: number;
}

// Definir/atualizar preço para um item em um local
export function useSetPrecoPorLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, localId, precoVenda }: SetPrecoParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Upsert: inserir ou atualizar se já existe
      const { data, error } = await supabase
        .from('precos_por_local')
        .upsert(
          {
            user_id: user.id,
            item_id: itemId,
            local_id: localId,
            preco_venda: precoVenda,
            updated_at: new Date().toISOString(),
          },
          { 
            onConflict: 'item_id,local_id,user_id',
            ignoreDuplicates: false 
          }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['precos-por-local', variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['preco-por-local-item', variables.itemId, variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['estoque-detalhado-por-local'] });
      toast.success('Preço atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao atualizar preço: ${error.message}`);
    },
  });
}

interface RemovePrecoParams {
  itemId: string;
  localId: string;
}

// Remover preço local (usar preço base)
export function useRemovePrecoPorLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, localId }: RemovePrecoParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('precos_por_local')
        .delete()
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .eq('user_id', user.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['precos-por-local', variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['preco-por-local-item', variables.itemId, variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['estoque-detalhado-por-local'] });
      toast.success('Preço local removido. Usando preço base.');
    },
    onError: (error: any) => {
      toast.error(`Erro ao remover preço: ${error.message}`);
    },
  });
}
