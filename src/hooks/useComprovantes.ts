import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';

export type Comprovante = Database['public']['Tables']['comprovantes']['Row'];
export type ComprovanteCategoria = Database['public']['Enums']['comprovante_categoria'];

interface FiltrosComprovante {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  banco?: string;
  searchTerm?: string;
  categoria?: ComprovanteCategoria | 'all';
  grupo?: string;
}

export function useComprovantes(filtros: FiltrosComprovante) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['comprovantes', user?.id, filtros],
    queryFn: async () => {
      let q = supabase.from('comprovantes').select('*', { count: 'exact' });

      if (filtros.startDate) {
        const start = new Date(filtros.startDate);
        start.setHours(0, 0, 0, 0);
        q = q.gte('created_at', start.toISOString());
      }
      if (filtros.endDate) {
        const end = new Date(filtros.endDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte('created_at', end.toISOString());
      }
      if (filtros.status && filtros.status.length > 0) {
        q = q.in('status', filtros.status as ("confirmado" | "pendente_revisao" | "rejeitado")[]);
      }
      if (filtros.categoria && filtros.categoria !== 'all') {
        q = q.eq('categoria', filtros.categoria);
      }
      if (filtros.grupo && filtros.grupo !== 'all') {
        q = q.eq('grupo_whatsapp', filtros.grupo);
      }
      if (filtros.banco) {
        q = q.ilike('banco_origem', `%${filtros.banco}%`);
      }
      if (filtros.searchTerm) {
        q = q.ilike('nome_pagador', `%${filtros.searchTerm}%`);
      }

      q = q.order('created_at', { ascending: false });

      const { data, error, count } = await q;

      if (error) throw error;
      return { data: data || [], count: count || 0 };
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Comprovante> }) => {
      const { data, error } = await supabase
        .from('comprovantes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comprovantes'] });
      queryClient.invalidateQueries({ queryKey: ['comprovantes-totais-categoria'] });
      toast.success('Comprovante atualizado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar comprovante.');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('comprovantes').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comprovantes'] });
      queryClient.invalidateQueries({ queryKey: ['comprovantes-totais-categoria'] });
      toast.success('Comprovante excluído com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao excluir comprovante.');
    }
  });

  return {
    ...query,
    updateComprovante: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    deleteComprovante: deleteMutation.mutate,
    isDeleting: deleteMutation.isPending,
  };
}

interface TotaisCategoria {
  jeans: number;
  alfaiataria: number;
  naoClassificado: number;
  total: number;
  qtdJeans: number;
  qtdAlfaiataria: number;
  qtdNaoClassificado: number;
}

/**
 * Totais por categoria do período (apenas confirmados), independente
 * dos filtros de busca textual/status. Alimenta os cards do topo.
 */
export function useTotaisCategoria(periodo: { startDate?: Date; endDate?: Date }) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['comprovantes-totais-categoria', user?.id, periodo],
    queryFn: async (): Promise<TotaisCategoria> => {
      let q = supabase
        .from('comprovantes')
        .select('valor, categoria')
        .eq('status', 'confirmado');

      if (periodo.startDate) {
        const start = new Date(periodo.startDate);
        start.setHours(0, 0, 0, 0);
        q = q.gte('created_at', start.toISOString());
      }
      if (periodo.endDate) {
        const end = new Date(periodo.endDate);
        end.setHours(23, 59, 59, 999);
        q = q.lte('created_at', end.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;

      const totais: TotaisCategoria = {
        jeans: 0,
        alfaiataria: 0,
        naoClassificado: 0,
        total: 0,
        qtdJeans: 0,
        qtdAlfaiataria: 0,
        qtdNaoClassificado: 0,
      };

      for (const row of (data || []) as Array<{ valor: number | null; categoria: ComprovanteCategoria }>) {
        const v = Number(row.valor) || 0;
        if (row.categoria === 'jeans') {
          totais.jeans += v;
          totais.qtdJeans += 1;
        } else if (row.categoria === 'alfaiataria') {
          totais.alfaiataria += v;
          totais.qtdAlfaiataria += 1;
        } else {
          totais.naoClassificado += v;
          totais.qtdNaoClassificado += 1;
        }
      }
      totais.total = totais.jeans + totais.alfaiataria + totais.naoClassificado;
      return totais;
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });
}
