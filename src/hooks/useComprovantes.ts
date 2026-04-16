import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Comprovante {
  id: string;
  valor: number | null;
  data_pagamento: string | null;
  nome_pagador: string | null;
  banco_origem: string | null;
  tipo_pagamento: string | null;
  chave_pix: string | null;
  imagem_url: string;
  dados_brutos: any;
  status: 'confirmado' | 'pendente_revisao' | 'rejeitado';
  grupo_whatsapp: string | null;
  numero_remetente: string | null;
  observacoes: string | null;
  created_at: string;
}

interface FiltrosComprovante {
  startDate?: Date;
  endDate?: Date;
  status?: string[];
  banco?: string;
  searchTerm?: string;
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
        q = q.in('status', filtros.status);
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
      return { data: (data as unknown as Comprovante[]) || [], count: count || 0 };
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
      toast.success('Comprovante atualizado com sucesso!');
    },
    onError: (error) => {
      console.error(error);
      toast.error('Erro ao atualizar comprovante.');
    }
  });

  return {
    ...query,
    updateComprovante: updateMutation.mutate,
    isUpdating: updateMutation.isPending
  };
}
