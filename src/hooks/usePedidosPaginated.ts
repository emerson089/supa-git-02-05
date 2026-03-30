import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface PedidoPaginatedDB {
  id: string;
  user_id: string;
  cliente_id: string | null;
  cliente_nome: string;
  cidade: string | null;
  estado: string | null;
  telefone: string | null;
  excursao: string | null;
  excursao_id: string | null;
  taxa_excursao: number | null;
  status: string | null;
  status_pagamento: string | null;
  status_pedido: string | null;
  status_entrega: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  total_pecas: number | null;
  valor_total: number | null;
  estorno_realizado: boolean | null;
  notificado_separado: boolean | null;
  notificado_no_carro: boolean | null;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  pedido_itens: Array<{
    id: string;
    produto_id?: string | null;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
  }>;
}

export interface PaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  statusPagamento?: string[];
  statusPedido?: string[];
  statusEntrega?: string[];
  startDate?: Date;
  endDate?: Date;
  sortField?: 'created_at' | 'valor_total';
  sortDirection?: 'asc' | 'desc';
  modeloFilter?: string;
}

export interface PaginatedResult {
  data: PedidoPaginatedDB[];
  count: number;
  totalPages: number;
}

export function usePedidosPaginated(params: PaginatedParams) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(params.search || '', 300);
  const debouncedModelo = useDebouncedValue(params.modeloFilter || '', 300);

  return useQuery({
    queryKey: [
      'pedidos-paginated',
      user?.id,
      params.page,
      params.pageSize,
      debouncedSearch,
      params.statusPagamento,
      params.statusPedido,
      params.statusEntrega,
      params.startDate?.toISOString(),
      params.endDate?.toISOString(),
      params.sortField,
      params.sortDirection,
      debouncedModelo
    ],
    queryFn: async (): Promise<PaginatedResult> => {
      // Build query for pedidos with their items
      let query = supabase
        .from('pedidos')
        .select('*, pedido_itens(*)', { count: 'exact' });

      // Apply search filter (client name only - UUID search not supported with ilike)
      if (debouncedSearch) {
        // Check if search term looks like a UUID
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debouncedSearch);
        if (isUUID) {
          query = query.eq('id', debouncedSearch);
        } else {
          query = query.ilike('cliente_nome', `%${debouncedSearch}%`);
        }
      }

      // Apply status filters (multi-select)
      if (params.statusPagamento && params.statusPagamento.length > 0) {
        query = query.in('status_pagamento', params.statusPagamento);
      }
      if (params.statusPedido && params.statusPedido.length > 0) {
        query = query.in('status_pedido', params.statusPedido);
      }
      if (params.statusEntrega && params.statusEntrega.length > 0) {
        query = query.in('status_entrega', params.statusEntrega);
      }

      // Apply date filters
      if (params.startDate) {
        const startOfDay = new Date(params.startDate);
        startOfDay.setHours(0, 0, 0, 0);
        query = query.gte('created_at', startOfDay.toISOString());
      }
      if (params.endDate) {
        const endOfDay = new Date(params.endDate);
        endOfDay.setHours(23, 59, 59, 999);
        query = query.lte('created_at', endOfDay.toISOString());
      }

      // Apply modelo filter server-side
      // Search both stored produto_nome AND current estoque_itens.nome (item may have been renamed after pedido was created)
      if (debouncedModelo) {
        // Step 1: find estoque_itens whose current name matches
        const { data: estoqueData } = await supabase
          .from('estoque_itens')
          .select('id')
          .ilike('nome', `%${debouncedModelo}%`)
          .limit(5000);

        const estoqueIds = (estoqueData || []).map((i: any) => i.id as string);

        // Step 2: find pedido_itens matching by stored name OR by current inventory name
        let itemsQuery = supabase
          .from('pedido_itens')
          .select('pedido_id')
          .limit(5000);

        if (estoqueIds.length > 0) {
          itemsQuery = itemsQuery.or(`produto_nome.ilike.%${debouncedModelo}%,produto_id.in.(${estoqueIds.join(',')})`);
        } else {
          itemsQuery = itemsQuery.ilike('produto_nome', `%${debouncedModelo}%`);
        }

        const { data: matchingItems, error: modeloError } = await itemsQuery;

        if (!modeloError) {
          const matchingIds = [...new Set((matchingItems || []).map((i: any) => i.pedido_id as string))];
          if (matchingIds.length === 0) {
            return { data: [], count: 0, totalPages: 0 };
          }
          query = query.in('id', matchingIds);
        }
        // If lookup fails, proceed without modelo filter (graceful degradation)
      }

      // Apply sorting
      const sortField = params.sortField || 'created_at';
      const ascending = params.sortDirection === 'asc';
      query = query.order(sortField, { ascending });

      // Apply pagination
      const from = params.page * params.pageSize;
      const to = from + params.pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: ((data || []) as unknown) as PedidoPaginatedDB[],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / params.pageSize)
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}
