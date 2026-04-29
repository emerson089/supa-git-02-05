import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CATEGORIA_MODELO_PAD, CATEGORIA_VARIACAO_PAD } from './useModelosPadronizados';

export interface ModeloZerado {
  id: string;
  nome: string;
  imagem_url: string | null;
  quantidade: number;
  // total estoque somado das variações (calculado client-side)
  quantidadeTotal?: number;
}

export function useModelosZerados(search?: string) {
  return useQuery({
    queryKey: ['modelos-zerados', search],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Busca 1: modelos pai (Modelo Padronizado) — um por modelo, tem foto
      let modelosQuery = supabase
        .from('estoque_itens')
        .select('id, nome, imagem_url, quantidade')
        .eq('user_id', user.id)
        .eq('tipo', 'acabado')
        .eq('categoria', CATEGORIA_MODELO_PAD)
        .order('nome');

      if (search?.trim()) {
        modelosQuery = modelosQuery.ilike('nome', `%${search.trim()}%`);
      }

      // Busca 2: variações — para somar estoque real por modelo
      const variacoesQuery = supabase
        .from('estoque_itens')
        .select('localizacao, quantidade')
        .eq('user_id', user.id)
        .eq('tipo', 'acabado')
        .eq('categoria', CATEGORIA_VARIACAO_PAD);

      const [{ data: modelos, error: errModelos }, { data: variacoes, error: errVar }] =
        await Promise.all([modelosQuery.limit(200), variacoesQuery.limit(2000)]);

      if (errModelos) throw errModelos;
      if (errVar) throw errVar;

      // Soma quantidades das variações agrupadas por modeloId
      const estoqueByModeloId = new Map<string, number>();
      for (const v of variacoes || []) {
        try {
          const parsed = JSON.parse(v.localizacao || '{}');
          const mid = parsed?.modeloId as string | undefined;
          if (mid) {
            estoqueByModeloId.set(mid, (estoqueByModeloId.get(mid) ?? 0) + (v.quantidade ?? 0));
          }
        } catch { /* localizacao inválida */ }
      }

      const result: ModeloZerado[] = (modelos || []).map(m => ({
        id: m.id,
        nome: m.nome,
        imagem_url: m.imagem_url,
        quantidade: m.quantidade,
        quantidadeTotal: estoqueByModeloId.get(m.id) ?? m.quantidade,
      }));

      // Zerados (sem estoque em nenhum tamanho) primeiro, depois por nome
      return result.sort((a, b) => {
        const az = (a.quantidadeTotal ?? 0) === 0;
        const bz = (b.quantidadeTotal ?? 0) === 0;
        if (az && !bz) return -1;
        if (!az && bz) return 1;
        return a.nome.localeCompare(b.nome);
      });
    },
    staleTime: 30000,
  });
}
