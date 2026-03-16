import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIA_VARIACAO_PAD, TAMANHOS_LETRAS, TAMANHOS_NUMERICOS } from './useModelosPadronizados';

export interface ModeloVariacao {
  tamanho: string;
  quantidade: number;
}

const ORDEM_TAMANHOS = [...TAMANHOS_LETRAS, ...TAMANHOS_NUMERICOS] as string[];

export function useModeloVariacoes(modeloId: string | null) {
  return useQuery({
    queryKey: ['modelo-variacoes', modeloId],
    enabled: !!modeloId,
    staleTime: 30000,
    queryFn: async (): Promise<ModeloVariacao[]> => {
      if (!modeloId) return [];

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // localizacao is plain text JSON, use ilike to filter by modeloId
      const { data, error } = await supabase
        .from('estoque_itens')
        .select('localizacao, quantidade')
        .eq('user_id', user.id)
        .eq('categoria', CATEGORIA_VARIACAO_PAD)
        .ilike('localizacao', `%"modeloId":"${modeloId}"%`);

      if (error) throw error;

      return (data || [])
        .map(row => {
          try {
            const p = JSON.parse(row.localizacao || '');
            if (p?.tamanho) {
              return { tamanho: p.tamanho as string, quantidade: row.quantidade ?? 0 };
            }
          } catch {
            // malformed JSON
          }
          return null;
        })
        .filter((v): v is ModeloVariacao => v !== null)
        .sort((a, b) => {
          const ai = ORDEM_TAMANHOS.indexOf(a.tamanho);
          const bi = ORDEM_TAMANHOS.indexOf(b.tamanho);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
    },
  });
}
