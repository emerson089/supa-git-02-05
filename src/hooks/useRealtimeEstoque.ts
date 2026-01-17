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

    const channel = supabase
      .channel('estoque-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estoque_por_local',
        },
        (payload) => {
          console.log('[Realtime] estoque_por_local changed:', payload.eventType);
          
          // Invalidar todas as queries de estoque para garantir dados atualizados
          queryClient.invalidateQueries({ 
            predicate: (query) => 
              Array.isArray(query.queryKey) && 
              (query.queryKey[0] === 'estoque-por-local' || 
               query.queryKey[0] === 'estoque-detalhado-por-local' ||
               query.queryKey[0] === 'estoque-itens' ||
               query.queryKey[0] === 'produtos-disponiveis-adicionar'),
            refetchType: 'all'
          });
        }
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
