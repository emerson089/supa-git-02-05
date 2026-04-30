import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface EstoqueLocal {
  id: string;
  nome: string;
  tipo: 'central' | 'loja' | 'banca';
  ativo: boolean;
  createdAt: string;
  userId: string;
}

export interface EstoquePorLocal {
  id: string;
  itemId: string;
  localId: string;
  quantidade: number;
  quantidadeReservada: number;
  updatedAt: string;
}

interface DbLocal {
  id: string;
  user_id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  created_at: string;
}

interface DbEstoquePorLocal {
  id: string;
  user_id: string;
  item_id: string;
  local_id: string;
  quantidade: number;
  quantidade_reservada: number;
  updated_at: string;
}

const mapDbLocalToLocal = (db: DbLocal): EstoqueLocal => ({
  id: db.id,
  nome: db.nome,
  tipo: db.tipo as 'central' | 'loja' | 'banca',
  ativo: db.ativo,
  createdAt: db.created_at,
  userId: db.user_id,
});

const mapDbEstoquePorLocal = (db: DbEstoquePorLocal): EstoquePorLocal => ({
  id: db.id,
  itemId: db.item_id,
  localId: db.local_id,
  quantidade: Number(db.quantidade),
  quantidadeReservada: Number(db.quantidade_reservada),
  updatedAt: db.updated_at,
});

// Hook para buscar locais (apenas ativos por padrão)
export function useLocais(apenasAtivos = true) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-locais', user?.id, apenasAtivos],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('estoque_locais')
        .select('*')
        .order('created_at', { ascending: true });

      if (apenasAtivos) {
        query = query.eq('ativo', true);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as DbLocal[]).map(mapDbLocalToLocal);
    },
    enabled: !!user,
  });
}

// Hook para buscar estoque por local
export function useEstoquePorLocal(localId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-por-local', user?.id, localId],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from('estoque_por_local')
        .select('*');

      if (localId) {
        query = query.eq('local_id', localId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data as DbEstoquePorLocal[]).map(mapDbEstoquePorLocal);
    },
    enabled: !!user,
    staleTime: 10000, // 10 segundos - Realtime cuida das atualizações críticas
  });
}

// Hook para criar locais padrão se não existirem
export function useEnsureDefaultLocais() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      // Verificar se já existem locais
      const { data: existingLocais, error: fetchError } = await supabase
        .from('estoque_locais')
        .select('tipo')
        .eq('user_id', user.id);

      // Se houve erro na leitura, não tentar criar
      if (fetchError) {
        console.error('[useEnsureDefaultLocais] Erro ao buscar locais:', fetchError);
        throw new Error('Erro ao verificar locais existentes');
      }

      const existingTypes = new Set(existingLocais?.map(l => l.tipo) || []);
      const defaultLocais = [
        { nome: 'Estoque Central', tipo: 'central' },
        { nome: 'Loja Parque das Feiras', tipo: 'loja' },
        { nome: 'Banca da Feira', tipo: 'banca' },
      ];

      const toCreate = defaultLocais.filter(l => !existingTypes.has(l.tipo));

      if (toCreate.length > 0) {
        const { error } = await supabase
          .from('estoque_locais')
          .insert(toCreate.map(l => ({
            user_id: user.id,
            nome: l.nome,
            tipo: l.tipo,
          })));

        if (error) {
          console.error('[useEnsureDefaultLocais] Erro ao criar locais:', error);
          throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
    onError: (error) => {
      console.error('[useEnsureDefaultLocais] Mutation failed:', error);
      // Não invalidar queries em caso de erro para evitar loops
    },
  });
}

// Hook para reservar estoque (criar pedido)
export function useReservarEstoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantidade }: { itemId: string; quantidade: number }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar local Central
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .single();

      if (!locais) throw new Error('Local Central não encontrado');

      // Buscar estoque atual no Central
      const { data: estoque, error: estErr } = await supabase
        .from('estoque_por_local')
        .select('*')
        .eq('item_id', itemId)
        .eq('local_id', locais.id)
        .single();

      if (estErr || !estoque) {
        // Criar registro se não existir
        const { error: insertError } = await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: locais.id,
            quantidade: 0,
            quantidade_reservada: quantidade,
          });

        if (insertError) throw insertError;
        return;
      }

      const disponivel = Number(estoque.quantidade) - Number(estoque.quantidade_reservada);
      if (disponivel < quantidade) {
        throw new Error(`Estoque insuficiente. Disponível: ${disponivel}`);
      }

      // Incrementar quantidade_reservada
      const { error } = await supabase
        .from('estoque_por_local')
        .update({
          quantidade_reservada: Number(estoque.quantidade_reservada) + quantidade,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estoque.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
    },
  });
}

// Hook para liberar reserva (cancelar pedido)
export function useLiberarReserva() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantidade }: { itemId: string; quantidade: number }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar local Central
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .single();

      if (!locais) throw new Error('Local Central não encontrado');

      // Buscar estoque atual no Central
      const { data: estoque } = await supabase
        .from('estoque_por_local')
        .select('*')
        .eq('item_id', itemId)
        .eq('local_id', locais.id)
        .single();

      if (!estoque) return;

      // Decrementar quantidade_reservada
      const novaReserva = Math.max(0, Number(estoque.quantidade_reservada) - quantidade);
      
      const { error } = await supabase
        .from('estoque_por_local')
        .update({
          quantidade_reservada: novaReserva,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estoque.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
    },
  });
}

// Hook para estornar estoque (devolução após entrega)
export function useEstornarEstoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, quantidade }: { itemId: string; quantidade: number }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar local Central
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .single();

      if (!locais) throw new Error('Local Central não encontrado');

      // Buscar estoque atual no Central
      const { data: estoque } = await supabase
        .from('estoque_por_local')
        .select('*')
        .eq('item_id', itemId)
        .eq('local_id', locais.id)
        .single();

      if (!estoque) {
        // Criar registro se não existir
        const { error: insertError } = await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: locais.id,
            quantidade: quantidade,
            quantidade_reservada: 0,
          });

        if (insertError) throw insertError;
      } else {
        // Incrementar quantidade
        const { error } = await supabase
          .from('estoque_por_local')
          .update({
            quantidade: Number(estoque.quantidade) + quantidade,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estoque.id);

        if (error) throw error;
      }

      // Sincronizar estoque_itens.quantidade (total geral)
      await sincronizarTotalGeral(itemId, user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
    },
  });
}

// Função auxiliar para sincronizar total geral
async function sincronizarTotalGeral(itemId: string, userId: string) {
  // Somar quantidade de todos os locais
  const { data: estoques } = await supabase
    .from('estoque_por_local')
    .select('quantidade')
    .eq('item_id', itemId);

  const total = estoques?.reduce((sum, e) => sum + Number(e.quantidade), 0) || 0;

  // Atualizar estoque_itens
  await supabase
    .from('estoque_itens')
    .update({ quantidade: total, updated_at: new Date().toISOString() })
    .eq('id', itemId);
}

// Hook para obter disponível no Central
export function useDisponivelCentral() {
  const { user } = useAuth();
  const { data: locais } = useLocais();
  
  // Buscar o localId do Central para filtrar a query
  const centralId = locais?.find(l => l.tipo === 'central')?.id;
  const { data: estoquePorLocal } = useEstoquePorLocal();

  const getDisponivelCentral = (itemId: string): number => {
    if (!centralId) return 0;

    const estoque = estoquePorLocal?.find(e => e.itemId === itemId && e.localId === centralId);
    if (!estoque) return 0;

    return Math.max(0, estoque.quantidade - estoque.quantidadeReservada);
  };

  const getEstoquePorLocalParaItem = (itemId: string) => {
    return estoquePorLocal?.filter(e => e.itemId === itemId) || [];
  };

  const getTotalPorLocal = (localId: string) => {
    return estoquePorLocal
      ?.filter(e => e.localId === localId)
      .reduce((sum, e) => sum + e.quantidade, 0) || 0;
  };

  return {
    locais: locais || [],
    estoquePorLocal: estoquePorLocal || [],
    getDisponivelCentral,
    getEstoquePorLocalParaItem,
    getTotalPorLocal,
    isLoading: !locais || !estoquePorLocal,
  };
}

// Hook para mover estoque entre locais
export function useMoverEstoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      itemId,
      origemId,
      destinoId,
      quantidade,
    }: {
      itemId: string;
      origemId: string;
      destinoId: string;
      quantidade: number;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar estoque na origem
      const { data: origem } = await supabase
        .from('estoque_por_local')
        .select('*')
        .eq('item_id', itemId)
        .eq('local_id', origemId)
        .single();

      if (!origem) throw new Error('Item não encontrado na origem');

      const disponivelOrigem = Number(origem.quantidade) - Number(origem.quantidade_reservada);
      if (disponivelOrigem < quantidade) {
        throw new Error(`Estoque insuficiente na origem. Disponível: ${disponivelOrigem}`);
      }

      // Reduzir na origem
      await supabase
        .from('estoque_por_local')
        .update({
          quantidade: Number(origem.quantidade) - quantidade,
          updated_at: new Date().toISOString(),
        })
        .eq('id', origem.id);

      // Buscar ou criar no destino
      const { data: destino } = await supabase
        .from('estoque_por_local')
        .select('*')
        .eq('item_id', itemId)
        .eq('local_id', destinoId)
        .single();

      if (destino) {
        await supabase
          .from('estoque_por_local')
          .update({
            quantidade: Number(destino.quantidade) + quantidade,
            updated_at: new Date().toISOString(),
          })
          .eq('id', destino.id);
      } else {
        await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: destinoId,
            quantidade: quantidade,
            quantidade_reservada: 0,
          });
      }
    },
    onSuccess: () => {
      // Invalidar TODAS as queries de estoque com predicate
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
    },
  });
}

// Hook para sincronizar estoque existente com estoque_por_local
export function useSincronizarEstoqueInicial() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar local Central
      const { data: central } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .single();

      if (!central) throw new Error('Local Central não encontrado');

      // Buscar todos os itens de estoque
      const { data: itens } = await supabase
        .from('estoque_itens')
        .select('id, quantidade')
        .eq('user_id', user.id);

      if (!itens || itens.length === 0) return;

      // Para cada item, garantir que o Central reflita o estoque real
      for (const item of itens) {
        const totalItem = Number(item.quantidade);

        // Buscar todos os registros por local para este item
        const { data: todosLocais } = await supabase
          .from('estoque_por_local')
          .select('id, local_id, quantidade')
          .eq('item_id', item.id);

        const somaLocais = (todosLocais || []).reduce((sum, e) => sum + Number(e.quantidade), 0);
        const centralExisting = (todosLocais || []).find(e => e.local_id === central.id);

        if (!centralExisting) {
          // Nunca teve registro no Central: depositar a diferença (estoque não distribuído)
          const naoDistribuido = Math.max(0, totalItem - somaLocais);
          if (naoDistribuido > 0 || somaLocais === 0) {
            await supabase
              .from('estoque_por_local')
              .insert({
                user_id: user.id,
                item_id: item.id,
                local_id: central.id,
                quantidade: naoDistribuido > 0 ? naoDistribuido : totalItem,
                quantidade_reservada: 0,
              });
          }
        } else if (somaLocais < totalItem) {
          // Central existe mas soma dos locais ficou abaixo do total
          // (reposição foi adicionada ao estoque_itens mas não distribuída)
          const diferenca = totalItem - somaLocais;
          await supabase
            .from('estoque_por_local')
            .update({ quantidade: Number(centralExisting.quantidade) + diferenca })
            .eq('id', centralExisting.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
    },
  });
}

// Hook para criar um novo local
export function useCriarLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ nome, tipo }: { nome: string; tipo: 'central' | 'loja' | 'banca' }) => {
      if (!user) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('estoque_locais')
        .insert({
          user_id: user.id,
          nome,
          tipo,
          ativo: true,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}

// Hook para editar um local existente
export function useEditarLocal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, nome, tipo }: { id: string; nome: string; tipo: 'central' | 'loja' | 'banca' }) => {
      const { error } = await supabase
        .from('estoque_locais')
        .update({ nome, tipo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}

// Hook para alternar o status de ativo de um local
export function useAlternarAtivoLocal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('estoque_locais')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}

// Hook para excluir um local
export function useExcluirLocal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se existem itens vinculados a este local
      const { data, error: checkError } = await supabase
        .from('estoque_por_local')
        .select('id')
        .eq('local_id', id);

      if (checkError) throw checkError;
      
      if (data && data.length > 0) {
        throw new Error('Não é possível excluir um local que possui registros de estoque. Desative-o em vez disso.');
      }

      const { error } = await supabase
        .from('estoque_locais')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
    },
  });
}
