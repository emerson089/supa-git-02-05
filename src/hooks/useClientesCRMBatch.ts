import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays, startOfMonth } from 'date-fns';

export interface ClienteCRMBatchStats {
  clienteId: string;
  totalComprado: number;
  pedidosPagos: number;
  cancelamentos: number;
  ultimaCompra: Date | null;
  ultimaCompraReal: Date | null;
  ultimoPedidoValor: number | null;
  ultimoPedidoStatus: string | null;
  ultimoPedidoPendenteValor: number | null;
  ultimoPedidoPendenteData: Date | null;
  createdAt?: Date;
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

  // Inativo: Última compra há 25 dias ou mais (excluir quem nunca comprou)
  if (diasDesdeUltimaCompra >= 25 && diasDesdeUltimaCompra !== Infinity) {
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
          ultimaCompraReal: null,
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
        const isPendente = pedido.status_pagamento?.toUpperCase() === 'PENDENTE' && !isCancelado;
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

        // Track the last REAL activity (Paid or Valid Pending)
        const isValidActivity = isPago || (isPendente && !isCancelado);
        if (isValidActivity && createdAt && (!stats.ultimaCompraReal || createdAt > stats.ultimaCompraReal)) {
          stats.ultimaCompraReal = createdAt;
        }

        // Track the most recent PENDING order
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

interface ClienteWithPendingDate {
  id: string;
  oldestPendingDate: Date | null;
  totalComprado: number;
  diasDesdeUltimaCompra?: number;
}

const PAGE_SIZE_CRM = 1000;

async function fetchAllPedidosMinimal(userId: string) {
  let allPedidos: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('cliente_id, valor_total, status_pagamento, status_pedido, created_at')
      .eq('user_id', userId)
      .not('cliente_id', 'is', null)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE_CRM - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allPedidos = [...allPedidos, ...data];
      from += PAGE_SIZE_CRM;
      hasMore = data.length === PAGE_SIZE_CRM;
    } else {
      hasMore = false;
    }
  }
  return allPedidos;
}
async function fetchAllClientesMinimal(userId: string) {
  let allClientes: { id: string; created_at: string }[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, created_at, user_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE_CRM - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allClientes = [...allClientes, ...data];
      from += PAGE_SIZE_CRM;
      hasMore = data.length === PAGE_SIZE_CRM;
    } else {
      hasMore = false;
    }
  }
  return allClientes;
}

/**
 * Hook to get IDs of clients that match a CRM status filter.
 * Used for hybrid filtering (server-side base + CRM filter).
 * Returns IDs sorted appropriately (e.g., oldest pending first for 'pendente' filter,
 * or highest total purchased for 'maior_historico' sorting).
 */
export function useClientesCRMFilter(
  filtroStatus: 'vip' | 'frequente' | 'risco' | 'pendente' | 'sem_compras' | 'novos' | 'top_pareto' | 'inativo_mes' | null,
  ordenacao?: 'nome' | 'recente' | 'maior_historico'
) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clientes-crm-filter', user?.id, filtroStatus, ordenacao],
    queryFn: async () => {
      if (!user?.id || !filtroStatus) {
        return null; // No filter applied
      }

      // STEP 1: Fetch all client IDs for this user first
      // This ensures clients with no orders are also evaluated
      const allClientes = await fetchAllClientesMinimal(user.id);
      if (!allClientes || allClientes.length === 0) return [];

      // STEP 2: Fetch all orders with minimal fields for filtering
      const pedidos = await fetchAllPedidosMinimal(user.id);

      const statusCancelados = ['CANCELADO', 'GOLPE', 'GOLPE CANCELADO'];
      const statsMap = new Map<string, ClienteCRMBatchStats>();

      // STEP 3: Initialize statsMap with ALL clients (including those with no orders)
      // Clients with no orders will have ultimaCompra = null → infinite days inactive
      for (const cliente of allClientes) {
        statsMap.set(cliente.id, {
          clienteId: cliente.id,
          totalComprado: 0,
          pedidosPagos: 0,
          cancelamentos: 0,
          ultimaCompra: null,
          ultimaCompraReal: null,
          ultimoPedidoValor: null,
          ultimoPedidoStatus: null,
          ultimoPedidoPendenteValor: null,
          ultimoPedidoPendenteData: null,
          createdAt: new Date(cliente.created_at),
        });
      }

      // STEP 4: Update stats for clients that have orders
      for (const pedido of pedidos) {
        if (!pedido.cliente_id) continue;

        const stats = statsMap.get(pedido.cliente_id);
        if (!stats) continue; // Order belongs to a client not in our list

        const isPago = pedido.status_pagamento?.toUpperCase() === 'PAGO';
        const isCancelado = pedido.status_pedido && statusCancelados.includes(pedido.status_pedido.toUpperCase());
        const isPendente = pedido.status_pagamento?.toUpperCase() === 'PENDENTE' && !isCancelado;
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

        // Track the last REAL activity (Paid or Valid Pending)
        const isValidActivity = isPago || (isPendente && !isCancelado);
        if (isValidActivity && createdAt && (!stats.ultimaCompraReal || createdAt > stats.ultimaCompraReal)) {
          stats.ultimaCompraReal = createdAt;
        }

        // Track the OLDEST pending order for sorting
        if (isPendente && createdAt) {
          if (!stats.ultimoPedidoPendenteData || createdAt < stats.ultimoPedidoPendenteData) {
            stats.ultimoPedidoPendenteData = createdAt;
            stats.ultimoPedidoPendenteValor = valorTotal;
          }
        }
      }

      // Filter based on status
      const matchingClients: ClienteWithPendingDate[] = [];
      const hoje = new Date();

      // For Pareto: Calculate the threshold for top 20% revenue
      let paretoThreshold = Infinity;
      if (filtroStatus === 'top_pareto') {
        const revenues = Array.from(statsMap.values())
          .map(s => s.totalComprado)
          .sort((a, b) => b - a);
        const top20n = Math.max(1, Math.ceil(allClientes.length * 0.2));
        paretoThreshold = revenues[top20n - 1] || 0;
      }

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
            matches = stats.pedidosPagos >= 5 && stats.totalComprado < 10000 && diasDesdeUltimaCompra < 25;
            break;
          case 'risco':
            matches = stats.cancelamentos >= 2;
            break;
          case 'pendente':
            matches = stats.ultimoPedidoPendenteData !== null;
            break;
          case 'sem_compras':
            matches = stats.totalComprado === 0 && stats.ultimaCompra === null;
            break;
          case 'novos':
            matches = differenceInDays(hoje, stats.createdAt) < 7;
            break;
          case 'top_pareto':
            matches = stats.totalComprado >= paretoThreshold && stats.totalComprado > 0;
            break;
          case 'inativo_mes':
            // Clientes que nunca compraram REALMENTE OU cuja última compra VÁLIDA foi antes do mês atual
            matches = !stats.ultimaCompraReal || stats.ultimaCompraReal < startOfMonth(hoje);
            break;
        }

        if (matches) {
          matchingClients.push({
            id: clienteId,
            oldestPendingDate: stats.ultimoPedidoPendenteData,
            totalComprado: stats.totalComprado,
            diasDesdeUltimaCompra,
          });
        }
      }

      // Sort by oldest pending date first (for 'pendente' filter)
      if (filtroStatus === 'pendente') {
        matchingClients.sort((a, b) => {
          if (!a.oldestPendingDate) return 1;
          if (!b.oldestPendingDate) return -1;
          return a.oldestPendingDate.getTime() - b.oldestPendingDate.getTime();
        });
      } else if (ordenacao === 'maior_historico') {
        // Sort by highest total purchased globally
        matchingClients.sort((a, b) => b.totalComprado - a.totalComprado);
      }

      if (matchingClients.length === 0 && filtroStatus) {
        console.log(`[CRM Filter] Nenhum cliente encontrado para o filtro: ${filtroStatus}`);
      }

      return matchingClients.map(c => c.id);
    },
    enabled: !!user?.id && !!filtroStatus,
    staleTime: 60000,
  });
}
