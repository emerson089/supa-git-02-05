import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TipoAjuste {
  id: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
}

// Hook para buscar tipos de ajuste do usuário
export function useTiposAjuste() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tipos-ajuste', user?.id],
    queryFn: async (): Promise<TipoAjuste[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tipos_ajuste_estoque')
        .select('id, nome, ativo, created_at')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return (data || []).map(t => ({
        id: t.id,
        nome: t.nome,
        ativo: t.ativo,
        createdAt: t.created_at,
      }));
    },
    enabled: !!user,
    staleTime: 60000, // 1 minuto
  });
}

// Hook para criar tipos de ajuste padrão (primeira vez)
export function useCriarTiposPadrao() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Usuário não autenticado');

      const tiposPadrao = [
        'Inventário / Conferência física',
        'Perda / Avaria',
        'Erro de lançamento',
        'Bonificação / Brinde',
        'Devolução de cliente',
        'Outro',
      ];

      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .insert(
          tiposPadrao.map(nome => ({
            user_id: user.id,
            nome,
            ativo: true,
          }))
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      toast.success('Tipos de ajuste criados com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar tipos: ${error.message}`);
    },
  });
}

// Hook para buscar tipos de ajuste para filtros (incluindo inativos marcados como label)
export function useTiposAjusteParaFiltro() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tipos-ajuste-filtro', user?.id],
    queryFn: async (): Promise<{ id: string; nome: string }[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tipos_ajuste_estoque')
        .select('id, nome')
        .eq('user_id', user.id)
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      return (data || []).map(t => ({
        id: t.id,
        nome: t.nome,
      }));
    },
    enabled: !!user,
    staleTime: 60000,
  });
}
