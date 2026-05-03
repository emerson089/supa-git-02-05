import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { sincronizarEstoqueTotal } from './useTransferencias';

interface ItemCorrecao {
  itemId: string;
  novaQuantidadeRetornada: number;
  quantidadeEnviadaOriginal: number;
  quantidadeRetornadaAnterior: number;
}

export interface ItemAdicionado {
  itemId: string;
  nome: string;
  precoUnitario: number;
  quantidadeEnviada: number;
  quantidadeRetornada: number;
  imagemUrl?: string | null;
}

interface EditarRetornoParams {
  transferenciaId: string;
  itensCorrigidos: ItemCorrecao[];
  itensAdicionados?: ItemAdicionado[];
  motivo: string;
}

interface EditarRetornoResult {
  cargaId: string;
  itensAjustados: number;
  deltaTotal: number;
}

/**
 * Hook para editar/corrigir os valores de retorno de uma carga já concluída.
 * 
 * Lógica de delta:
 * - delta = novoRetorno - retornoAntigo
 * - Se delta > 0: mais itens retornaram (Central += delta)
 * - Se delta < 0: menos itens retornaram (Central -= |delta|)
 * 
 * Movimentações registradas: AJUSTE_RETORNO_FEIRA
 */
export function useEditarRetornoCarga() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      transferenciaId,
      itensCorrigidos,
      itensAdicionados = [],
      motivo,
    }: EditarRetornoParams): Promise<EditarRetornoResult> => {
      console.log('[useEditarRetornoCarga] Iniciando correção:', {
        transferenciaId,
        itensCorrigidos: itensCorrigidos.length,
        itensAdicionados: itensAdicionados.length,
        motivo,
      });

      if (!user) throw new Error('Usuário não autenticado');
      if (!motivo.trim()) throw new Error('Motivo da correção é obrigatório');

      // 1. Buscar a carga
      const { data: carga, error: cargaError } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (*)
        `)
        .eq('id', transferenciaId)
        .single();

      if (cargaError || !carga) throw new Error('Carga não encontrada');
      if (carga.deleted_at) throw new Error('Esta carga foi excluída');
      if (carga.status !== 'concluida') {
        throw new Error('Apenas cargas concluídas podem ter o retorno corrigido');
      }

      // 2. Buscar local Central
      const { data: locais } = await supabase
        .from('estoque_locais')
        .select('*')
        .eq('tipo', 'central');

      const central = locais?.[0];
      if (!central) throw new Error('Local Central não encontrado');

      let itensAjustados = 0;
      let deltaTotal = 0;

      // 3. Processar cada item corrigido
      for (const itemCorrecao of itensCorrigidos) {
        const { itemId, novaQuantidadeRetornada, quantidadeRetornadaAnterior, quantidadeEnviadaOriginal } = itemCorrecao;

        // Validar: retorno não pode exceder enviado
        if (novaQuantidadeRetornada > quantidadeEnviadaOriginal) {
          throw new Error(`Retorno não pode exceder quantidade enviada (${quantidadeEnviadaOriginal})`);
        }
        if (novaQuantidadeRetornada < 0) {
          throw new Error('Quantidade retornada não pode ser negativa');
        }

        // Calcular delta
        const delta = novaQuantidadeRetornada - quantidadeRetornadaAnterior;

        // Se não houve mudança, pular
        if (delta === 0) continue;

        // 4. Buscar estoque atual do Central
        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', itemId)
          .eq('local_id', central.id)
          .single();

        if (!estoqueCentral) {
          throw new Error(`Estoque não encontrado para item ${itemId}`);
        }

        const estoqueAntes = Number(estoqueCentral.quantidade) || 0;
        const estoqueDepois = estoqueAntes + delta;

        // Validar: Central não pode ficar negativo
        if (estoqueDepois < 0) {
          const { data: itemInfo } = await supabase
            .from('estoque_itens')
            .select('nome')
            .eq('id', itemId)
            .single();

          throw new Error(
            `Correção inválida para "${itemInfo?.nome || 'Item'}": Central ficaria com ${estoqueDepois} (negativo)`
          );
        }

        // 5. Atualizar estoque Central
        const { error: updateEstoqueError } = await supabase
          .from('estoque_por_local')
          .update({
            quantidade: estoqueDepois,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estoqueCentral.id);

        if (updateEstoqueError) throw updateEstoqueError;

        // 6. Registrar movimentação de auditoria
        const { error: movError } = await supabase
          .from('estoque_movimentacoes')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: central.id,
            tipo: 'AJUSTE_RETORNO_FEIRA',
            quantidade: Math.abs(delta),
            motivo: `Correção de retorno - Carga #${transferenciaId.slice(0, 8)} - ${motivo}`,
            estoque_antes: estoqueAntes,
            estoque_depois: estoqueDepois,
            transferencia_id: transferenciaId,
          });

        if (movError) {
          console.error('[useEditarRetornoCarga] Erro ao registrar movimentação:', movError);
          // Continuar mesmo com erro de auditoria
        }

        // 7. Atualizar transferencia_itens com novo valor de retorno
        const { error: updateItemError } = await supabase
          .from('transferencia_itens')
          .update({
            quantidade_retornada: novaQuantidadeRetornada,
          })
          .eq('transferencia_id', transferenciaId)
          .eq('item_id', itemId);

        if (updateItemError) throw updateItemError;

        // 8. Sincronizar estoque_itens.quantidade
        await sincronizarEstoqueTotal(itemId, user.id);

        itensAjustados++;
        deltaTotal += delta;
      }

      // PROCESSAMENTO DE ITENS NOVIDADE (ESQUECIDOS)
      for (const itemNovo of itensAdicionados) {
        const { itemId, nome, quantidadeEnviada, quantidadeRetornada, precoUnitario, imagemUrl } = itemNovo;

        if (quantidadeRetornada > quantidadeEnviada) {
          throw new Error(`Item ${nome}: Retorno (${quantidadeRetornada}) não pode exceder enviado (${quantidadeEnviada})`);
        }
        if (quantidadeRetornada < 0 || quantidadeEnviada <= 0) {
          throw new Error(`Item ${nome}: Quantidades inválidas`);
        }

        // O delta para a Central é a diferença líquida entre o que voltou e o que saiu
        // Ex: Saiu 10, Voltou 3 => Delta Central = -7 (vendeu 7)
        const deltaCentralItem = quantidadeRetornada - quantidadeEnviada;

        const { data: estoqueCentral } = await supabase
          .from('estoque_por_local')
          .select('*')
          .eq('item_id', itemId)
          .eq('local_id', central.id)
          .single();

        if (!estoqueCentral) {
          throw new Error(`Estoque da Central não encontrado para o novo item ${nome}`);
        }

        const estoqueAntes = Number(estoqueCentral.quantidade) || 0;
        const estoqueDepois = estoqueAntes + deltaCentralItem;

        if (estoqueDepois < 0) {
          throw new Error(`Inclusão retroativa inválida para "${nome}": Central ficaria negativa (${estoqueDepois})`);
        }

        // Adiciona à transferência original retroativamente
        const { error: insertItemError } = await supabase
          .from('transferencia_itens')
          .insert({
            user_id: user.id,
            transferencia_id: transferenciaId,
            item_id: itemId,
            quantidade_enviada: quantidadeEnviada,
            quantidade_retornada: quantidadeRetornada,
            preco_unitario: precoUnitario,
            nome_produto: nome,
            imagem_url_produto: imagemUrl || null,
          });

        if (insertItemError) throw insertItemError;

        // Atualiza estoque Central com o delta (Dedução das vendas diretas)
        const { error: updateEstoqueError } = await supabase
          .from('estoque_por_local')
          .update({
            quantidade: estoqueDepois,
            updated_at: new Date().toISOString(),
          })
          .eq('id', estoqueCentral.id);

        if (updateEstoqueError) throw updateEstoqueError;

        // Adiciona movimentação de ajuste retroativo
        const { error: movError } = await supabase
          .from('estoque_movimentacoes')
          .insert({
            user_id: user.id,
            item_id: itemId,
            local_id: central.id,
            tipo: 'AJUSTE_RETORNO_FEIRA',
            quantidade: Math.abs(deltaCentralItem),
            motivo: `Inclusão retroativa - Carga #${transferenciaId.slice(0, 8)} - ${motivo}`,
            estoque_antes: estoqueAntes,
            estoque_depois: estoqueDepois,
            transferencia_id: transferenciaId,
          });

        if (movError) {
          console.error('[useEditarRetornoCarga] Erro ao registrar mov. de item esquecido:', movError);
        }

        await sincronizarEstoqueTotal(itemId, user.id);

        itensAjustados++;
        deltaTotal += deltaCentralItem;
      }

      if (itensAjustados === 0) {
        throw new Error('Nenhum item foi alterado ou adicionado');
      }

      console.log('[useEditarRetornoCarga] Correção concluída:', {
        cargaId: transferenciaId,
        itensAjustados,
        deltaTotal,
      });

      return {
        cargaId: transferenciaId,
        itensAjustados,
        deltaTotal,
      };
    },
    onSuccess: () => {
      // Invalidar queries para atualizar UI
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
    },
  });
}
