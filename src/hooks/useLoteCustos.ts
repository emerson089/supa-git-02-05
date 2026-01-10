import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LoteCustosConfig {
  metros_corte: number;
  valor_metro: number;
  preco_venda: number;
}

export function useLoteCustos(producaoId: string | null) {
  const [config, setConfig] = useState<LoteCustosConfig | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!producaoId) {
      setConfig(null);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('lote_custos_config')
          .select('metros_corte, valor_metro, preco_venda')
          .eq('producao_id', producaoId)
          .maybeSingle();

        if (data) {
          setConfig({
            metros_corte: Number(data.metros_corte) || 0,
            valor_metro: Number(data.valor_metro) || 0,
            preco_venda: Number(data.preco_venda) || 0
          });
        } else {
          setConfig(null);
        }
      } catch (error) {
        console.error('Erro ao buscar custos:', error);
        setConfig(null);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`lote_custos_${producaoId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'lote_custos_config',
        filter: `producao_id=eq.${producaoId}`
      }, () => {
        fetchConfig();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [producaoId]);

  return { config, loading };
}
