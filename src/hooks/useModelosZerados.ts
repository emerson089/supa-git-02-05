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
        .order('quantidade', { ascending: true })
        .order('nome');

      if (search && search.trim()) {
        query = query.ilike('nome', `%${search.trim()}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return (data || []) as ModeloZerado[];
    },
    staleTime: 30000,
  });
}
