import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { differenceInDays } from 'date-fns';

export interface ClienteCRMStats {
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

export interface CRMMetrics {
  totalClientes: number;
  ticketMedio: number;
  faturamentoTotal: number;
  ltvMedio: number;
  taxaRetencao: number;
  clientesPagantes: number;
}

export type ClienteStatus = {
  label: 'VIP' | 'Frequente' | 'Inativo';
  color: string;
} | null;

export function getClienteStatus(stats: ClienteCRMStats | undefined): ClienteStatus {
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

export function hasRiskAlert(stats: ClienteCRMStats | undefined): boolean {
  if (!stats) return false;
  return stats.cancelamentos >= 2;
}

const PAGE_SIZE = 1000;

async function fetchAllPedidos() {
  let allPedidos: any[] = [];
  let from = 0;
  let hasMore = true;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('pedidos')
      .select('cliente_id, valor_total, status_pagamento, status_pedido, created_at')
      .not('cliente_id', 'is', null)
      .range(from, from + PAGE_SIZE - 1);
    
    if (error) throw error;
    
    if (data && data.length > 0) {
      allPedidos = [...allPedidos, ...data];
      from += PAGE_SIZE;
      hasMore = data.length === PAGE_SIZE;
    } else {
      hasMore = false;
    }
  }
  
  return allPedidos;
}

export function useClientesCRM() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['clientes-crm', user?.id],
    queryFn: async () => {
      // Fetch ALL pedidos using pagination to avoid 1000 row limit
      const pedidos = await fetchAllPedidos();

      const statusCancelados = ['CANCELADO', 'GOLPE', 'GOLPE CANCELADO'];
      
      // Aggregate by cliente_id
      const statsMap = new Map<string, ClienteCRMStats>();
      
      let faturamentoTotal = 0;
      let totalPedidosPagos = 0;
      
      for (const pedido of pedidos || []) {
        if (!pedido.cliente_id) continue;
        
        const clienteId = pedido.cliente_id;
        const isPago = pedido.status_pagamento?.toUpperCase() === 'PAGO';
        const isCancelado = pedido.status_pedido && statusCancelados.includes(pedido.status_pedido.toUpperCase());
        const valorTotal = Number(pedido.valor_total) || 0;
        const createdAt = pedido.created_at ? new Date(pedido.created_at) : null;
        
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
        
        if (isPago) {
          stats.totalComprado += valorTotal;
          stats.pedidosPagos += 1;
          faturamentoTotal += valorTotal;
          totalPedidosPagos += 1;
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
      
      const clienteStats = Array.from(statsMap.values());
      const ticketMedio = totalPedidosPagos > 0 ? faturamentoTotal / totalPedidosPagos : 0;
      
      // Calculate LTV Médio: faturamentoTotal / clientes únicos que pagaram
      const clientesPagantes = clienteStats.filter(s => s.pedidosPagos > 0).length;
      const ltvMedio = clientesPagantes > 0 ? faturamentoTotal / clientesPagantes : 0;
      
      // Calculate Taxa de Retenção: % de clientes com 2+ pedidos pagos
      const clientesRecorrentes = clienteStats.filter(s => s.pedidosPagos >= 2).length;
      const taxaRetencao = clientesPagantes > 0 ? (clientesRecorrentes / clientesPagantes) * 100 : 0;
      
      return {
        stats: clienteStats,
        statsMap,
        metrics: {
          faturamentoTotal,
          ticketMedio,
          ltvMedio,
          taxaRetencao,
          clientesPagantes,
        } as Omit<CRMMetrics, 'totalClientes'>,
      };
    },
    enabled: !!user,
    staleTime: 60000, // Cache for 1 minute
  });
}
