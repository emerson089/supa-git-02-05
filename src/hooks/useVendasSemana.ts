import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function getWeekRange() {
  const hoje = new Date();
  const diaSemana = hoje.getDay(); // 0=dom, 1=seg...
  const segunda = new Date(hoje);
  segunda.setDate(hoje.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  segunda.setHours(0, 0, 0, 0);

  const domingo = new Date(segunda);
  domingo.setDate(segunda.getDate() + 6);
  domingo.setHours(23, 59, 59, 999);

  return { segunda, domingo };
}

async function fetchVendasSemana(): Promise<Map<string, number>> {
  const { segunda, domingo } = getWeekRange();

  const { data, error } = await supabase
    .from('pedidos')
    .select('pedido_itens(produto_id, quantidade)')
    .gte('created_at', segunda.toISOString())
    .lte('created_at', domingo.toISOString());

  if (error) throw error;

  const map = new Map<string, number>();
  data?.forEach((pedido: any) => {
    pedido.pedido_itens?.forEach((item: any) => {
      if (!item.produto_id) return;
      map.set(item.produto_id, (map.get(item.produto_id) || 0) + item.quantidade);
    });
  });

  return map;
}

export function useVendasSemana() {
  return useQuery({
    queryKey: ['vendas-semana'],
    queryFn: fetchVendasSemana,
    staleTime: 5 * 60 * 1000, // 5 min
    refetchOnWindowFocus: false,
  });
}
