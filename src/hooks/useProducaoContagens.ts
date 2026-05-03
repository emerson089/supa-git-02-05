import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STAGES } from '@/data/production-data';

export interface ContagemEtapa {
  etapa: string;
  quantidade: number;
  totalPecas: number;
}

export function useProducaoContagens() {
  return useQuery({
    queryKey: ['producao-contagens'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Query leve para contagens agrupadas por etapa
      const { data, error } = await supabase
        .from('producao')
        .select('processo_atual, quantidade')
        .eq('user_id', user.id);

      if (error) throw error;

      // Calcular contagens por etapa
      const contagensMap = new Map<string, { quantidade: number; totalPecas: number }>();
      
      // Inicializar todas as etapas com zero
      STAGES.forEach(stage => {
        contagensMap.set(stage.id, { quantidade: 0, totalPecas: 0 });
      });

      // Somar dados reais
      (data || []).forEach(item => {
        const existing = contagensMap.get(item.processo_atual) || { quantidade: 0, totalPecas: 0 };
        contagensMap.set(item.processo_atual, {
          quantidade: existing.quantidade + 1,
          totalPecas: existing.totalPecas + (item.quantidade || 0),
        });
      });

      // Converter para array
      const contagens: ContagemEtapa[] = STAGES.map(stage => ({
        etapa: stage.id,
        quantidade: contagensMap.get(stage.id)?.quantidade || 0,
        totalPecas: contagensMap.get(stage.id)?.totalPecas || 0,
      }));

      const totalLotes = contagens.reduce((sum, c) => sum + c.quantidade, 0);
      const totalPecas = contagens.reduce((sum, c) => sum + c.totalPecas, 0);

      return { contagens, totalLotes, totalPecas };
    },
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: false,
  });
}
