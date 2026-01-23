import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface EstoqueLocalDetalhado {
  id: string;
  itemId: string;
  itemNome: string;
  itemCodigo: string;
  itemImagemUrl: string | null;
  itemPrecoUnitario: number | null; // Preço base do produto
  precoLocal: number | null; // Preço específico deste local (se existir)
  precoExibido: number | null; // Preço final a usar (precoLocal ou precoUnitario)
  quantidade: number;
  quantidadeReservada: number;
  localId: string;
}

interface AjusteEstoqueParams {
  estoqueLocalId: string;
  itemId: string;
  localId: string;
  novaQuantidade: number;
  motivo: string;
}

interface AdicionarProdutoParams {
  itemId: string;
  localId: string;
  quantidade: number;
  motivo?: string;
}

interface ZerarProdutoParams {
  estoqueLocalId: string;
  itemId: string;
  localId: string;
  motivo: string;
}

interface MovimentacaoHistorico {
  id: string;
  createdAt: string;
  tipo: string;
  quantidade: number;
  estoqueAntes: number | null;
  estoqueDepois: number | null;
  motivo: string | null;
}

// Hook para buscar estoque detalhado de um local (com preços por local)
export function useEstoqueDetalhadoPorLocal(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-detalhado-por-local', localId, user?.id],
    queryFn: async (): Promise<EstoqueLocalDetalhado[]> => {
      if (!localId || !user?.id) return [];

      // 1. Buscar estoque com dados do item
      const { data, error } = await supabase
        .from('estoque_por_local')
        .select(`
          id,
          item_id,
          quantidade,
          quantidade_reservada,
          local_id,
          estoque_itens!inner (
            nome,
            categoria,
            imagem_url,
            preco_unitario
          )
        `)
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .gt('quantidade', 0);

      if (error) throw error;

      // 2. Buscar preços por local
      const { data: precosLocal, error: precosError } = await supabase
        .from('precos_por_local')
        .select('item_id, preco_venda')
        .eq('local_id', localId)
        .eq('user_id', user.id);

      if (precosError) {
        console.warn('Erro ao buscar preços por local:', precosError);
      }

      // Criar mapa de preços por local
      const precosMap = new Map<string, number>(
        (precosLocal || []).map(p => [p.item_id, Number(p.preco_venda)])
      );

      return (data || []).map((item: any) => {
        const precoBase = item.estoque_itens.preco_unitario;
        const precoLocal = precosMap.get(item.item_id) ?? null;
        // Prioridade: preço local > preço base
        const precoExibido = precoLocal ?? precoBase;

        return {
          id: item.id,
          itemId: item.item_id,
          itemNome: item.estoque_itens.nome,
          itemCodigo: item.estoque_itens.categoria,
          itemImagemUrl: item.estoque_itens.imagem_url,
          itemPrecoUnitario: precoBase,
          precoLocal,
          precoExibido,
          quantidade: Number(item.quantidade),
          quantidadeReservada: Number(item.quantidade_reservada),
          localId: item.local_id,
        };
      });
    },
    enabled: !!localId && !!user?.id,
  });
}

// Hook para ajustar estoque (aumentar ou diminuir) - USANDO RPC ATÔMICA
export function useAjustarEstoqueLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ estoqueLocalId, itemId, localId, novaQuantidade, motivo }: AjusteEstoqueParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Chamar RPC atômica - tudo ou nada
      const { error } = await supabase.rpc('rpc_ajustar_estoque_local', {
        p_local_id: localId,
        p_item_id: itemId,
        p_nova_quantidade: novaQuantidade,
        p_user_id: user.id,
        p_motivo: motivo
      });

      if (error) {
        console.error('[useAjustarEstoqueLocal] Erro RPC:', error);
        throw new Error(error.message || 'Erro ao ajustar estoque');
      }

      // Buscar estoque anterior para determinar tipo (para mensagem)
      const { data: estoqueAtual } = await supabase
        .from('estoque_por_local')
        .select('quantidade')
        .eq('id', estoqueLocalId)
        .single();

      const diferenca = novaQuantidade - Number(estoqueAtual?.quantidade || 0);
      const tipoMovimentacao = diferenca > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA';

      return { tipoMovimentacao, diferenca };
    },
    onSuccess: (result) => {
      // Invalidar TODAS as queries de estoque com predicate para garantir atualização
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-disponiveis-adicionar'] });
      
      const tipoTexto = result.tipoMovimentacao === 'AJUSTE_ENTRADA' ? 'entrada' : 'saída';
      toast.success(`Ajuste de ${tipoTexto} registrado com sucesso!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao ajustar estoque: ${error.message}`);
    },
  });
}

// Hook para transferir produto do Central para um local - USANDO RPC ATÔMICA
export function useAdicionarProdutoLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, localId, quantidade, motivo }: AdicionarProdutoParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // 1. Buscar local "central"
      const { data: localCentral, error: centralError } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      if (centralError) throw centralError;
      if (!localCentral) throw new Error('Local central não encontrado');

      // 2. Preparar itens no formato esperado pela RPC
      const itensJson = [{
        item_id: itemId,
        quantidade: quantidade
      }];

      // 3. Chamar RPC atômica - tudo ou nada
      const { data, error } = await supabase.rpc('rpc_criar_transferencia', {
        p_origem_local_id: localCentral.id,
        p_destino_local_id: localId,
        p_itens: itensJson,
        p_user_id: user.id,
        p_motivo: motivo || 'Transferência do Central'
      });

      if (error) {
        console.error('[useAdicionarProdutoLocal] Erro RPC:', error);
        // Extrair mensagem amigável do erro
        const errorMsg = error.message || 'Erro na transferência';
        throw new Error(errorMsg);
      }

      return { quantidade, transferenciaId: data };
    },
    onSuccess: () => {
      // Invalidar TODAS as queries de estoque com predicate para garantir atualização imediata
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['produtos-disponiveis-adicionar'] });
      toast.success('Produto transferido do Central para o local!');
    },
    onError: (error: any) => {
      toast.error(`Erro na transferência: ${error.message}`);
    },
  });
}

// Hook para zerar produto de um local
export function useZerarProdutoLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ estoqueLocalId, itemId, localId, motivo }: ZerarProdutoParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // 1. Buscar estoque atual
      const { data: estoqueAtual, error: fetchError } = await supabase
        .from('estoque_por_local')
        .select('quantidade')
        .eq('id', estoqueLocalId)
        .single();

      if (fetchError) throw fetchError;

      const estoqueAntes = Number(estoqueAtual.quantidade);

      if (estoqueAntes === 0) {
        throw new Error('O estoque já está zerado');
      }

      // 2. Zerar estoque
      const { error: updateError } = await supabase
        .from('estoque_por_local')
        .update({
          quantidade: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estoqueLocalId);

      if (updateError) throw updateError;

      // 3. Registrar movimentação de saída
      const { error: insertError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: itemId,
          local_id: localId,
          tipo: 'AJUSTE_SAIDA',
          quantidade: estoqueAntes,
          motivo: motivo,
          estoque_antes: estoqueAntes,
          estoque_depois: 0,
        });

      if (insertError) throw insertError;

      return { quantidade: estoqueAntes };
    },
    onSuccess: () => {
      // Invalidar TODAS as queries de estoque com predicate para garantir atualização
      queryClient.invalidateQueries({ 
        predicate: (query) => 
          Array.isArray(query.queryKey) && 
          (query.queryKey[0] === 'estoque-por-local' || 
           query.queryKey[0] === 'estoque-detalhado-por-local' ||
           query.queryKey[0] === 'estoque-itens'),
        refetchType: 'all'
      });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      toast.success('Estoque zerado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao zerar estoque: ${error.message}`);
    },
  });
}

// Hook para buscar histórico de movimentações de um item em um local
export function useHistoricoMovimentacoesItem(itemId: string | null, localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['historico-movimentacoes-item', itemId, localId, user?.id],
    queryFn: async (): Promise<MovimentacaoHistorico[]> => {
      if (!itemId || !localId || !user?.id) return [];

      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('id, created_at, tipo, quantidade, estoque_antes, estoque_depois, motivo')
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return (data || []).map((mov) => ({
        id: mov.id,
        createdAt: mov.created_at,
        tipo: mov.tipo,
        quantidade: Number(mov.quantidade),
        estoqueAntes: mov.estoque_antes ? Number(mov.estoque_antes) : null,
        estoqueDepois: mov.estoque_depois ? Number(mov.estoque_depois) : null,
        motivo: mov.motivo,
      }));
    },
    enabled: !!itemId && !!localId && !!user?.id,
  });
}

// Hook para buscar todos os produtos disponíveis para transferir do Central
export function useProdutosDisponiveis(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['produtos-disponiveis-adicionar', localId, user?.id],
    queryFn: async () => {
      if (!localId || !user?.id) return [];

      // 1. Buscar local "central"
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      // 2. Buscar todos os itens do usuário
      const { data: itens, error: itensError } = await supabase
        .from('estoque_itens')
        .select('id, nome, categoria, imagem_url, preco_unitario')
        .eq('user_id', user.id)
        .order('nome');

      if (itensError) throw itensError;

      // 3. Buscar estoque no Central (incluindo quantidade_reservada para calcular disponível)
      let estoqueCentralMap = new Map<string, { quantidade: number; reservada: number }>();
      if (localCentral) {
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('item_id, quantidade, quantidade_reservada')
          .eq('local_id', localCentral.id)
          .eq('user_id', user.id);

        estoqueCentralMap = new Map(
          (estoqueCentral || []).map(item => [
            item.item_id, 
            { 
              quantidade: Number(item.quantidade), 
              reservada: Number(item.quantidade_reservada || 0) 
            }
          ])
        );
      }

      // 4. Buscar quais já estão no local destino
      const { data: jaNoLocal, error: localError } = await supabase
        .from('estoque_por_local')
        .select('item_id, quantidade')
        .eq('local_id', localId)
        .eq('user_id', user.id);

      if (localError) throw localError;

      const itensNoLocal = new Map(
        (jaNoLocal || []).map(item => [item.item_id, Number(item.quantidade)])
      );

      return (itens || []).map(item => {
        const centralData = estoqueCentralMap.get(item.id);
        // Calcular disponível = quantidade - reservada (mesma regra do backend)
        const quantidadeDisponivel = centralData 
          ? Math.max(0, centralData.quantidade - centralData.reservada)
          : 0;
        
        return {
          id: item.id,
          nome: item.nome,
          codigo: item.categoria,
          imagemUrl: item.imagem_url,
          precoUnitario: item.preco_unitario,
          quantidadeCentral: quantidadeDisponivel,
          quantidadeNoLocal: itensNoLocal.get(item.id) || 0,
          jaNoLocal: (itensNoLocal.get(item.id) || 0) > 0,
        };
      });
    },
    enabled: !!localId && !!user?.id,
  });
}
