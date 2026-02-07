import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CustoPadrao {
  id: string;
  tipo: string;
  descricao: string;
  valor_unitario: number;
  ativo: boolean;
  ordem: number;
}

interface CreateCustoPadraoInput {
  tipo: string;
  descricao: string;
  valor_unitario: number;
  ordem?: number;
}

interface UpdateCustoPadraoInput {
  id: string;
  tipo?: string;
  descricao?: string;
  valor_unitario?: number;
  ativo?: boolean;
  ordem?: number;
}

export function useCustosPadrao() {
  const queryClient = useQueryClient();

  // Fetch all custos padrão
  const { data: custosPadrao = [], isLoading } = useQuery({
    queryKey: ['custos-padrao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_padrao')
        .select('*')
        .order('ordem', { ascending: true })
        .order('tipo', { ascending: true });

      if (error) throw error;
      return data as CustoPadrao[];
    },
    staleTime: 60000, // 1 minuto
  });

  // Fetch only active custos padrão (for applying to lots)
  const { data: custosAtivos = [] } = useQuery({
    queryKey: ['custos-padrao', 'ativos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custos_padrao')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true })
        .order('tipo', { ascending: true });

      if (error) throw error;
      return data as CustoPadrao[];
    },
    staleTime: 60000,
  });

  // Create custo padrão
  const createMutation = useMutation({
    mutationFn: async (input: CreateCustoPadraoInput) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get next ordem if not provided
      let ordem = input.ordem;
      if (ordem === undefined) {
        const { data: maxOrdem } = await supabase
          .from('custos_padrao')
          .select('ordem')
          .order('ordem', { ascending: false })
          .limit(1)
          .maybeSingle();
        ordem = (maxOrdem?.ordem || 0) + 1;
      }

      const { data, error } = await supabase
        .from('custos_padrao')
        .insert({
          user_id: user.id,
          tipo: input.tipo,
          descricao: input.descricao,
          valor_unitario: input.valor_unitario,
          ordem,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-padrao'] });
      toast.success('Custo padrão criado');
    },
    onError: () => {
      toast.error('Erro ao criar custo padrão');
    },
  });

  // Update custo padrão
  const updateMutation = useMutation({
    mutationFn: async (input: UpdateCustoPadraoInput) => {
      const { id, ...updates } = input;
      
      const { data, error } = await supabase
        .from('custos_padrao')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-padrao'] });
      toast.success('Custo padrão atualizado');
    },
    onError: () => {
      toast.error('Erro ao atualizar custo padrão');
    },
  });

  // Delete custo padrão
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('custos_padrao')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-padrao'] });
      toast.success('Custo padrão removido');
    },
    onError: () => {
      toast.error('Erro ao remover custo padrão');
    },
  });

  // Toggle ativo status
  const toggleAtivoMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('custos_padrao')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custos-padrao'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar status');
    },
  });

  return {
    custosPadrao,
    custosAtivos,
    isLoading,
    createCustoPadrao: createMutation.mutateAsync,
    updateCustoPadrao: updateMutation.mutateAsync,
    deleteCustoPadrao: deleteMutation.mutateAsync,
    toggleAtivo: toggleAtivoMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
