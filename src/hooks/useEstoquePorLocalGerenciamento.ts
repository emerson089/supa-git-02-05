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
  motivo: string;
  observacoes?: string;
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
  tipoAjusteId?: string | null;
  tipoAjusteNome?: string | null;
  localNome?: string | null;
  transferenciaId?: string | null;
}

// Hook para buscar estoque detalhado de um local (com preços por local)
export function useEstoqueDetalhadoPorLocal(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-detalhado-por-local', localId, user?.id],
    queryFn: async (): Promise<EstoqueLocalDetalhado[]> => {
      if (!localId || !user?.id) return [];

      // 1. Buscar estoque com dados do item
      // Query SEM filtro user_id - RLS controla acesso via has_location_access()
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
        .gt('quantidade', 0);

      if (error) throw error;

      // 2. Buscar preços por local - RLS controla acesso
      const { data: precosLocal, error: precosError } = await supabase
        .from('precos_por_local')
        .select('item_id, preco_venda')
        .eq('local_id', localId);

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

// Hook para ajustar estoque (aumentar ou diminuir) - USANDO RPC ATÔMICA + preco_aplicado + tipo_ajuste_id
export function useAjustarEstoqueLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ estoqueLocalId, itemId, localId, novaQuantidade, motivo, precoAplicado, tipoAjusteId }: AjusteEstoqueParams & { precoAplicado?: number; tipoAjusteId?: string }) => {
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

      // Atualizar a última movimentação para incluir preco_aplicado e tipo_ajuste_id
      const { data: ultimaMov } = await supabase
        .from('estoque_movimentacoes')
        .select('id')
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (ultimaMov) {
        const updateData: Record<string, any> = {};
        if (precoAplicado !== undefined && precoAplicado > 0) {
          updateData.preco_aplicado = precoAplicado;
        }
        if (tipoAjusteId) {
          updateData.tipo_ajuste_id = tipoAjusteId;
        }
        
        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('estoque_movimentacoes')
            .update(updateData)
            .eq('id', ultimaMov.id);
        }
      }

      return { tipoMovimentacao, diferenca };
    },
    onSuccess: (result, variables) => {
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
      queryClient.invalidateQueries({ queryKey: ['vendas-desde-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['contagens-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['historico-movimentacoes-item'] });
      
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
    mutationFn: async ({ itemId, localId, quantidade, motivo, observacoes }: AdicionarProdutoParams) => {
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
        p_motivo: motivo || 'reposicao',
        p_observacoes: observacoes || null
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
export function useHistoricoMovimentacoesItem(
  itemId: string | null, 
  localId: string | null,
  semLimite?: boolean
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['historico-movimentacoes-item', itemId, localId, user?.id, semLimite],
    queryFn: async (): Promise<MovimentacaoHistorico[]> => {
      if (!itemId || !localId || !user?.id) return [];

      // Query SEM filtro user_id - RLS controla acesso via local_id
      let query = supabase
        .from('estoque_movimentacoes')
        .select(`
          id, 
          created_at, 
          tipo, 
          quantidade, 
          estoque_antes, 
          estoque_depois, 
          motivo,
          tipo_ajuste_id,
          transferencia_id,
          local_id
        `)
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .order('created_at', { ascending: false });
      
      // Aplicar limite apenas se não for busca completa
      if (!semLimite) {
        query = query.limit(50);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Buscar nomes dos tipos de ajuste se houver
      const tipoAjusteIds = [...new Set((data || []).filter(m => m.tipo_ajuste_id).map(m => m.tipo_ajuste_id))];
      let tiposAjusteMap = new Map<string, string>();
      
      if (tipoAjusteIds.length > 0) {
        const { data: tiposAjuste } = await supabase
          .from('tipos_ajuste_estoque')
          .select('id, nome')
          .in('id', tipoAjusteIds);
        
        tiposAjusteMap = new Map((tiposAjuste || []).map(t => [t.id, t.nome]));
      }

      // Buscar nome do local atual
      const { data: localData } = await supabase
        .from('estoque_locais')
        .select('nome')
        .eq('id', localId)
        .single();

      return (data || []).map((mov) => ({
        id: mov.id,
        createdAt: mov.created_at,
        tipo: mov.tipo,
        quantidade: Number(mov.quantidade),
        estoqueAntes: mov.estoque_antes ? Number(mov.estoque_antes) : null,
        estoqueDepois: mov.estoque_depois ? Number(mov.estoque_depois) : null,
        motivo: mov.motivo,
        tipoAjusteId: mov.tipo_ajuste_id,
        tipoAjusteNome: mov.tipo_ajuste_id ? tiposAjusteMap.get(mov.tipo_ajuste_id) || null : null,
        localNome: localData?.nome || null,
        transferenciaId: mov.transferencia_id,
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

      // 1. Primeiro buscar o dono do local destino (para vendedores acessarem o Central do admin)
      const { data: localInfo, error: localInfoError } = await supabase
        .from('estoque_locais')
        .select('id, user_id')
        .eq('id', localId)
        .single();

      if (localInfoError) throw localInfoError;
      
      const ownerUserId = localInfo?.user_id;

      // 2. Buscar local "central" do DONO do local (não do usuário logado)
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', ownerUserId)
        .eq('tipo', 'central')
        .maybeSingle();

      // 3. Buscar todos os itens do DONO (RLS controla acesso)
      const { data: itens, error: itensError } = await supabase
        .from('estoque_itens')
        .select('id, nome, categoria, imagem_url, preco_unitario')
        .order('nome');

      if (itensError) throw itensError;

      // 4. Buscar estoque no Central (RLS controla acesso)
      let estoqueCentralMap = new Map<string, { quantidade: number; reservada: number }>();
      if (localCentral) {
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('item_id, quantidade, quantidade_reservada')
          .eq('local_id', localCentral.id);

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

      // 5. Buscar quais já estão no local destino (RLS controla acesso)
      const { data: jaNoLocal, error: localError } = await supabase
        .from('estoque_por_local')
        .select('item_id, quantidade')
        .eq('local_id', localId);

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
