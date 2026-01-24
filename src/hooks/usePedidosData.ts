import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ItemPedidoDB {
  id: string;
  user_id: string;
  pedido_id: string;
  produto_id: string | null;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
  created_at: string;
}

export interface PedidoDB {
  id: string;
  user_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cidade: string;
  estado: string;
  telefone: string;
  excursao: string;
  status: string;
  status_pagamento: string;
  status_pedido: string;
  status_entrega: string;
  forma_pagamento: string;
  observacoes: string;
  total_pecas: number;
  valor_total: number;
  estorno_realizado: boolean;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  itens?: ItemPedidoDB[];
}

export interface PedidoInsert {
  cliente_id?: string | null;
  cliente_nome: string;
  cidade?: string;
  estado?: string;
  telefone?: string;
  excursao?: string;
  status?: string;
  status_pagamento?: string;
  status_pedido?: string;
  status_entrega?: string;
  forma_pagamento?: string;
  observacoes?: string;
  total_pecas?: number;
  valor_total?: number;
  estorno_realizado?: boolean;
  itens: Array<{
    produto_id?: string | null;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
  }>;
}

export type PedidoUpdate = Partial<Omit<PedidoInsert, 'itens'>>;

export function usePedidos() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pedidos', user?.id],
    queryFn: async () => {
      const pageSize = 1000;
      
      // Fetch all pedidos with pagination
      let allPedidos: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: pedidos, error: pedidosError } = await supabase
          .from('pedidos')
          .select('*')
          .order('created_at', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (pedidosError) throw pedidosError;

        if (pedidos && pedidos.length > 0) {
          allPedidos = [...allPedidos, ...pedidos];
          hasMore = pedidos.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Fetch all itens with pagination
      let allItens: any[] = [];
      page = 0;
      hasMore = true;

      while (hasMore) {
        const { data: itens, error: itensError } = await supabase
          .from('pedido_itens')
          .select('*')
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (itensError) throw itensError;

        if (itens && itens.length > 0) {
          allItens = [...allItens, ...itens];
          hasMore = itens.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // Map itens to their respective pedidos
      const pedidosWithItens = allPedidos.map(pedido => ({
        ...pedido,
        itens: allItens.filter(item => item.pedido_id === pedido.id)
      }));

      return pedidosWithItens as PedidoDB[];
    },
    enabled: !!user,
    staleTime: 30000, // 30 segundos - listagem pode ter cache maior
  });
}

export function usePedidoById(id: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['pedido', id, user?.id],
    queryFn: async () => {
      if (!id) return null;

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (pedidoError) throw pedidoError;
      if (!pedido) return null;

      const { data: itens, error: itensError } = await supabase
        .from('pedido_itens')
        .select('*')
        .eq('pedido_id', id);

      if (itensError) throw itensError;

      return {
        ...pedido,
        itens: itens || []
      } as PedidoDB;
    },
    enabled: !!user && !!id,
  });
}

export function useAddPedido() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (pedido: PedidoInsert) => {
      if (!user) throw new Error('User not authenticated');

      const { itens, ...pedidoData } = pedido;

      // Insert pedido
      const { data: newPedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          ...pedidoData,
          user_id: user.id,
        })
        .select()
        .single();

      if (pedidoError) throw pedidoError;

      // Insert itens
      if (itens && itens.length > 0) {
        const itensToInsert = itens.map(item => ({
          ...item,
          user_id: user.id,
          pedido_id: newPedido.id,
        }));

        const { error: itensError } = await supabase
          .from('pedido_itens')
          .insert(itensToInsert);

        if (itensError) throw itensError;
      }

      return newPedido as PedidoDB;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
  });
}

export function useUpdatePedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: PedidoUpdate }) => {
      const { data: updated, error } = await supabase
        .from('pedidos')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return updated as PedidoDB;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    },
  });
}

export function useRemovePedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Itens are deleted automatically via CASCADE
      const { error } = await supabase
        .from('pedidos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['pedidos-totals'] });
    },
  });
}
