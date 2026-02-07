import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EnviarParaEstoqueParams {
  loteId: string;
  loteIdProducao: string;
  modeloNome: string;
  quantidade: number;
  imagemUrl?: string;
  precoVenda: number;
  custoUnitario: number;
  custoTotal: number;
}

interface PreviewCustoMedio {
  produtoExistente: boolean;
  produtoNome: string;
  estoqueAtualQty: number;
  estoqueAtualCustoMedio: number | null;
  qtdComCustoAtual: number;
  loteQty: number;
  loteCustoUnitario: number;
  novoCustoMedio: number;
  novaQtdComCusto: number;
  novoEstoqueTotal: number;
}

export function useEnviarParaEstoque() {
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewCustoMedio | null>(null);

  const calcularPreview = async (params: {
    modeloNome: string;
    quantidade: number;
    custoUnitario: number;
  }): Promise<PreviewCustoMedio | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Buscar produto existente por nome (case-insensitive)
      const { data: produtoExistente } = await supabase
        .from('estoque_itens')
        .select('id, nome, quantidade, custo_medio, qtd_com_custo')
        .eq('tipo', 'acabado')
        .ilike('nome', params.modeloNome)
        .maybeSingle();

      const estoqueAtualQty = produtoExistente ? Number(produtoExistente.quantidade) : 0;
      const estoqueAtualCustoMedio = produtoExistente?.custo_medio != null 
        ? Number(produtoExistente.custo_medio) 
        : null;
      const qtdComCustoAtual = produtoExistente?.qtd_com_custo 
        ? Number(produtoExistente.qtd_com_custo) 
        : 0;

      // Calcular novo custo médio ponderado
      let novoCustoMedio: number;
      if (qtdComCustoAtual === 0 || estoqueAtualCustoMedio === null) {
        // Primeira entrada com custo conhecido
        novoCustoMedio = params.custoUnitario;
      } else {
        // Média ponderada
        novoCustoMedio = (qtdComCustoAtual * estoqueAtualCustoMedio + params.quantidade * params.custoUnitario) 
          / (qtdComCustoAtual + params.quantidade);
      }

      const novaQtdComCusto = qtdComCustoAtual + params.quantidade;
      const novoEstoqueTotal = estoqueAtualQty + params.quantidade;

      return {
        produtoExistente: !!produtoExistente,
        produtoNome: produtoExistente?.nome || params.modeloNome,
        estoqueAtualQty,
        estoqueAtualCustoMedio,
        qtdComCustoAtual,
        loteQty: params.quantidade,
        loteCustoUnitario: params.custoUnitario,
        novoCustoMedio,
        novaQtdComCusto,
        novoEstoqueTotal,
      };
    } catch (error) {
      console.error('[calcularPreview] Erro:', error);
      return null;
    }
  };

  const verificarJaEnviado = async (loteId: string): Promise<{
    jaEnviado: boolean;
    dataEnvio?: string;
    integradoSemCusto?: boolean;
  }> => {
    try {
      // Verificar pelo campo posted_to_stock_at
      const { data: lote } = await supabase
        .from('producao')
        .select('posted_to_stock_at, integrado_estoque')
        .eq('id', loteId)
        .maybeSingle();

      if (lote?.posted_to_stock_at) {
        return { jaEnviado: true, dataEnvio: lote.posted_to_stock_at };
      }

      // Verificar se integrado_estoque = true mas sem posted_to_stock_at (antigo)
      if (lote?.integrado_estoque && !lote?.posted_to_stock_at) {
        return { jaEnviado: false, integradoSemCusto: true };
      }

      // Verificar idempotência por movimentação
      const { data: movExistente } = await supabase
        .from('estoque_movimentacoes')
        .select('id')
        .eq('source_type', 'LOT')
        .eq('source_id', loteId)
        .maybeSingle();

      if (movExistente) {
        return { jaEnviado: true };
      }

      return { jaEnviado: false };
    } catch (error) {
      console.error('[verificarJaEnviado] Erro:', error);
      return { jaEnviado: false };
    }
  };

  const enviarParaEstoque = async (params: EnviarParaEstoqueParams): Promise<boolean> => {
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return false;
      }

      // 1. Verificar idempotência
      const { jaEnviado, dataEnvio } = await verificarJaEnviado(params.loteId);
      if (jaEnviado) {
        const msg = dataEnvio 
          ? `Lote já enviado ao estoque em ${new Date(dataEnvio).toLocaleDateString('pt-BR')}`
          : 'Lote já enviado ao estoque';
        toast.error(msg);
        return false;
      }

      // 2. Buscar/criar produto no estoque
      let produtoId: string;
      let estoqueAtualQty = 0;
      let estoqueAtualCustoMedio: number | null = null;
      let qtdComCustoAtual = 0;

      const { data: produtoExistente } = await supabase
        .from('estoque_itens')
        .select('id, quantidade, custo_medio, qtd_com_custo')
        .eq('tipo', 'acabado')
        .ilike('nome', params.modeloNome)
        .maybeSingle();

      if (produtoExistente) {
        produtoId = produtoExistente.id;
        estoqueAtualQty = Number(produtoExistente.quantidade);
        estoqueAtualCustoMedio = produtoExistente.custo_medio != null 
          ? Number(produtoExistente.custo_medio) 
          : null;
        qtdComCustoAtual = produtoExistente.qtd_com_custo 
          ? Number(produtoExistente.qtd_com_custo) 
          : 0;
      } else {
        // Criar novo produto
        const { data: novoProduto, error: createError } = await supabase
          .from('estoque_itens')
          .insert({
            user_id: user.id,
            nome: params.modeloNome,
            tipo: 'acabado',
            categoria: 'Jeans',
            quantidade: 0,
            unidade: 'peças',
            quantidade_minima: 0,
            preco_unitario: params.precoVenda,
            localizacao: 'Estoque Produção',
            imagem_url: params.imagemUrl || null,
            custo_medio: null,
            qtd_com_custo: 0,
          })
          .select('id')
          .single();

        if (createError || !novoProduto) {
          throw new Error('Erro ao criar produto no estoque');
        }

        produtoId = novoProduto.id;

        // Criar entrada no estoque_por_local para o Central
        const { data: localCentral } = await supabase
          .from('estoque_locais')
          .select('id')
          .eq('user_id', user.id)
          .eq('tipo', 'central')
          .maybeSingle();

        if (localCentral) {
          await supabase
            .from('estoque_por_local')
            .insert({
              user_id: user.id,
              item_id: produtoId,
              local_id: localCentral.id,
              quantidade: 0,
              quantidade_reservada: 0,
            });
        }
      }

      // 3. Calcular novo custo médio ponderado
      let novoCustoMedio: number;
      if (qtdComCustoAtual === 0 || estoqueAtualCustoMedio === null) {
        novoCustoMedio = params.custoUnitario;
      } else {
        novoCustoMedio = (qtdComCustoAtual * estoqueAtualCustoMedio + params.quantidade * params.custoUnitario) 
          / (qtdComCustoAtual + params.quantidade);
      }

      const novaQtdComCusto = qtdComCustoAtual + params.quantidade;
      const novoEstoqueTotal = estoqueAtualQty + params.quantidade;

      // 4. Atualizar estoque_itens
      const { error: updateError } = await supabase
        .from('estoque_itens')
        .update({
          quantidade: novoEstoqueTotal,
          custo_medio: novoCustoMedio,
          qtd_com_custo: novaQtdComCusto,
          imagem_url: params.imagemUrl || undefined,
          preco_unitario: params.precoVenda || undefined,
        })
        .eq('id', produtoId);

      if (updateError) {
        throw new Error('Erro ao atualizar estoque');
      }

      // 5. Sincronizar com estoque_por_local (Central)
      const { data: localCentral } = await supabase
        .from('estoque_locais')
        .select('id')
        .eq('user_id', user.id)
        .eq('tipo', 'central')
        .maybeSingle();

      if (localCentral) {
        const { data: estoquePorLocal } = await supabase
          .from('estoque_por_local')
          .select('id, quantidade')
          .eq('item_id', produtoId)
          .eq('local_id', localCentral.id)
          .maybeSingle();

        if (estoquePorLocal) {
          await supabase
            .from('estoque_por_local')
            .update({ 
              quantidade: novoEstoqueTotal,
              updated_at: new Date().toISOString() 
            })
            .eq('id', estoquePorLocal.id);
        }
      }

      // 6. Registrar movimentação de entrada
      const { error: movError } = await supabase
        .from('estoque_movimentacoes')
        .insert({
          user_id: user.id,
          item_id: produtoId,
          tipo: 'entrada',
          quantidade: params.quantidade,
          motivo: `Entrada via Produção - Lote #${params.loteIdProducao}`,
          producao_id: params.loteId,
          custo_aplicado: params.custoUnitario,
          source_type: 'LOT',
          source_id: params.loteId,
          estoque_antes: estoqueAtualQty,
          estoque_depois: novoEstoqueTotal,
        });

      if (movError) {
        console.error('[enviarParaEstoque] Erro ao registrar movimentação:', movError);
      }

      // 7. Marcar lote como enviado
      const { error: loteError } = await supabase
        .from('producao')
        .update({
          posted_to_stock_at: new Date().toISOString(),
          unit_cost: params.custoUnitario,
          total_cost: params.custoTotal,
          integrado_estoque: true,
        })
        .eq('id', params.loteId);

      if (loteError) {
        throw new Error('Erro ao atualizar lote');
      }

      toast.success(
        `${params.quantidade} peças adicionadas ao estoque! Custo médio: R$ ${novoCustoMedio.toFixed(2)}`
      );

      return true;
    } catch (error: any) {
      console.error('[enviarParaEstoque] Erro:', error);
      toast.error(error.message || 'Erro ao enviar para estoque');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    enviarParaEstoque,
    calcularPreview,
    verificarJaEnviado,
    isLoading,
    preview,
    setPreview,
  };
}
