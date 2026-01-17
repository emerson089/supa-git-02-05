import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type TipoEstoque = 'materia-prima' | 'acabado';
export type StatusEstoque = 'disponivel' | 'em_producao' | 'reservado' | 'baixo_estoque';

export interface ItemEstoque {
  id: string;
  nome: string;
  tipo: TipoEstoque;
  categoria: string;
  quantidade: number;
  unidade: string;
  quantidadeMinima: number;
  precoUnitario: number | null;
  localizacao: string | null;
  imagemUrl: string | null;
  producaoId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type TipoMovimentacao = 'entrada' | 'saida' | 'ENVIO_FEIRA' | 'RETORNO_FEIRA' | 'VENDA_FEIRA';

export interface MovimentacaoEstoque {
  id: string;
  itemId: string;
  tipo: TipoMovimentacao;
  quantidade: number;
  motivo: string | null;
  producaoId: string | null;
  transferenciaId?: string | null;
  localId?: string | null;
  estoqueAntes?: number;
  estoqueDepois?: number;
  createdAt: string;
}

interface DbItem {
  id: string;
  nome: string;
  tipo: string;
  categoria: string;
  quantidade: number;
  unidade: string;
  quantidade_minima: number;
  preco_unitario: number | null;
  localizacao: string | null;
  imagem_url: string | null;
  producao_id: string | null;
  created_at: string;
  updated_at: string;
}

interface DbMovimentacao {
  id: string;
  item_id: string;
  tipo: string;
  quantidade: number;
  motivo: string | null;
  producao_id: string | null;
  transferencia_id: string | null;
  local_id: string | null;
  estoque_antes: number;
  estoque_depois: number;
  created_at: string;
}

const mapDbItemToItem = (dbItem: DbItem): ItemEstoque => ({
  id: dbItem.id,
  nome: dbItem.nome,
  tipo: dbItem.tipo as TipoEstoque,
  categoria: dbItem.categoria,
  quantidade: Number(dbItem.quantidade),
  unidade: dbItem.unidade,
  quantidadeMinima: Number(dbItem.quantidade_minima),
  precoUnitario: dbItem.preco_unitario ? Number(dbItem.preco_unitario) : null,
  localizacao: dbItem.localizacao,
  imagemUrl: dbItem.imagem_url,
  producaoId: dbItem.producao_id,
  createdAt: dbItem.created_at,
  updatedAt: dbItem.updated_at,
});

const mapDbMovToMov = (dbMov: DbMovimentacao): MovimentacaoEstoque => ({
  id: dbMov.id,
  itemId: dbMov.item_id,
  tipo: dbMov.tipo as TipoMovimentacao,
  quantidade: Number(dbMov.quantidade),
  motivo: dbMov.motivo,
  producaoId: dbMov.producao_id,
  transferenciaId: dbMov.transferencia_id,
  localId: dbMov.local_id,
  estoqueAntes: Number(dbMov.estoque_antes || 0),
  estoqueDepois: Number(dbMov.estoque_depois || 0),
  createdAt: dbMov.created_at,
});

export function useEstoqueItens() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['estoque-itens', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('estoque_itens')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as DbItem[]).map(mapDbItemToItem);
    },
    enabled: !!user,
  });
}

export function useEstoqueMovimentacoes() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['estoque-movimentacoes', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data as DbMovimentacao[]).map(mapDbMovToMov);
    },
    enabled: !!user,
  });
}

export function useAddItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (item: Omit<ItemEstoque, 'id' | 'createdAt' | 'updatedAt'>) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('estoque_itens')
        .insert({
          user_id: user.id,
          nome: item.nome,
          tipo: item.tipo,
          categoria: item.categoria,
          quantidade: item.quantidade,
          unidade: item.unidade,
          quantidade_minima: item.quantidadeMinima,
          preco_unitario: item.precoUnitario,
          localizacao: item.localizacao,
          imagem_url: item.imagemUrl,
          producao_id: item.producaoId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbItemToItem(data as DbItem);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<ItemEstoque> & { id: string }) => {
      const dbUpdates: Record<string, unknown> = {};
      
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.tipo !== undefined) dbUpdates.tipo = updates.tipo;
      if (updates.categoria !== undefined) dbUpdates.categoria = updates.categoria;
      if (updates.quantidade !== undefined) dbUpdates.quantidade = updates.quantidade;
      if (updates.unidade !== undefined) dbUpdates.unidade = updates.unidade;
      if (updates.quantidadeMinima !== undefined) dbUpdates.quantidade_minima = updates.quantidadeMinima;
      if (updates.precoUnitario !== undefined) dbUpdates.preco_unitario = updates.precoUnitario;
      if (updates.localizacao !== undefined) dbUpdates.localizacao = updates.localizacao;
      if (updates.imagemUrl !== undefined) dbUpdates.imagem_url = updates.imagemUrl;
      if (updates.producaoId !== undefined) dbUpdates.producao_id = updates.producaoId;
      
      const { error } = await supabase
        .from('estoque_itens')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      
      // Sync quantity with estoque_por_local for Central location
      if (updates.quantidade !== undefined && user) {
        const { data: localCentral } = await supabase
          .from('estoque_locais')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', 'central')
          .single();
        
        if (localCentral) {
          const { data: estoqueLocal } = await supabase
            .from('estoque_por_local')
            .select('id')
            .eq('item_id', id)
            .eq('local_id', localCentral.id)
            .single();
          
          if (estoqueLocal) {
            await supabase
              .from('estoque_por_local')
              .update({ 
                quantidade: updates.quantidade,
                updated_at: new Date().toISOString()
              })
              .eq('id', estoqueLocal.id);
          } else {
            await supabase
              .from('estoque_por_local')
              .insert({
                user_id: user.id,
                item_id: id,
                local_id: localCentral.id,
                quantidade: updates.quantidade,
                quantidade_reservada: 0,
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}

export function useRemoveItem() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Verificar se existe em transferencia_itens com transferências ATIVAS (não soft-deleted)
      const { data: cargasAtivas, error: cargasError } = await supabase
        .from('transferencia_itens')
        .select(`
          id,
          transferencia_id,
          transferencias!inner(
            id,
            deleted_at
          )
        `)
        .eq('item_id', id)
        .is('transferencias.deleted_at', null);

      if (cargasError) {
        console.error('[useRemoveItem] Erro ao verificar cargas:', cargasError);
        throw new Error('Erro ao verificar dependências do item');
      }

      if (cargasAtivas && cargasAtivas.length > 0) {
        throw new Error(`Este modelo possui ${cargasAtivas.length} carga(s) de feira ativa(s). Exclua ou estorne as cargas na página Feira antes de remover o modelo.`);
      }

      // 2. Deletar registros dependentes primeiro
      // Deletar estoque_por_local
      const { error: deleteEstoqueLocalError } = await supabase
        .from('estoque_por_local')
        .delete()
        .eq('item_id', id);

      if (deleteEstoqueLocalError) {
        console.error('[useRemoveItem] Erro ao deletar estoque_por_local:', deleteEstoqueLocalError);
      }

      // Deletar estoque_movimentacoes
      const { error: deleteMovError } = await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('item_id', id);

      if (deleteMovError) {
        console.error('[useRemoveItem] Erro ao deletar movimentações:', deleteMovError);
      }

      // 3. Deletar o item principal
      const { error } = await supabase
        .from('estoque_itens')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('[useRemoveItem] Erro ao deletar item:', error);
        throw new Error(`Erro ao excluir item: ${error.message}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
  });
}

export function useAddMovimentacao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (mov: Omit<MovimentacaoEstoque, 'id' | 'createdAt'>) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: mov.itemId,
          tipo: mov.tipo,
          quantidade: mov.quantidade,
          motivo: mov.motivo,
          producao_id: mov.producaoId,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbMovToMov(data as DbMovimentacao);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
    },
  });
}
