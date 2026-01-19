import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface LoteCustosConfig {
  metros_corte: number;
  valor_metro: number;
  preco_venda: number;
}

export function useLoteCustos(producaoId: string | null) {
  const queryClient = useQueryClient();

  const { data: config, isLoading: loading } = useQuery({
    queryKey: ['lote-custos', producaoId],
    queryFn: async () => {
      if (!producaoId) return null;

      const { data } = await supabase
        .from('lote_custos_config')
        .select('metros_corte, valor_metro, preco_venda')
        .eq('producao_id', producaoId)
        .maybeSingle();

      if (data) {
        return {
          metros_corte: Number(data.metros_corte) || 0,
          valor_metro: Number(data.valor_metro) || 0,
          preco_venda: Number(data.preco_venda) || 0
        } as LoteCustosConfig;
      }
      return null;
    },
    enabled: !!producaoId,
    staleTime: 30000, // 30 segundos - dados de custos não mudam frequentemente
  });

  // Subscribe to realtime changes - apenas para invalidar cache
  useEffect(() => {
    if (!producaoId) return;

    const channel = supabase
      .channel(`lote_custos_${producaoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lote_custos_config',
        filter: `producao_id=eq.${producaoId}`
      }, () => {
        // Apenas invalidar o cache, não buscar direto
        queryClient.invalidateQueries({ queryKey: ['lote-custos', producaoId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [producaoId, queryClient]);

  return { config: config ?? null, loading };
}
