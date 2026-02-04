import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface ContagemEstoque {
  id: string;
  localId: string;
  dataContagem: string;
  totalPecas: number;
  valorTotal: number;
  observacoes: string | null;
  createdAt: string;
}

export interface ContagemItem {
  id: string;
  contagemId: string;
  itemId: string;
  quantidadeContada: number;
  quantidadeSistema: number;
  precoAplicado: number;
}

interface CriarContagemParams {
  localId: string;
  itens: Array<{
    itemId: string;
    quantidade: number;
    preco: number;
  }>;
  observacoes?: string;
}

// Hook para buscar contagens de um local
export function useContagensEstoque(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contagens-estoque', localId],
    queryFn: async (): Promise<ContagemEstoque[]> => {
      if (!localId || !user) return [];

      const { data, error } = await supabase
        .from('contagens_estoque')
        .select('*')
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .order('data_contagem', { ascending: false });

      if (error) throw error;

      return (data || []).map(c => ({
        id: c.id,
        localId: c.local_id,
        dataContagem: c.data_contagem,
        totalPecas: c.total_pecas,
        valorTotal: c.valor_total,
        observacoes: c.observacoes,
        createdAt: c.created_at || '',
      }));
    },
    enabled: !!localId && !!user,
    staleTime: 30_000,
  });
}

// Hook para buscar última contagem de um local
export function useUltimaContagem(localId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['ultima-contagem', localId],
    queryFn: async (): Promise<ContagemEstoque | null> => {
      if (!localId || !user) return null;

      const { data, error } = await supabase
        .from('contagens_estoque')
        .select('*')
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .order('data_contagem', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        localId: data.local_id,
        dataContagem: data.data_contagem,
        totalPecas: data.total_pecas,
        valorTotal: data.valor_total,
        observacoes: data.observacoes,
        createdAt: data.created_at || '',
      };
    },
    enabled: !!localId && !!user,
    staleTime: 30_000,
  });
}

// Hook para criar nova contagem
export function useCriarContagem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CriarContagemParams) => {
      if (!user) throw new Error('Usuário não autenticado');

      const totalPecas = params.itens.reduce((sum, i) => sum + i.quantidade, 0);
      const valorTotal = params.itens.reduce((sum, i) => sum + (i.quantidade * i.preco), 0);

      // Criar contagem
      const { data: contagem, error: contagemError } = await supabase
        .from('contagens_estoque')
        .insert({
          user_id: user.id,
          local_id: params.localId,
          total_pecas: totalPecas,
          valor_total: valorTotal,
          observacoes: params.observacoes || null,
        })
        .select()
        .single();

      if (contagemError) throw contagemError;

      // Criar itens da contagem
      const itensToInsert = params.itens
        .filter(i => i.quantidade > 0)
        .map(item => ({
          user_id: user.id,
          contagem_id: contagem.id,
          item_id: item.itemId,
          quantidade_contada: item.quantidade,
          quantidade_sistema: item.quantidade,
          preco_aplicado: item.preco,
        }));

      if (itensToInsert.length > 0) {
        const { error: itensError } = await supabase
          .from('contagem_itens')
          .insert(itensToInsert);

        if (itensError) throw itensError;
      }

      return contagem;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contagens-estoque', variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['ultima-contagem', variables.localId] });
      queryClient.invalidateQueries({ queryKey: ['vendas-desde-contagem'] });
      toast.success('Contagem registrada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao criar contagem:', error);
      toast.error('Erro ao registrar contagem');
    },
  });
}

// Hook para buscar vendas desde a última contagem
export function useVendasDesdeContagem(localId: string | null) {
  const { user } = useAuth();
  const { data: ultimaContagem } = useUltimaContagem(localId);

  return useQuery({
    queryKey: ['vendas-desde-contagem', localId, ultimaContagem?.id],
    queryFn: async () => {
      if (!localId || !user) {
        return { pecasVendidas: 0, valorVendido: 0, dataContagem: null };
      }

      if (!ultimaContagem) {
        return { pecasVendidas: 0, valorVendido: 0, dataContagem: null };
      }

      // Buscar movimentações de saída desde a última contagem
      const { data: movimentacoes, error } = await supabase
        .from('estoque_movimentacoes')
        .select('quantidade, preco_aplicado')
        .eq('local_id', localId)
        .eq('user_id', user.id)
        .in('tipo', ['AJUSTE_SAIDA', 'VENDA', 'TRANSFERENCIA'])
        .gte('created_at', ultimaContagem.dataContagem);

      if (error) throw error;

      const pecasVendidas = (movimentacoes || []).reduce((sum, m) => sum + Number(m.quantidade || 0), 0);
      const valorVendido = (movimentacoes || []).reduce((sum, m) => {
        const preco = Number(m.preco_aplicado || 0);
        const qtd = Number(m.quantidade || 0);
        return sum + (qtd * preco);
      }, 0);

      return {
        pecasVendidas,
        valorVendido,
        dataContagem: ultimaContagem.dataContagem,
      };
    },
    enabled: !!localId && !!user,
    staleTime: 30_000,
  });
}

// Hook para buscar detalhes (itens) de uma contagem específica
export interface ContagemItemDetalhe {
  id: string;
  itemId: string;
  itemNome: string;
  quantidadeContada: number;
  precoAplicado: number;
}

export function useContagemDetalhes(contagemId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['contagem-detalhes', contagemId],
    queryFn: async (): Promise<ContagemItemDetalhe[]> => {
      if (!contagemId || !user) return [];

      const { data, error } = await supabase
        .from('contagem_itens')
        .select(`
          id,
          item_id,
          quantidade_contada,
          preco_aplicado,
          estoque_itens!inner(nome)
        `)
        .eq('contagem_id', contagemId)
        .eq('user_id', user.id)
        .order('quantidade_contada', { ascending: false });

      if (error) throw error;

      return (data || []).map(item => ({
        id: item.id,
        itemId: item.item_id,
        itemNome: (item.estoque_itens as any)?.nome || 'Produto',
        quantidadeContada: item.quantidade_contada,
        precoAplicado: item.preco_aplicado,
      }));
    },
    enabled: !!contagemId && !!user,
    staleTime: 60_000,
  });
}

// Hook para excluir uma contagem
export function useExcluirContagem() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contagemId: string) => {
      if (!user) throw new Error('Usuário não autenticado');

      // Primeiro, deletar os itens da contagem
      const { error: itensError } = await supabase
        .from('contagem_itens')
        .delete()
        .eq('contagem_id', contagemId)
        .eq('user_id', user.id);

      if (itensError) throw itensError;

      // Depois, deletar a contagem
      const { error: contagemError } = await supabase
        .from('contagens_estoque')
        .delete()
        .eq('id', contagemId)
        .eq('user_id', user.id);

      if (contagemError) throw contagemError;

      return contagemId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contagens-estoque'] });
      queryClient.invalidateQueries({ queryKey: ['ultima-contagem'] });
      queryClient.invalidateQueries({ queryKey: ['vendas-desde-contagem'] });
      toast.success('Contagem excluída com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao excluir contagem:', error);
      toast.error('Erro ao excluir contagem');
    },
  });
}

// Interface para contagem com variação calculada
export interface ContagemComVariacao extends ContagemEstoque {
  variacao: {
    pecas: number;
    valor: number;
    diasEntre: number;
  } | null;
}

// Função utilitária para calcular variações entre contagens
export function calcularVariacoes(contagens: ContagemEstoque[]): ContagemComVariacao[] {
  return contagens.map((contagem, index) => {
    const anterior = contagens[index + 1]; // próxima na lista é a anterior cronologicamente
    
    if (!anterior) {
      return { ...contagem, variacao: null };
    }

    const diasEntre = Math.ceil(
      (new Date(contagem.dataContagem).getTime() - new Date(anterior.dataContagem).getTime()) 
      / (1000 * 60 * 60 * 24)
    );

    return {
      ...contagem,
      variacao: {
        pecas: anterior.totalPecas - contagem.totalPecas, // positivo = vendeu
        valor: anterior.valorTotal - contagem.valorTotal, // positivo = vendeu
        diasEntre,
      },
    };
  });
}
