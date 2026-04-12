import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface TotalsParams {
  search?: string;
  statusPagamento?: string[];
  statusPedido?: string[];
  statusEntrega?: string[];
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
      // Helper to apply common filters to a query
      const applyFilters = (q: any) => {
        // Apply search filter
        if (debouncedSearch) {
          const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(debouncedSearch);
          if (isUUID) {
            q = q.eq('id', debouncedSearch);
          } else {
            q = q.ilike('cliente_nome', `%${debouncedSearch}%`);
          }
        }

        // Apply status filters (multi-select)
        if (params.statusPagamento && params.statusPagamento.length > 0) {
          q = q.in('status_pagamento', params.statusPagamento);
        }
        if (params.statusPedido && params.statusPedido.length > 0) {
          q = q.in('status_pedido', params.statusPedido);
        }
        if (params.statusEntrega && params.statusEntrega.length > 0) {
          q = q.in('status_entrega', params.statusEntrega);
        }
        
        // DEFAULT: Exclude canceled orders from totals if no specific status filters are active
        if (!params.statusPagamento?.length && !params.statusPedido?.length && !params.statusEntrega?.length) {
          q = q.not('status_pagamento', 'in', '("CANCELADO", "GOLPE CANCELADO")');
        }

        // Apply date filters
        if (params.startDate) {
          const startOfDayDate = new Date(params.startDate);
          startOfDayDate.setHours(0, 0, 0, 0);
          q = q.gte('created_at', startOfDayDate.toISOString());
        }
        if (params.endDate) {
          const endOfDayDate = new Date(params.endDate);
          endOfDayDate.setHours(23, 59, 59, 999);
          q = q.lte('created_at', endOfDayDate.toISOString());
        }

        return q;
      };

      // If modelo filter is active, we need to fetch pedido_itens
      // Also search by current estoque_itens.nome (item may have been renamed after pedido was created)
      if (debouncedModelo) {
        // Find estoque_itens whose current name matches
        const { data: estoqueData } = await supabase
          .from('estoque_itens')
          .select('id')
          .ilike('nome', `%${debouncedModelo}%`)
          .limit(5000);

        const estoqueIds = new Set((estoqueData || []).map((i: any) => i.id as string));

        const buildModeloQuery = () => {
          let q = supabase.from('pedidos').select('id, valor_total, total_pecas, pedido_itens(produto_nome, produto_id, quantidade, valor_unitario)');
          return applyFilters(q);
        };

        const pageSize = 1000;
        let allData: any[] = [];
        let page = 0;
        let hasMore = true;

        while (hasMore) {
          const { data, error } = await buildModeloQuery().range(page * pageSize, (page + 1) * pageSize - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allData = [...allData, ...data];
            hasMore = data.length === pageSize;
            page++;
          } else {
            hasMore = false;
          }
        }

        const modeloLower = debouncedModelo.toLowerCase();
        let pecasModelo = 0;
        let valorModelo = 0;
        let pedidosComModelo = new Set<string>();

        allData.forEach(pedido => {
          (pedido.pedido_itens || []).forEach((item: any) => {
            const nomeMatch = item.produto_nome?.toLowerCase().includes(modeloLower);
            const estoqueMatch = item.produto_id && estoqueIds.has(item.produto_id);
            if (nomeMatch || estoqueMatch) {
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

      // OPTIMIZED: Get count using exact count (no data transfer)
      let countQuery = supabase.from('pedidos').select('*', { count: 'exact', head: true });
      countQuery = applyFilters(countQuery);
      const { count, error: countError } = await countQuery;
      if (countError) throw countError;

      // OPTIMIZED: Fetch only valor_total and total_pecas (minimal payload)
      const buildSumQuery = () => {
        let q = supabase.from('pedidos').select('valor_total, total_pecas');
        return applyFilters(q);
      };

      const pageSize = 1000;
      let totalValor = 0;
      let totalPecas = 0;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await buildSumQuery().range(page * pageSize, (page + 1) * pageSize - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          data.forEach(p => {
            totalValor += p.valor_total || 0;
            totalPecas += p.total_pecas || 0;
          });
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }

      return {
        totalPedidos: count || 0,
        totalValor,
        totalPecas
      };
    },
    enabled: !!user,
    staleTime: 30000, // 30 seconds
    refetchOnWindowFocus: false,
  });
}
