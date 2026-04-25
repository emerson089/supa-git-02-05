import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function getWeekRange(weeksAgo = 0) {
  const ref = new Date();
  ref.setDate(ref.getDate() - weeksAgo * 7);
  const diaSemana = ref.getDay();
  const segunda = new Date(ref);
  segunda.setDate(ref.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  segunda.setHours(0, 0, 0, 0);
  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);
  return { segunda, domingo };
}

function toMap(data: any[]): Map<string, number> {
  const map = new Map<string, number>();
  data?.forEach((pedido: any) => {
    pedido.pedido_itens?.forEach((item: any) => {
      if (!item.produto_id) return;
      map.set(item.produto_id, (map.get(item.produto_id) || 0) + item.quantidade);
    });
  });
  return map;
}

export interface VendasSemanaData {
  semanaAtual: Map<string, number>;
  semanaAnterior: Map<string, number>;
}

async function fetchVendasSemana(userId: string): Promise<VendasSemanaData> {
  const { segunda: seg0, domingo: dom0 } = getWeekRange(0);
  const { segunda: seg1, domingo: dom1 } = getWeekRange(1);

  const [atual, anterior] = await Promise.all([
    supabase
      .from('pedidos')
      .select('pedido_itens(produto_id, quantidade)')
      .eq('user_id', userId)
      .in('status_pagamento', ['PAGO', 'CONCLUIDO', 'PEND. ENTREGA'])
      .gte('created_at', seg0.toISOString())
      .lte('created_at', dom0.toISOString()),

    supabase
      .from('pedidos')
      .select('pedido_itens(produto_id, quantidade)')
      .eq('user_id', userId)
      .in('status_pagamento', ['PAGO', 'CONCLUIDO', 'PEND. ENTREGA'])
      .gte('created_at', seg1.toISOString())
      .lte('created_at', dom1.toISOString()),
  ]);

  return {
    semanaAtual: toMap(atual.data || []),
    semanaAnterior: toMap(anterior.data || []),
  };
}

export function useVendasSemana() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['vendas-semana', user?.id],
    queryFn: () => fetchVendasSemana(user!.id),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
