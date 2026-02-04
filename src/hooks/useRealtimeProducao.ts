import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook global para escutar mudanças em tempo real na produção
 * e invalidar automaticamente as queries relacionadas.
 * 
 * Usa invalidação granular para economizar créditos:
 * - refetchType: 'active' só recarrega queries de componentes visíveis
 * - Canal único para ambas as tabelas (producao + producao_log)
 */
export function useRealtimeProducao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;

    const handleProducaoChange = (payload: any) => {
      console.log('[Realtime] Producao changed:', payload.table, payload.eventType);
      
      if (payload.table === 'producao') {
        if (payload.eventType === 'UPDATE') {
          // UPDATE: mais comum (mover lote entre etapas)
          // Invalida apenas queries ativas/montadas
          queryClient.invalidateQueries({ 
            queryKey: ['producao-etapa'],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['producao-contagens'],
            refetchType: 'active'
          });
          queryClient.invalidateQueries({ 
            queryKey: ['responsaveis-unicos'],
            refetchType: 'active'
          });
        } else {
          // INSERT/DELETE: invalidar tudo para garantir consistência
          queryClient.invalidateQueries({ 
            predicate: (query) => 
              Array.isArray(query.queryKey) && 
              ['producao-etapa', 'producao-contagens', 'responsaveis-unicos'].includes(query.queryKey[0] as string)
          });
        }
      }

      if (payload.table === 'producao_log') {
        if (payload.eventType === 'INSERT') {
          const producaoId = payload.new?.producao_id;
          if (producaoId) {
            // Invalida apenas o log daquele lote específico
            queryClient.invalidateQueries({ 
              queryKey: ['producao-logs-tempo', producaoId],
              refetchType: 'active'
            });
            // Também invalida contagem de movimentações
            queryClient.invalidateQueries({ 
              queryKey: ['producao-movimentacoes', producaoId],
              refetchType: 'active'
            });
          }
        }
      }
    };

    const channel = supabase
      .channel('producao-realtime')
      // Escutar tabela producao
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao',
        },
        handleProducaoChange
      )
      // Escutar tabela producao_log
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'producao_log',
        },
        handleProducaoChange
      )
      .subscribe((status) => {
        console.log('[Realtime] Producao subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from producao-realtime');
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
