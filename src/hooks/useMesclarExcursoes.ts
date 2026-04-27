import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MesclarParams {
  fonte: { id: string; nome: string; taxa: number };
  destino: { id: string; nome: string; taxa: number };
  copiarTaxa: boolean;
}

export function useMesclarExcursoes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fonte, destino, copiarTaxa }: MesclarParams) => {
      // 1. Atualizar clientes: campo excursao (TEXT) de fonte.nome → destino.nome
      const { count: clientesCount } = await supabase
        .from('clientes')
        .update({ excursao: destino.nome })
        .eq('excursao', fonte.nome)
        .select('*', { count: 'exact', head: true });

      // 2. Atualizar pedidos: campo excursao (TEXT) de fonte.nome → destino.nome
      await supabase
        .from('pedidos')
        .update({ excursao: destino.nome })
        .eq('excursao', fonte.nome);

      // 3. Atualizar pedidos: excursao_id (UUID FK) de fonte.id → destino.id
      const { count: pedidosCount } = await supabase
        .from('pedidos')
        .update({ excursao_id: destino.id })
        .eq('excursao_id', fonte.id)
        .select('*', { count: 'exact', head: true });

      // 4. Copiar taxa se necessário
      if (copiarTaxa && fonte.taxa > 0) {
        await supabase
          .from('excursoes')
          .update({ taxa: fonte.taxa })
          .eq('id', destino.id);
      }

      // 5. Deletar a excursão fonte
      const { error: deleteError } = await supabase
        .from('excursoes')
        .delete()
        .eq('id', fonte.id);

      if (deleteError) throw deleteError;

      return {
        clientesAtualizados: clientesCount ?? 0,
        pedidosAtualizados: pedidosCount ?? 0,
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
      queryClient.invalidateQueries({ queryKey: ['clientes'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}
