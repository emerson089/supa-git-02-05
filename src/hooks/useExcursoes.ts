import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Excursao {
  id: string;
  user_id: string;
  nome: string;
  taxa: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExcursaoInsert {
  nome: string;
  taxa: number;
  ativo?: boolean;
}

export interface ExcursaoUpdate {
  nome?: string;
  taxa?: number;
  ativo?: boolean;
}

export function useExcursoes() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['excursoes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('excursoes')
        .select('*')
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as Excursao[];
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

export function useExcursoesAtivas() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['excursoes-ativas', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('excursoes')
        .select('*')
        .eq('ativo', true)
        .order('nome', { ascending: true });

      if (error) throw error;
      return data as Excursao[];
    },
    enabled: !!user,
    staleTime: 30000,
  });
}

export function useAddExcursao() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (excursao: ExcursaoInsert) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('excursoes')
        .insert({
          ...excursao,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Excursao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
    },
  });
}

export function useUpdateExcursao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ExcursaoUpdate }) => {
      const { data: updated, error } = await supabase
        .from('excursoes')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as Excursao;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
    },
  });
}

export function useDeleteExcursao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('excursoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['excursoes'] });
      queryClient.invalidateQueries({ queryKey: ['excursoes-ativas'] });
    },
  });
}
