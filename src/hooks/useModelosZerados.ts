import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ModeloZerado {
  id: string;
  nome: string;
  imagem_url: string | null;
  quantidade: number;
}

export function useModelosZerados(search?: string) {
  return useQuery({
    queryKey: ['modelos-zerados', search],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('estoque_itens')
        .select('id, nome, imagem_url, quantidade')
        .eq('user_id', user.id)
        .eq('tipo', 'acabado')
        .order('nome');

      if (search && search.trim()) {
        query = query.ilike('nome', `%${search.trim()}%`);
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;

      // Deduplicate by nome — one card per model, summing quantities
      const byNome = new Map<string, ModeloZerado>();
      for (const row of (data || []) as ModeloZerado[]) {
        const key = row.nome.trim().toLowerCase();
        if (!byNome.has(key)) {
          byNome.set(key, { ...row });
        } else {
          const existing = byNome.get(key)!;
          existing.quantidade += row.quantidade;
          // prefer the record that has an image
          if (!existing.imagem_url && row.imagem_url) {
            existing.imagem_url = row.imagem_url;
            existing.id = row.id;
          }
        }
      }

      // Sort: zerados first, then by name
      return Array.from(byNome.values()).sort((a, b) => {
        if (a.quantidade === 0 && b.quantidade > 0) return -1;
        if (b.quantidade === 0 && a.quantidade > 0) return 1;
        return a.nome.localeCompare(b.nome);
      });
    },
    staleTime: 30000,
  });
}
