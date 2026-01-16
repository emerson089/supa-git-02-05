import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecalculoResult {
  itensProcessados: number;
  transferenciasProcessadas: number;
  movimentacoesCriadas: number;
}

/**
 * Hook para recalcular estoque do zero
 * 
 * Operação ADMIN que:
 * 1. Limpa estoque_por_local e reinicializa com estoque_itens.quantidade (Central)
 * 2. Percorre TODAS as transferências em ordem cronológica
 * 3. Aplica cada operação e recria registros de auditoria em estoque_movimentacoes
 * 4. Sincroniza estoque_itens.quantidade = Central
 */
export function useRecalcularEstoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<RecalculoResult> => {
      if (!user) throw new Error('Usuário não autenticado');

      console.log('[useRecalcularEstoque] Iniciando recálculo completo de estoque...');

      // 1. Buscar locais do usuário
      const { data: locais, error: locaisError } = await supabase
        .from('estoque_locais')
        .select('*')
        .eq('user_id', user.id);

      if (locaisError) throw new Error(`Erro ao buscar locais: ${locaisError.message}`);

      const central = locais?.find(l => l.tipo === 'central');
      const banca = locais?.find(l => l.tipo === 'banca');

      if (!central || !banca) {
        throw new Error('Locais Central e Banca não encontrados. Configure os locais primeiro.');
      }

      // 2. Buscar todos os itens de estoque do usuário
      const { data: itens, error: itensError } = await supabase
        .from('estoque_itens')
        .select('*')
        .eq('user_id', user.id);

      if (itensError) throw new Error(`Erro ao buscar itens: ${itensError.message}`);

      console.log(`[useRecalcularEstoque] ${itens?.length || 0} itens encontrados`);

      // 3. Limpar estoque_movimentacoes do usuário (para recriar do zero)
      const { error: delMovError } = await supabase
        .from('estoque_movimentacoes')
        .delete()
        .eq('user_id', user.id);

      if (delMovError) {
        console.error('[useRecalcularEstoque] Erro ao limpar movimentações:', delMovError);
        throw new Error(`Erro ao limpar movimentações: ${delMovError.message}`);
      }

      // 4. Limpar estoque_por_local do usuário
      const { error: delEstoqueError } = await supabase
        .from('estoque_por_local')
        .delete()
        .eq('user_id', user.id);

      if (delEstoqueError) {
        console.error('[useRecalcularEstoque] Erro ao limpar estoque_por_local:', delEstoqueError);
        throw new Error(`Erro ao limpar estoque: ${delEstoqueError.message}`);
      }

      // 5. Recalcular quantidade original de cada item (antes de qualquer transferência)
      // Precisamos saber o estoque "original" de cada item
      // Como não temos histórico, vamos usar a quantidade atual + vendas realizadas
      
      // 5a. Buscar TODAS as transferências do usuário (ordenadas cronologicamente)
      const { data: transferencias, error: transError } = await supabase
        .from('transferencias')
        .select(`
          *,
          transferencia_itens (*)
        `)
        .eq('user_id', user.id)
        .eq('tipo', 'carga_feira')
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (transError) throw new Error(`Erro ao buscar transferências: ${transError.message}`);

      console.log(`[useRecalcularEstoque] ${transferencias?.length || 0} transferências encontradas`);

      // 5b. Calcular estoque original (quantidade atual + vendas)
      const estoqueOriginal: Record<string, number> = {};
      
      for (const item of itens || []) {
        estoqueOriginal[item.id] = Number(item.quantidade) || 0;
      }

      // Somar vendas de transferências concluídas ao estoque original
      for (const t of transferencias || []) {
        if (t.status === 'concluida') {
          for (const ti of t.transferencia_itens || []) {
            const enviado = Number(ti.quantidade_enviada) || 0;
            const retornado = Number(ti.quantidade_retornada) || 0;
            const vendido = enviado - retornado;
            
            if (estoqueOriginal[ti.item_id] !== undefined) {
              estoqueOriginal[ti.item_id] += vendido;
            }
          }
        }
        // Para transferências em andamento, somar o que está na banca
        if (t.status === 'em_andamento') {
          for (const ti of t.transferencia_itens || []) {
            const enviado = Number(ti.quantidade_enviada) || 0;
            
            if (estoqueOriginal[ti.item_id] !== undefined) {
              estoqueOriginal[ti.item_id] += enviado;
            }
          }
        }
      }

      // 6. Inicializar estoque_por_local com estoque original (tudo no Central, Banca = 0)
      const estoqueAtual: Record<string, { central: number; banca: number }> = {};
      
      for (const item of itens || []) {
        estoqueAtual[item.id] = {
          central: estoqueOriginal[item.id] || 0,
          banca: 0,
        };

        // Inserir registro inicial no Central
        const { error: insertCentralError } = await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: item.id,
            local_id: central.id,
            quantidade: estoqueAtual[item.id].central,
            quantidade_reservada: 0,
          });

        if (insertCentralError) {
          console.error(`[useRecalcularEstoque] Erro ao inserir Central para ${item.nome}:`, insertCentralError);
        }

        // Inserir registro inicial na Banca (zerado)
        const { error: insertBancaError } = await supabase
          .from('estoque_por_local')
          .insert({
            user_id: user.id,
            item_id: item.id,
            local_id: banca.id,
            quantidade: 0,
            quantidade_reservada: 0,
          });

        if (insertBancaError) {
          console.error(`[useRecalcularEstoque] Erro ao inserir Banca para ${item.nome}:`, insertBancaError);
        }
      }

      let movimentacoesCriadas = 0;

      // 7. Aplicar cada transferência em ordem cronológica
      for (const t of transferencias || []) {
        for (const ti of t.transferencia_itens || []) {
          const itemId = ti.item_id;
          const enviado = Number(ti.quantidade_enviada) || 0;
          const retornado = Number(ti.quantidade_retornada) || 0;
          const vendido = enviado - retornado;

          if (!estoqueAtual[itemId]) {
            console.warn(`[useRecalcularEstoque] Item ${itemId} não encontrado no estoque`);
            continue;
          }

          // 7a. Registrar ENVIO_FEIRA
          const centralAntes = estoqueAtual[itemId].central;
          estoqueAtual[itemId].central -= enviado;
          estoqueAtual[itemId].banca += enviado;

          const { error: movEnvioError } = await supabase
            .from('estoque_movimentacoes')
            .insert({
              user_id: user.id,
              item_id: itemId,
              tipo: 'ENVIO_FEIRA',
              quantidade: enviado,
              motivo: `[RECALCULO] Envio para feira - Carga #${t.id.slice(0, 8)}`,
              transferencia_id: t.id,
              local_id: central.id,
              estoque_antes: centralAntes,
              estoque_depois: estoqueAtual[itemId].central,
              created_at: t.data_saida || t.created_at,
            });

          if (movEnvioError) {
            console.error('[useRecalcularEstoque] Erro ao criar ENVIO_FEIRA:', movEnvioError);
          } else {
            movimentacoesCriadas++;
          }

          // 7b. Se carga concluída, registrar RETORNO e VENDA
          if (t.status === 'concluida') {
            // RETORNO_FEIRA
            if (retornado > 0) {
              const centralAntesRetorno = estoqueAtual[itemId].central;
              estoqueAtual[itemId].central += retornado;
              estoqueAtual[itemId].banca -= retornado;

              const { error: movRetornoError } = await supabase
                .from('estoque_movimentacoes')
                .insert({
                  user_id: user.id,
                  item_id: itemId,
                  tipo: 'RETORNO_FEIRA',
                  quantidade: retornado,
                  motivo: `[RECALCULO] Retorno da feira - Carga #${t.id.slice(0, 8)}`,
                  transferencia_id: t.id,
                  local_id: central.id,
                  estoque_antes: centralAntesRetorno,
                  estoque_depois: estoqueAtual[itemId].central,
                  created_at: t.data_retorno || t.created_at,
                });

              if (movRetornoError) {
                console.error('[useRecalcularEstoque] Erro ao criar RETORNO_FEIRA:', movRetornoError);
              } else {
                movimentacoesCriadas++;
              }
            }

            // VENDA_FEIRA
            if (vendido > 0) {
              const bancaAntesVenda = estoqueAtual[itemId].banca;
              estoqueAtual[itemId].banca -= vendido;

              const { error: movVendaError } = await supabase
                .from('estoque_movimentacoes')
                .insert({
                  user_id: user.id,
                  item_id: itemId,
                  tipo: 'VENDA_FEIRA',
                  quantidade: vendido,
                  motivo: `[RECALCULO] Venda na feira - Carga #${t.id.slice(0, 8)}`,
                  transferencia_id: t.id,
                  local_id: banca.id,
                  estoque_antes: bancaAntesVenda,
                  estoque_depois: estoqueAtual[itemId].banca,
                  created_at: t.data_retorno || t.created_at,
                });

              if (movVendaError) {
                console.error('[useRecalcularEstoque] Erro ao criar VENDA_FEIRA:', movVendaError);
              } else {
                movimentacoesCriadas++;
              }
            }
          }
        }
      }

      // 8. Atualizar estoque_por_local com valores finais calculados
      for (const itemId of Object.keys(estoqueAtual)) {
        // Atualizar Central
        await supabase
          .from('estoque_por_local')
          .update({
            quantidade: Math.max(0, estoqueAtual[itemId].central),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .eq('local_id', central.id);

        // Atualizar Banca
        await supabase
          .from('estoque_por_local')
          .update({
            quantidade: Math.max(0, estoqueAtual[itemId].banca),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('item_id', itemId)
          .eq('local_id', banca.id);

        // Sincronizar estoque_itens.quantidade = Central
        await supabase
          .from('estoque_itens')
          .update({
            quantidade: Math.max(0, estoqueAtual[itemId].central),
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId);
      }

      console.log('[useRecalcularEstoque] Recálculo concluído!');
      console.log(`  - Itens: ${itens?.length || 0}`);
      console.log(`  - Transferências: ${transferencias?.length || 0}`);
      console.log(`  - Movimentações criadas: ${movimentacoesCriadas}`);

      return {
        itensProcessados: itens?.length || 0,
        transferenciasProcessadas: transferencias?.length || 0,
        movimentacoesCriadas,
      };
    },
    onSuccess: () => {
      // Invalidar todas as queries de estoque
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-locais'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-periodo'] });
      queryClient.invalidateQueries({ queryKey: ['todas-cargas-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['cargas-hoje'] });
      queryClient.invalidateQueries({ queryKey: ['transferencias'] });
    },
  });
}
