import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface TotalsParams {
  search?: string;
  statusPagamento?: string;
  statusPedido?: string;
  statusEntrega?: string;
  startDate?: Date;
  endDate?: Date;
  modeloFilter?: string;
}

export interface PedidosTotals {
  totalPedidos: number;
  totalValor: number;
  totalPecas: number;
}

export function usePedidosTotals(params: TotalsParams) {
  const { user } = useAuth();
  const debouncedSearch = useDebouncedValue(params.search || '', 300);
  const debouncedModelo = useDebouncedValue(params.modeloFilter || '', 300);

  return useQuery({
    queryKey: [
      'pedidos-totals',
      user?.id,
      debouncedSearch,
      params.statusPagamento,
      params.statusPedido,
      params.statusEntrega,
      params.startDate?.toISOString(),
      params.endDate?.toISOString(),
      debouncedModelo
    ],
    queryFn: async (): Promise<PedidosTotals> => {
      // Build query
      let query = supabase
        .from('pedidos')
        .select('id, valor_total, total_pecas, pedido_itens(produto_nome, quantidade, valor_unitario)');

      // Apply search filter
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

      // Fetch with pagination to get all records for totals
      const pageSize = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await query.range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      // If modelo filter is active, calculate totals only for that modelo
      if (debouncedModelo) {
        const modeloLower = debouncedModelo.toLowerCase();
        let pecasModelo = 0;
        let valorModelo = 0;
        let pedidosComModelo = new Set<string>();

        allData.forEach(pedido => {
          (pedido.pedido_itens || []).forEach((item: any) => {
            if (item.produto_nome.toLowerCase().includes(modeloLower)) {
              pecasModelo += item.quantidade;
              valorModelo += item.quantidade * item.valor_unitario;
              pedidosComModelo.add(pedido.id);
            }
          });
        });

        return {
          totalPedidos: pedidosComModelo.size,
          totalValor: valorModelo,
          totalPecas: pecasModelo
        };
      }

      // Calculate totals
      return {
        totalPedidos: allData.length,
        totalValor: allData.reduce((sum, p) => sum + (p.valor_total || 0), 0),
        totalPecas: allData.reduce((sum, p) => sum + (p.total_pecas || 0), 0)
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}
