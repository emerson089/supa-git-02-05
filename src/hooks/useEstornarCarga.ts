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

      // 3. Para cada item, reverter a venda (adicionar vendido de volta ao Central)
      for (const item of carga.transferencia_itens) {
        const enviado = Number(item.quantidade_enviada) || 0;
        const retornado = Number(item.quantidade_retornada) || 0;
        const vendido = enviado - retornado;

        // Só precisa estornar se houve venda
        if (vendido > 0) {
          // Buscar estoque atual do Central
          const { data: estoqueCentral } = await supabase
            .from('estoque_por_local')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('local_id', central.id)
            .single();

          const quantidadeAntes = estoqueCentral ? Number(estoqueCentral.quantidade) : 0;
          const quantidadeDepois = quantidadeAntes + vendido;

          // Adicionar vendido de volta ao Central
          if (estoqueCentral) {
            const { error: updateError } = await supabase
              .from('estoque_por_local')
              .update({
                quantidade: quantidadeDepois,
                updated_at: new Date().toISOString(),
              })
              .eq('id', estoqueCentral.id);

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
              quantidade: vendido,
              quantidade_reservada: 0,
            });
          }

          // Registrar movimentação ESTORNO_FEIRA
          const { error: movError } = await supabase.from('estoque_movimentacoes').insert({
            user_id: user.id,
            item_id: item.item_id,
            tipo: 'ESTORNO_FEIRA',
            quantidade: vendido,
            motivo: `Estorno de venda - Carga #${transferenciaId.slice(0, 8)} - ${motivo}`,
            transferencia_id: transferenciaId,
            local_id: central.id,
            estoque_antes: quantidadeAntes,
            estoque_depois: quantidadeDepois,
          });

          if (movError) {
            console.error('[useEstornarCarga] Erro ao registrar ESTORNO_FEIRA:', movError);
            throw new Error(`Falha ao registrar movimentação de estorno: ${movError.message}`);
          }

          // Sincronizar estoque_itens.quantidade
          await sincronizarEstoqueTotal(item.item_id, user.id);
        }
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
