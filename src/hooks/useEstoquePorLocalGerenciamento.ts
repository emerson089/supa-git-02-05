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
  itemPrecoUnitario: number | null;
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

// Hook para buscar estoque detalhado de um local
export function useEstoqueDetalhadoPorLocal(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['estoque-detalhado-por-local', localId, user?.id],
    queryFn: async (): Promise<EstoqueLocalDetalhado[]> => {
      if (!localId || !user?.id) return [];

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

      return (data || []).map((item: any) => ({
        id: item.id,
        itemId: item.item_id,
        itemNome: item.estoque_itens.nome,
        itemCodigo: item.estoque_itens.categoria,
        itemImagemUrl: item.estoque_itens.imagem_url,
        itemPrecoUnitario: item.estoque_itens.preco_unitario,
        quantidade: Number(item.quantidade),
        quantidadeReservada: Number(item.quantidade_reservada),
        localId: item.local_id,
      }));
    },
    enabled: !!localId && !!user?.id,
  });
}

// Hook para ajustar estoque (aumentar ou diminuir)
export function useAjustarEstoqueLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ estoqueLocalId, itemId, localId, novaQuantidade, motivo }: AjusteEstoqueParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // 1. Buscar estoque atual
      const { data: estoqueAtual, error: fetchError } = await supabase
        .from('estoque_por_local')
        .select('quantidade')
        .eq('id', estoqueLocalId)
        .single();

      if (fetchError) throw fetchError;

      const estoqueAntes = Number(estoqueAtual.quantidade);
      const diferenca = novaQuantidade - estoqueAntes;

      if (diferenca === 0) {
        throw new Error('A quantidade não foi alterada');
      }

      const tipoMovimentacao = diferenca > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SAIDA';

      // 2. Atualizar estoque_por_local
      const { error: updateError } = await supabase
        .from('estoque_por_local')
        .update({
          quantidade: novaQuantidade,
          updated_at: new Date().toISOString(),
        })
        .eq('id', estoqueLocalId);

      if (updateError) throw updateError;

      // 3. Registrar movimentação
      const { error: insertError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: itemId,
          local_id: localId,
          tipo: tipoMovimentacao,
          quantidade: Math.abs(diferenca),
          motivo: motivo,
          estoque_antes: estoqueAntes,
          estoque_depois: novaQuantidade,
        });

      if (insertError) throw insertError;

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

// Hook para transferir produto do Central para um local (subtrai do Central e adiciona no destino)
export function useAdicionarProdutoLocal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, localId, quantidade, motivo }: AdicionarProdutoParams) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // 1. Buscar local "central"
      const { data: localCentral, error: centralError } = await supabase
        .from('estoque_locais')
        .select('id, nome')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      if (centralError) throw centralError;
      if (!localCentral) throw new Error('Local central não encontrado');

      // 2. Buscar estoque atual no Central
      const { data: estoqueCentral, error: estoqueCentralError } = await supabase
        .from('estoque_por_local')
        .select('id, quantidade')
        .eq('item_id', itemId)
        .eq('local_id', localCentral.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (estoqueCentralError) throw estoqueCentralError;

      const qtdCentral = Number(estoqueCentral?.quantidade || 0);

      // 3. Validar disponibilidade
      if (qtdCentral < quantidade) {
        throw new Error(`Quantidade insuficiente no Central. Disponível: ${qtdCentral}`);
      }

      // 4. Buscar nome do local destino para o motivo
      const { data: localDestino } = await supabase
        .from('estoque_locais')
        .select('nome')
        .eq('id', localId)
        .maybeSingle();

      const nomeLocalDestino = localDestino?.nome || 'Local';

      // 5. Subtrair do Central
      if (estoqueCentral) {
        const { error: updateCentralError } = await supabase
          .from('estoque_por_local')
          .update({ 
            quantidade: qtdCentral - quantidade,
            updated_at: new Date().toISOString()
          })
          .eq('id', estoqueCentral.id);

        if (updateCentralError) throw updateCentralError;
      }

      // 6. Adicionar na Loja destino
      const { data: existenteLoja } = await supabase
        .from('estoque_por_local')
        .select('id, quantidade')
        .eq('item_id', itemId)
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .maybeSingle();

      let estoqueAntesLoja = 0;

      if (existenteLoja) {
        estoqueAntesLoja = Number(existenteLoja.quantidade);
        const { error: updateLojaError } = await supabase
          .from('estoque_por_local')
          .update({ 
            quantidade: estoqueAntesLoja + quantidade,
            updated_at: new Date().toISOString()
          })
          .eq('id', existenteLoja.id);

        if (updateLojaError) throw updateLojaError;
      } else {
        const { error: insertLojaError } = await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: localId,
            quantidade: quantidade,
            quantidade_reservada: 0,
          });

        if (insertLojaError) throw insertLojaError;
      }

      // 7. Registrar movimentação de SAÍDA do Central
      const motivoTransferencia = motivo || `Transferência para ${nomeLocalDestino}`;
      
      const { error: movSaidaError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: itemId,
          local_id: localCentral.id,
          tipo: 'TRANSFERENCIA',
          quantidade: quantidade,
          motivo: motivoTransferencia,
          estoque_antes: qtdCentral,
          estoque_depois: qtdCentral - quantidade,
        });

      if (movSaidaError) throw movSaidaError;

      // 8. Registrar movimentação de ENTRADA na Loja
      const { error: movEntradaError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: itemId,
          local_id: localId,
          tipo: 'TRANSFERENCIA',
          quantidade: quantidade,
          motivo: `Transferência do Central`,
          estoque_antes: estoqueAntesLoja,
          estoque_depois: estoqueAntesLoja + quantidade,
        });

      if (movEntradaError) throw movEntradaError;

      return { quantidade };
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

      // 3. Buscar estoque no Central
      let estoqueCentralMap = new Map<string, number>();
      if (localCentral) {
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('item_id, quantidade')
          .eq('local_id', localCentral.id)
          .eq('user_id', user.id);

        estoqueCentralMap = new Map(
          (estoqueCentral || []).map(item => [item.item_id, Number(item.quantidade)])
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

      return (itens || []).map(item => ({
        id: item.id,
        nome: item.nome,
        codigo: item.categoria,
        imagemUrl: item.imagem_url,
        precoUnitario: item.preco_unitario,
        quantidadeCentral: estoqueCentralMap.get(item.id) || 0,
        quantidadeNoLocal: itensNoLocal.get(item.id) || 0,
        jaNoLocal: (itensNoLocal.get(item.id) || 0) > 0,
      }));
    },
    enabled: !!localId && !!user?.id,
  });
}
