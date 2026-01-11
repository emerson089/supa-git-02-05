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
      // Function to build a fresh query with all filters applied
      const buildQuery = () => {
        // Only include pedido_itens if modelo filter is active (reduces payload)
        const selectFields = debouncedModelo 
          ? 'id, valor_total, total_pecas, pedido_itens(produto_nome, quantidade, valor_unitario)'
          : 'id, valor_total, total_pecas';
        
        let q = supabase.from('pedidos').select(selectFields);

        // Apply search filter (client name only - UUID search not supported with ilike)
        if (debouncedSearch) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debouncedSearch);
          if (isUUID) {
            q = q.eq('id', debouncedSearch);
          } else {
            q = q.ilike('cliente_nome', `%${debouncedSearch}%`);
          }
        }

        // Apply status filters
        if (params.statusPagamento && params.statusPagamento !== 'all') {
          q = q.eq('status_pagamento', params.statusPagamento);
        }
        if (params.statusPedido && params.statusPedido !== 'all') {
          q = q.eq('status_pedido', params.statusPedido);
        }
        if (params.statusEntrega && params.statusEntrega !== 'all') {
          q = q.eq('status_entrega', params.statusEntrega);
        }

        // Apply date filters
        if (params.startDate) {
          const startOfDay = new Date(params.startDate);
          startOfDay.setHours(0, 0, 0, 0);
          q = q.gte('created_at', startOfDay.toISOString());
        }
        if (params.endDate) {
          const endOfDay = new Date(params.endDate);
          endOfDay.setHours(23, 59, 59, 999);
          q = q.lte('created_at', endOfDay.toISOString());
        }

        return q;
      };

      // Fetch with pagination to get all records for totals
      // IMPORTANT: Build a fresh query for each page to avoid reusing the same builder
      const pageSize = 1000;
      let allData: any[] = [];
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await buildQuery().range(page * pageSize, (page + 1) * pageSize - 1);
        
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
