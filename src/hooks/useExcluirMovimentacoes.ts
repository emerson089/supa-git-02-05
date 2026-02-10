import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface MovimentacaoParaExcluir {
  id: string;
  itemId: string;
  localId: string;
  quantidade: number;
  tipo: string;
}

// Tipos que representam saída de estoque (excluir = devolver ao estoque)
const TIPOS_SAIDA = ['AJUSTE_SAIDA', 'VENDA_FEIRA', 'ENVIO_FEIRA', 'TRANSFERENCIA', 'RETORNO_FEIRA'];
const TIPOS_ENTRADA = ['AJUSTE_ENTRADA'];

export function useExcluirMovimentacoes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movimentacoes: MovimentacaoParaExcluir[]) => {
      if (!user) throw new Error('Usuário não autenticado');
      if (movimentacoes.length === 0) throw new Error('Nenhuma movimentação selecionada');

      // Agrupar por item_id + local_id para batch updates
      const deltaMap = new Map<string, { itemId: string; localId: string; delta: number }>();

      for (const mov of movimentacoes) {
        const key = `${mov.itemId}__${mov.localId}`;
        const existing = deltaMap.get(key) || { itemId: mov.itemId, localId: mov.localId, delta: 0 };

        if (TIPOS_SAIDA.includes(mov.tipo)) {
          // Saída: reverter = somar de volta
          existing.delta += mov.quantidade;
        } else if (TIPOS_ENTRADA.includes(mov.tipo)) {
          // Entrada: reverter = subtrair
          existing.delta -= mov.quantidade;
        }

        deltaMap.set(key, existing);
      }

      // 1. Reverter estoque por local
      for (const { itemId, localId, delta } of deltaMap.values()) {
        if (delta === 0) continue;

        const { data: estoqueAtual } = await supabase
          .from('estoque_por_local')
          .select('id, quantidade')
          .eq('item_id', itemId)
          .eq('local_id', localId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (estoqueAtual) {
          const novaQuantidade = Math.max(0, estoqueAtual.quantidade + delta);
          const { error } = await supabase
            .from('estoque_por_local')
            .update({ quantidade: novaQuantidade, updated_at: new Date().toISOString() })
            .eq('id', estoqueAtual.id);

          if (error) throw error;
        }
      }

      // 2. Deletar movimentações
      const ids = movimentacoes.map(m => m.id);
      const { error } = await supabase
        .from('estoque_movimentacoes')
        .delete()
        .in('id', ids);

      if (error) throw error;

      return ids.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['relatorio-saidas'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-detalhado-por-local'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-desde-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-itens'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-por-local'] });
      toast.success(`${count} movimentação(ões) excluída(s) com sucesso!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });
}
