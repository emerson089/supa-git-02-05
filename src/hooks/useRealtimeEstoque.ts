import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook global para escutar mudanças em tempo real no estoque
 * e invalidar automaticamente as queries relacionadas.
 * 
 * Deve ser montado uma vez no topo da aplicação (App.tsx ou EstoqueProvider).
 */
export function useRealtimeEstoque() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const handleEstoqueChange = (payload: any) => {
      console.log('[Realtime] Estoque changed:', payload.table, payload.eventType);
      
      // Invalidação granular para economizar queries
      if (payload.eventType === 'UPDATE') {
        // Para UPDATE, apenas refetch queries atualmente ativas/montadas
        queryClient.invalidateQueries({ 
          queryKey: ['estoque-itens'],
          refetchType: 'active' // Apenas queries montadas
        });
        queryClient.invalidateQueries({ 
          queryKey: ['estoque-por-local'],
          refetchType: 'active'
        });
      } else {
        // INSERT/DELETE: invalidar tudo para garantir consistência
        queryClient.invalidateQueries({ 
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            ['estoque-por-local', 'estoque-detalhado-por-local', 
             'estoque-itens', 'produtos-disponiveis-adicionar'].includes(query.queryKey[0] as string)
        });
      }
    };

    const channel = supabase
      .channel('estoque-realtime')
      // Escutar estoque_por_local
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_por_local',
        },
        handleEstoqueChange
      )
      // Escutar estoque_itens (para exclusões, adições e edições)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_itens',
        },
        handleEstoqueChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from estoque-realtime');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
