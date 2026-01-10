import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ClienteInsights {
  totalPedidos: number;
  valorAcumulado: number;
  totalPecas: number;
  pedidosCancelados: number;
}

export function useClienteInsights(clienteId: string | null) {
  return useQuery({
    queryKey: ['cliente-insights', clienteId],
    queryFn: async (): Promise<ClienteInsights | null> => {
      if (!clienteId) return null;

      const { data, error } = await supabase
        .from('pedidos')
        .select('valor_total, total_pecas, status_pedido')
        .eq('cliente_id', clienteId);

      if (error) throw error;

      const pedidos = data || [];
      const statusCancelados = ['CANCELADO', 'GOLPE', 'GOLPE CANCELADO'];

      return {
        totalPedidos: pedidos.length,
        valorAcumulado: pedidos.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0),
        totalPecas: pedidos.reduce((sum, p) => sum + (Number(p.total_pecas) || 0), 0),
        pedidosCancelados: pedidos.filter(p => 
          p.status_pedido && statusCancelados.includes(p.status_pedido.toUpperCase())
        ).length,
      };
    },
    enabled: !!clienteId,
    staleTime: 30000, // Cache por 30 segundos
  });
}
