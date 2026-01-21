import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ProducaoData } from '@/entities/Producao';
import { ChecklistAprontamento } from '@/types/production';

const PAGE_SIZE = 20;

export interface FiltrosProducao {
  search?: string;
  prioridade?: 'urgente' | 'atencao' | 'normal' | 'todos';
  responsavel?: string;
}

interface UseProducaoPorEtapaParams {
  etapa: string;
  enabled?: boolean;
  filtros?: FiltrosProducao;
}

function toProducaoData(row: any): ProducaoData {
  return {
    ...row,
    checklist_aprontamento: row.checklist_aprontamento as ChecklistAprontamento | undefined,
  };
}

export function useProducaoPorEtapa({ etapa, enabled = true, filtros }: UseProducaoPorEtapaParams) {
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();

  const queryKey = ['producao-etapa', etapa, filtros];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      let query = supabase
        .from('producao')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .eq('processo_atual', etapa);

      // Aplicar filtros
      if (filtros?.search) {
        const search = `%${filtros.search}%`;
        query = query.or(`modelo_nome_cache.ilike.${search},id_producao.ilike.${search},responsavel.ilike.${search}`);
      }

      if (filtros?.prioridade && filtros.prioridade !== 'todos') {
        query = query.eq('prioridade', filtros.prioridade);
      }

      if (filtros?.responsavel) {
        query = query.eq('responsavel', filtros.responsavel);
      }

      // Ordenar por prioridade (urgente primeiro) e data
      query = query
        .order('prioridade', { ascending: true })
        .order('created_date', { ascending: false })
        .range(0, offset + PAGE_SIZE - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      return {
        lotes: (data || []).map(toProducaoData),
        total: count || 0,
      };
    },
    enabled,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  const loadMore = useCallback(() => {
    if (data && offset + PAGE_SIZE < data.total) {
      setOffset(prev => prev + PAGE_SIZE);
    }
  }, [data, offset]);

  const resetPagination = useCallback(() => {
    setOffset(0);
  }, []);

  // Atualização otimista para mover lote
  const optimisticMove = useCallback((lotId: string, fromEtapa: string, toEtapa: string) => {
    // Remover da etapa origem
    queryClient.setQueryData<{ lotes: ProducaoData[]; total: number } | undefined>(
      ['producao-etapa', fromEtapa, filtros],
      (old) => {
        if (!old) return old;
        return {
          lotes: old.lotes.filter(l => l.id !== lotId),
          total: old.total - 1,
        };
      }
    );

    // Invalidar a etapa destino para recarregar
    queryClient.invalidateQueries({ queryKey: ['producao-etapa', toEtapa] });
    
    // Invalidar contagens
    queryClient.invalidateQueries({ queryKey: ['producao-contagens'] });
  }, [queryClient, filtros]);

  return {
    lotes: data?.lotes || [],
    total: data?.total || 0,
    isLoading,
    error,
    hasMore: data ? (offset + PAGE_SIZE < data.total) : false,
    loadMore,
    resetPagination,
    refetch,
    optimisticMove,
  };
}

// Hook para buscar todos os responsáveis únicos
export function useResponsaveisUnicos() {
  return useQuery({
    queryKey: ['responsaveis-unicos'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data } = await supabase
        .from('producao')
        .select('responsavel')
        .eq('user_id', user.id)
        .not('responsavel', 'is', null);

      const unicos = [...new Set((data || []).map(d => d.responsavel).filter(Boolean))] as string[];
      return unicos.sort();
    },
    staleTime: 60000,
  });
}
