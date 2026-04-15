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
  // Novos campos para histórico e desempenho
  quantidadeInicial: number;
  custoMedio: number | null;
  qtdComCusto: number;
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
  // Novos campos para histórico e desempenho
  quantidade_inicial: number;
  custo_medio: number | null;
  qtd_com_custo: number | null;
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
  // Novos campos para histórico e desempenho
  quantidadeInicial: Number(dbItem.quantidade_inicial || 0),
  custoMedio: dbItem.custo_medio != null ? Number(dbItem.custo_medio) : null,
  qtdComCusto: dbItem.qtd_com_custo != null ? Number(dbItem.qtd_com_custo) : 0,
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
      
      // 1. Buscar o local Central do usuário
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      // 2. Buscar todos os itens
      const { data: itens, error } = await supabase
        .from('estoque_itens')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!itens) return [];

      // 3. Se temos Central, buscar quantidades de estoque_por_local
      if (localCentral) {
        const { data: estoquePorLocal } = await supabase
          .from('estoque_por_local')
          .select('item_id, quantidade')
          .eq('local_id', localCentral.id);

        // Criar mapa de quantidades do Central
        const quantidadeCentralMap = new Map<string, number>();
        if (estoquePorLocal) {
          estoquePorLocal.forEach(epl => {
            quantidadeCentralMap.set(epl.item_id, Number(epl.quantidade));
          });
        }

        // Mapear itens usando quantidade do Central quando disponível
        return (itens as any[]).map(dbItem => ({
          ...mapDbItemToItem(dbItem as DbItem),
          quantidade: quantidadeCentralMap.has(dbItem.id) 
            ? quantidadeCentralMap.get(dbItem.id)! 
            : Number(dbItem.quantidade),
        }));
      }

      return (itens as any[]).map(item => mapDbItemToItem(item as DbItem));
    },
    enabled: !!user,
    staleTime: 30000, // 30 segundos - Realtime cuida das atualizações críticas
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
          quantidade_inicial: item.quantidadeInicial || item.quantidade,
        })
        .select()
        .single();
      
      if (error) throw error;
      return mapDbItemToItem(data as any as DbItem);
    },
    onSuccess: (newItem) => {
      // Optimistic: adiciona imediatamente ao cache
      queryClient.setQueryData(['estoque-itens', user?.id], (old: ItemEstoque[] | undefined) => {
        if (!old) return [newItem];
        return [newItem, ...old];
      });
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
      if (updates.quantidadeInicial !== undefined) dbUpdates.quantidade_inicial = updates.quantidadeInicial;
      
      const { error } = await supabase
        .from('estoque_itens')
        .update(dbUpdates)
        .eq('id', id);
      
      if (error) throw error;
      
      // Sync quantity with estoque_por_local for Central location
      if (updates.quantidade !== undefined && user) {
        const localCentral = await queryClient.fetchQuery({
          queryKey: ['estoque-local-central', user.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('estoque_locais')
              .select('id')
              .eq('user_id', user.id)
              .eq('tipo', 'central')
              .maybeSingle();
            if (error) console.error('[useUpdateItem] Erro ao buscar local central:', error);
            return data ?? null;
          },
          staleTime: 5 * 60 * 1000,
        });
        
        if (localCentral) {
          const { data: estoqueLocal, error: estoqueLocalError } = await supabase
            .from('estoque_por_local')
            .select('id')
            .eq('item_id', id)
            .eq('local_id', localCentral.id)
            .maybeSingle();
          
          if (estoqueLocalError) {
            console.error('[useUpdateItem] Erro ao buscar estoque local:', estoqueLocalError);
          }
          
          if (estoqueLocal) {
            const { error: updateError } = await supabase
              .from('estoque_por_local')
              .update({ 
                quantidade: updates.quantidade,
                updated_at: new Date().toISOString()
              })
              .eq('id', estoqueLocal.id);
            
            if (updateError) {
              console.error('[useUpdateItem] Erro ao atualizar estoque_por_local:', updateError);
            }
          } else {
            const { error: insertError } = await supabase
              .from('estoque_por_local')
              .insert({
                user_id: user.id,
                item_id: id,
                local_id: localCentral.id,
                quantidade: updates.quantidade,
                quantidade_reservada: 0,
              });
            
            if (insertError) {
              console.error('[useUpdateItem] Erro ao inserir estoque_por_local:', insertError);
            }
          }
        }
      }
      
      return { id, ...updates };
    },
    onMutate: async ({ id, ...updates }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['estoque-itens', user?.id] });
      
      // Salvar estado anterior
      const previousItens = queryClient.getQueryData<ItemEstoque[]>(['estoque-itens', user?.id]);
      
      // Atualizar cache otimisticamente
      queryClient.setQueryData(['estoque-itens', user?.id], (old: ItemEstoque[] | undefined) => {
        if (!old) return old;
        return old.map(item => 
          item.id === id ? { ...item, ...updates } : item
        );
      });
      
      return { previousItens };
    },
    onError: (err, variables, context) => {
      // Rollback em caso de erro
      if (context?.previousItens) {
        queryClient.setQueryData(['estoque-itens', user?.id], context.previousItens);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}

export function useRemoveItem() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // 1. Verificar APENAS transferências EM ANDAMENTO (concluídas não bloqueiam exclusão)
      const { data: transferenciasAtivas, error: cargasError } = await supabase
        .from('transferencia_itens')
        .select(`
          id,
          transferencia_id,
          transferencias!inner(
            id,
            tipo,
            status,
            deleted_at
          )
        `)
        .eq('item_id', id)
        .is('transferencias.deleted_at', null)
        .eq('transferencias.status', 'em_andamento');

      if (cargasError) {
        console.error('[useRemoveItem] Erro ao verificar transferências:', cargasError);
        throw new Error('Erro ao verificar dependências do item');
      }

      if (transferenciasAtivas && transferenciasAtivas.length > 0) {
        // Separar por tipo para mensagem mais clara
        const cargasFeira = transferenciasAtivas.filter(
          (c: any) => c.transferencias?.tipo === 'carga_feira'
        ).length;
        const transferencias = transferenciasAtivas.filter(
          (c: any) => c.transferencias?.tipo === 'transferencia'
        ).length;
        
        let mensagem = 'Este modelo possui movimentações em andamento:\n';
        if (cargasFeira > 0) {
          mensagem += `• ${cargasFeira} carga(s) de feira (excluir/estornar em Feira)\n`;
        }
        if (transferencias > 0) {
          mensagem += `• ${transferencias} transferência(s) entre locais (finalizar em Transferências)\n`;
        }
        mensagem += '\nFinalize ou cancele as movimentações antes de excluir o modelo.';
        
        throw new Error(mensagem);
      }

      // 2. Limpar TODOS os transferencia_itens restantes (fallback antes do CASCADE)
      const { error: deleteTransItensError } = await supabase
        .from('transferencia_itens')
        .delete()
        .eq('item_id', id);

      if (deleteTransItensError) {
        console.error('[useRemoveItem] Erro ao deletar transferencia_itens:', deleteTransItensError);
        // Não bloquear — CASCADE vai cuidar na deleção do item
      }

      // 3. Deletar registros dependentes
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

      // 4. Deletar o item principal
      const { error } = await supabase
        .from('estoque_itens')
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error('[useRemoveItem] Erro ao deletar item:', error);
        throw new Error(`Erro ao excluir item: ${error.message}`);
      }
      
      return id;
    },
    onMutate: async (id) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['estoque-itens', user?.id] });
      
      // Salvar estado anterior
      const previousItens = queryClient.getQueryData<ItemEstoque[]>(['estoque-itens', user?.id]);
      
      // Remover do cache imediatamente (optimistic)
      queryClient.setQueryData(['estoque-itens', user?.id], (old: ItemEstoque[] | undefined) => {
        if (!old) return old;
        return old.filter(item => item.id !== id);
      });
      
      return { previousItens };
    },
    onError: (err, id, context) => {
      // Rollback em caso de erro
      if (context?.previousItens) {
        queryClient.setQueryData(['estoque-itens', user?.id], context.previousItens);
      }
    },
    onSettled: () => {
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
