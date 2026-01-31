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

// Hook para buscar tipos de ajuste ATIVOS (para selects)
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

// Hook para buscar TODOS os tipos (ativos e inativos) - para tela de gerenciamento
export function useTodosOsTiposAjuste() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['tipos-ajuste-todos', user?.id],
    queryFn: async (): Promise<TipoAjuste[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('tipos_ajuste_estoque')
        .select('id, nome, ativo, created_at')
        .eq('user_id', user.id)
        .order('ativo', { ascending: false })
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
    staleTime: 30000,
  });
}

// Hook para criar tipos de ajuste padrão (primeira vez) - usando upsert
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

      // Usar upsert com onConflict para evitar duplicatas
      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .upsert(
          tiposPadrao.map(nome => ({
            user_id: user.id,
            nome,
            ativo: true,
          })),
          { onConflict: 'user_id,nome', ignoreDuplicates: true }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste-todos'] });
      toast.success('Tipos de ajuste criados com sucesso!');
    },
    onError: (error: any) => {
      toast.error(`Erro ao criar tipos: ${error.message}`);
    },
  });
}

// Hook para criar um novo tipo de ajuste
export function useCriarTipoAjuste() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (nome: string) => {
      if (!user) throw new Error('Usuário não autenticado');
      
      const nomeTrimmed = nome.trim();
      if (!nomeTrimmed) throw new Error('Nome não pode estar vazio');

      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .insert({ user_id: user.id, nome: nomeTrimmed, ativo: true });

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este nome já existe');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste-todos'] });
      toast.success('Tipo de ajuste criado!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

// Hook para editar nome de um tipo
export function useEditarTipoAjuste() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, nome }: { id: string; nome: string }) => {
      const nomeTrimmed = nome.trim();
      if (!nomeTrimmed) throw new Error('Nome não pode estar vazio');

      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .update({ nome: nomeTrimmed })
        .eq('id', id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este nome já existe');
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste-todos'] });
      toast.success('Tipo de ajuste atualizado!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

// Hook para alternar ativo/inativo
export function useAlternarAtivoTipoAjuste() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .update({ ativo })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste-todos'] });
      toast.success(variables.ativo ? 'Tipo reativado!' : 'Tipo desativado!');
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

// Hook para verificar se tipo está em uso
export function useVerificarTipoEmUso(tipoId: string | null) {
  return useQuery({
    queryKey: ['tipo-ajuste-em-uso', tipoId],
    queryFn: async () => {
      if (!tipoId) return { emUso: false, quantidade: 0 };

      const { count, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_ajuste_id', tipoId);

      if (error) throw error;

      return {
        emUso: (count || 0) > 0,
        quantidade: count || 0,
      };
    },
    enabled: !!tipoId,
  });
}

// Hook para excluir tipo (apenas se não estiver em uso)
export function useExcluirTipoAjuste() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar se está em uso
      const { count } = await supabase
        .from('estoque_movimentacoes')
        .select('*', { count: 'exact', head: true })
        .eq('tipo_ajuste_id', id);

      if ((count || 0) > 0) {
        throw new Error('Este tipo está em uso e não pode ser excluído. Use "Desativar" em vez disso.');
      }

      const { error } = await supabase
        .from('tipos_ajuste_estoque')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste'] });
      queryClient.invalidateQueries({ queryKey: ['tipos-ajuste-todos'] });
      toast.success('Tipo de ajuste excluído!');
    },
    onError: (error: any) => {
      toast.error(error.message);
    },
  });
}

// Hook para buscar tipos de ajuste para filtros (apenas ativos)
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
