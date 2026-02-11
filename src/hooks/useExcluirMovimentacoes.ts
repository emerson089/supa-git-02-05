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
      queryClient.invalidateQueries({ queryKey: ['vendas-desde-contagem'] });
      toast.success(`${count} movimentação(ões) excluída(s) com sucesso!`);
    },
    onError: (error: any) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });
}
