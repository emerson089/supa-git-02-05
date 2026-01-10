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
  status: string | null;
  status_pagamento: string | null;
  status_pedido: string | null;
  status_entrega: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  total_pecas: number | null;
  valor_total: number | null;
  estorno_realizado: boolean | null;
  created_at: string;
  updated_at: string;
  pedido_itens: Array<{
    id: string;
    produto_id: string | null;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
  }>;
}

export interface PaginatedParams {
  page: number;
  pageSize: number;
  search?: string;
  statusPagamento?: string;
  statusPedido?: string;
  statusEntrega?: string;
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

      // Apply search filter (client name or ID)
      if (debouncedSearch) {
        query = query.or(`cliente_nome.ilike.%${debouncedSearch}%,id.ilike.%${debouncedSearch}%`);
      }

      // Apply status filters
      if (params.statusPagamento && params.statusPagamento !== 'all') {
        query = query.eq('status_pagamento', params.statusPagamento);
      }
      if (params.statusPedido && params.statusPedido !== 'all') {
        query = query.eq('status_pedido', params.statusPedido);
      }
      if (params.statusEntrega && params.statusEntrega !== 'all') {
        query = query.eq('status_entrega', params.statusEntrega);
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

      let filteredData = data || [];

      // Apply modelo filter client-side (needs to check items)
      if (debouncedModelo) {
        const modeloLower = debouncedModelo.toLowerCase();
        filteredData = filteredData.filter(pedido =>
          pedido.pedido_itens?.some((item: any) =>
            item.produto_nome.toLowerCase().includes(modeloLower)
          )
        );
      }

      return {
        data: filteredData as PedidoPaginatedDB[],
        count: count || 0,
        totalPages: Math.ceil((count || 0) / params.pageSize)
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}
