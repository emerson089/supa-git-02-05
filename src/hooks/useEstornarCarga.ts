import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sincronizarEstoqueTotal } from './useTransferencias';

/**
 * Hook para ESTORNAR cargas concluídas
 * 
 * Diferente de excluir:
 * - Cargas concluídas NÃO podem ser excluídas (já geraram venda)
 * - O estorno REVERTE a venda: produtos vendidos voltam ao Central
 * - Registra movimentação ESTORNO_FEIRA para auditoria
 * - Muda status para 'estornada'
 */
export function useEstornarCarga() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      motivo,
    }: {
      transferenciaId: string;
      motivo: string;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (!motivo?.trim()) throw new Error('Motivo é obrigatório para estorno');

      // 1. Buscar a carga com itens
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (*)
        `)
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');
      if (carga.deleted_at) throw new Error('Esta carga já foi excluída');
      if (carga.status !== 'concluida') throw new Error('Apenas cargas concluídas podem ser estornadas');

      // 2. Buscar locais
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('*')
        .eq('user_id', user.id)
        .in('tipo', ['central', 'banca']);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) throw new Error('Locais Central/Banca não configurados');

      // 3. OTIMIZADO: Calcular itens com venda para estornar
      const itensComVenda = carga.transferencia_itens
        .map(item => ({
          item_id: item.item_id,
          enviado: Number(item.quantidade_enviada) || 0,
          retornado: Number(item.quantidade_retornada) || 0,
          vendido: (Number(item.quantidade_enviada) || 0) - (Number(item.quantidade_retornada) || 0),
        }))
        .filter(item => item.vendido > 0);

      if (itensComVenda.length > 0) {
        const itemIds = itensComVenda.map(i => i.item_id);

        // OTIMIZADO: Buscar todos os estoques do Central de uma vez
        const { data: estoquesCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .in('item_id', itemIds)
          .eq('local_id', central.id);

        const mapEstoques = new Map<string, { id: string; quantidade: number }>();
        estoquesCentral?.forEach(e => {
          mapEstoques.set(e.item_id, { id: e.id, quantidade: Number(e.quantidade) });
        });

        // OTIMIZADO: Registrar todas as movimentações em lote
        const movimentacoes = itensComVenda.map(item => {
          const estoque = mapEstoques.get(item.item_id);
          const quantidadeAntes = estoque?.quantidade || 0;
          return {
            user_id: user.id,
            item_id: item.item_id,
            tipo: 'ESTORNO_FEIRA',
            quantidade: item.vendido,
            motivo: `Estorno de venda - Carga #${transferenciaId.slice(0, 8)} - ${motivo}`,
            transferencia_id: transferenciaId,
            local_id: central.id,
            estoque_antes: quantidadeAntes,
            estoque_depois: quantidadeAntes + item.vendido,
          };
        });

        const { error: movError } = await supabase
          .from('estoque_movimentacoes')
          .insert(movimentacoes);

        if (movError) {
          console.error('[useEstornarCarga] Erro ao registrar ESTORNO_FEIRA:', movError);
          throw new Error(`Falha ao registrar movimentação de estorno: ${movError.message}`);
        }

        // OTIMIZADO: Atualizar estoques em paralelo
        const updatePromises = itensComVenda.map(async (item) => {
          const estoque = mapEstoques.get(item.item_id);
          
          if (estoque) {
            const { error: updateError } = await supabase
              .from('estoque_por_local')
              .update({
                quantidade: estoque.quantidade + item.vendido,
                updated_at: new Date().toISOString(),
              })
              .eq('id', estoque.id);

            if (updateError) {
              console.error('[useEstornarCarga] Erro ao atualizar estoque Central:', updateError);
              throw new Error(`Erro ao atualizar estoque: ${updateError.message}`);
            }
          } else {
            // Criar registro se não existir
            await supabase.from('estoque_por_local').insert({
              user_id: user.id,
              item_id: item.item_id,
              local_id: central.id,
              quantidade: item.vendido,
              quantidade_reservada: 0,
            });
          }
        });

        await Promise.all(updatePromises);

        // OTIMIZADO: Sincronizar todos os estoques em paralelo
        await Promise.all(itensComVenda.map(item => sincronizarEstoqueTotal(item.item_id, user.id)));
      }

      // 4. Marcar transferência como estornada
      const { error: updateError } = await supabase
        .from('transferencias')
        .update({
          status: 'estornada',
          observacoes: `${carga.observacoes || ''}\n[ESTORNO] ${new Date().toISOString()}: ${motivo}`.trim(),
        })
        .eq('id', transferenciaId);

      if (updateError) throw updateError;

      // Buscar nome do primeiro item para mensagem
      const { data: primeiroItem } = await supabase
        .from('estoque_itens')
        .select('nome')
        .eq('id', carga.transferencia_itens[0]?.item_id)
        .single();

      return {
        cargaId: transferenciaId,
        itensEstornados: carga.transferencia_itens.length,
        primeiroItemNome: primeiroItem?.nome || 'Item',
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}
