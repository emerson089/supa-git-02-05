import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays } from 'date-fns';

export interface ClienteCRMBatchStats {
  clienteId: string;
  totalComprado: number;
  pedidosPagos: number;
  cancelamentos: number;
  ultimaCompra: Date | null;
  ultimoPedidoValor: number | null;
  ultimoPedidoStatus: string | null;
  ultimoPedidoPendenteValor: number | null;
  ultimoPedidoPendenteData: Date | null;
}

export type ClienteStatusLabel = 'VIP' | 'Frequente' | 'Inativo';

export interface ClienteStatusInfo {
  label: ClienteStatusLabel;
  color: string;
}

export function getClienteStatusFromStats(stats: ClienteCRMBatchStats | undefined): ClienteStatusInfo | null {
  if (!stats) return null;
  
  const hoje = new Date();
  const diasDesdeUltimaCompra = stats.ultimaCompra 
    ? differenceInDays(hoje, stats.ultimaCompra) 
    : Infinity;
  
  // VIP: Total comprado acima de R$ 10.000
  if (stats.totalComprado >= 10000) {
    return { label: 'VIP', color: 'bg-amber-500 text-white' };
  }
  
  // Inativo: Última compra há mais de 45 dias
  if (diasDesdeUltimaCompra > 45) {
    return { label: 'Inativo', color: 'bg-gray-400 text-white' };
  }
  
  // Frequente: 5 ou mais pedidos pagos
  if (stats.pedidosPagos >= 5) {
    return { label: 'Frequente', color: 'bg-blue-500 text-white' };
  }
  
  return null;
}

export function hasRiskAlertFromStats(stats: ClienteCRMBatchStats | undefined): boolean {
  if (!stats) return false;
  return stats.cancelamentos >= 2;
}

/**
 * Fetches CRM stats for a batch of client IDs (only the visible ones).
 * This is much more efficient than fetching all orders for all clients.
 */
export function useClientesCRMBatch(clienteIds: string[]) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clientes-crm-batch', clienteIds.sort().join(',')],
    queryFn: async () => {
      if (clienteIds.length === 0) {
        return new Map<string, ClienteCRMBatchStats>();
      }

      // Fetch orders ONLY for the visible clients
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('cliente_id, valor_total, status_pagamento, status_pedido, created_at')
        .in('cliente_id', clienteIds);

      if (error) throw error;

      const statusCancelados = ['CANCELADO', 'GOLPE', 'GOLPE CANCELADO'];
      const statsMap = new Map<string, ClienteCRMBatchStats>();

      // Initialize all client IDs with empty stats
      for (const clienteId of clienteIds) {
        statsMap.set(clienteId, {
          clienteId,
          totalComprado: 0,
          pedidosPagos: 0,
          cancelamentos: 0,
          ultimaCompra: null,
          ultimoPedidoValor: null,
          ultimoPedidoStatus: null,
          ultimoPedidoPendenteValor: null,
          ultimoPedidoPendenteData: null,
        });
      }

      // Process orders
      for (const pedido of pedidos || []) {
        if (!pedido.cliente_id) continue;

        const clienteId = pedido.cliente_id;
        const stats = statsMap.get(clienteId);
        if (!stats) continue;

        const isPago = pedido.status_pagamento?.toUpperCase() === 'PAGO';
        const isCancelado = pedido.status_pedido && statusCancelados.includes(pedido.status_pedido.toUpperCase());
        const valorTotal = Number(pedido.valor_total) || 0;
        const createdAt = pedido.created_at ? new Date(pedido.created_at) : null;

        if (isPago) {
          stats.totalComprado += valorTotal;
          stats.pedidosPagos += 1;
        }

        if (isCancelado) {
          stats.cancelamentos += 1;
        }

        // Track the most recent order (any status)
        if (createdAt && (!stats.ultimaCompra || createdAt > stats.ultimaCompra)) {
          stats.ultimaCompra = createdAt;
          stats.ultimoPedidoValor = valorTotal;
          stats.ultimoPedidoStatus = pedido.status_pagamento || null;
        }

        // Track the most recent PENDING order
        const isPendente = pedido.status_pagamento?.toUpperCase() === 'PENDENTE';
        if (isPendente && createdAt) {
          if (!stats.ultimoPedidoPendenteData || createdAt > stats.ultimoPedidoPendenteData) {
            stats.ultimoPedidoPendenteData = createdAt;
            stats.ultimoPedidoPendenteValor = valorTotal;
          }
        }
      }

      return statsMap;
    },
    enabled: !!user && clienteIds.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });
}

/**
 * Hook to get IDs of clients that match a CRM status filter.
 * Used for hybrid filtering (server-side base + CRM filter).
 */
export function useClientesCRMFilter(filtroStatus: 'vip' | 'frequente' | 'inativo' | 'risco' | 'pendente' | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clientes-crm-filter', user?.id, filtroStatus],
    queryFn: async () => {
      if (!user?.id || !filtroStatus) {
        return null; // No filter applied
      }

      // Fetch all orders with minimal fields for filtering
      const { data: pedidos, error } = await supabase
        .from('pedidos')
        .select('cliente_id, valor_total, status_pagamento, status_pedido, created_at')
        .not('cliente_id', 'is', null);

      if (error) throw error;

      const statusCancelados = ['CANCELADO', 'GOLPE', 'GOLPE CANCELADO'];
      const statsMap = new Map<string, ClienteCRMBatchStats>();

      // Aggregate by cliente_id
      for (const pedido of pedidos || []) {
        if (!pedido.cliente_id) continue;

        const clienteId = pedido.cliente_id;
        
        if (!statsMap.has(clienteId)) {
          statsMap.set(clienteId, {
            clienteId,
            totalComprado: 0,
            pedidosPagos: 0,
            cancelamentos: 0,
            ultimaCompra: null,
            ultimoPedidoValor: null,
            ultimoPedidoStatus: null,
            ultimoPedidoPendenteValor: null,
            ultimoPedidoPendenteData: null,
          });
        }

        const stats = statsMap.get(clienteId)!;
        const isPago = pedido.status_pagamento?.toUpperCase() === 'PAGO';
        const isCancelado = pedido.status_pedido && statusCancelados.includes(pedido.status_pedido.toUpperCase());
        const valorTotal = Number(pedido.valor_total) || 0;
        const createdAt = pedido.created_at ? new Date(pedido.created_at) : null;

        if (isPago) {
          stats.totalComprado += valorTotal;
          stats.pedidosPagos += 1;
        }

        if (isCancelado) {
          stats.cancelamentos += 1;
        }

        if (createdAt && (!stats.ultimaCompra || createdAt > stats.ultimaCompra)) {
          stats.ultimaCompra = createdAt;
          stats.ultimoPedidoValor = valorTotal;
          stats.ultimoPedidoStatus = pedido.status_pagamento || null;
        }
      }

      // Filter based on status
      const matchingIds: string[] = [];
      const hoje = new Date();

      for (const [clienteId, stats] of statsMap) {
        const diasDesdeUltimaCompra = stats.ultimaCompra 
          ? differenceInDays(hoje, stats.ultimaCompra) 
          : Infinity;

        let matches = false;

        switch (filtroStatus) {
          case 'vip':
            matches = stats.totalComprado >= 10000;
            break;
          case 'frequente':
            matches = stats.pedidosPagos >= 5 && stats.totalComprado < 10000 && diasDesdeUltimaCompra <= 45;
            break;
          case 'inativo':
            matches = diasDesdeUltimaCompra > 45;
            break;
          case 'risco':
            matches = stats.cancelamentos >= 2;
            break;
          case 'pendente':
            matches = stats.ultimoPedidoStatus?.toUpperCase() === 'PENDENTE';
            break;
        }

        if (matches) {
          matchingIds.push(clienteId);
        }
      }

      return matchingIds;
    },
    enabled: !!user?.id && !!filtroStatus,
    staleTime: 60000,
  });
}
