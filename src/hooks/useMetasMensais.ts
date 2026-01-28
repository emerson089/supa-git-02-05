import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getYear, getMonth } from 'date-fns';

export interface MetaMensal {
  id: string;
  user_id: string;
  ano: number;
  mes: number;
  valor_meta: number;
  media_base: number;
  percentual_crescimento: number;
  faturamento_realizado: number;
  created_at: string;
  updated_at: string;
}

export function useMetasMensais() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const now = new Date();
  const anoAtual = getYear(now);
  const mesAtual = getMonth(now) + 1; // 1-12

  // Buscar meta do mês atual
  const { data: metaAtual, isLoading: loadingMetaAtual } = useQuery({
    queryKey: ['meta-mensal', user?.id, anoAtual, mesAtual],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_mensais')
        .select('*')
        .eq('user_id', user!.id)
        .eq('ano', anoAtual)
        .eq('mes', mesAtual)
        .maybeSingle();
      
      if (error) throw error;
      return data as MetaMensal | null;
    },
    enabled: !!user,
    staleTime: 60 * 1000, // 1 minuto
  });

  // Buscar histórico de metas (últimos 12 meses)
  const { data: historicoMetas, isLoading: loadingHistorico } = useQuery({
    queryKey: ['metas-historico', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('metas_mensais')
        .select('*')
        .eq('user_id', user!.id)
        .order('ano', { ascending: false })
        .order('mes', { ascending: false })
        .limit(12);
      
      if (error) throw error;
      return (data || []) as MetaMensal[];
    },
    enabled: !!user,
  });

  // Salvar/atualizar meta
  const salvarMeta = useMutation({
    mutationFn: async (params: {
      valorMeta: number;
      mediaBase: number;
      percentualCrescimento: number;
      faturamentoRealizado?: number;
      ano?: number;
      mes?: number;
    }) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const { data, error } = await supabase
        .from('metas_mensais')
        .upsert({
          user_id: user.id,
          ano: params.ano || anoAtual,
          mes: params.mes || mesAtual,
          valor_meta: params.valorMeta,
          media_base: params.mediaBase,
          percentual_crescimento: params.percentualCrescimento,
          faturamento_realizado: params.faturamentoRealizado || 0,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,ano,mes'
        })
        .select()
        .single();

      if (error) throw error;
      return data as MetaMensal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meta-mensal'] });
      queryClient.invalidateQueries({ queryKey: ['metas-historico'] });
    },
  });

  return {
    metaAtual,
    historicoMetas,
    salvarMeta,
    loadingMetaAtual,
    loadingHistorico,
    anoAtual,
    mesAtual,
  };
}
