import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ExcursaoResumo {
  nome: string;
  excursaoId: string | null;
  totalTaxa: number;
  numPedidos: number;
}

export interface TaxasExcursaoData {
  totalGeral: number;
  porExcursao: ExcursaoResumo[];
}

const STATUS_CANCELADOS = ["CANCELADO", "GOLPE CANCELADO", "GOLPE"];

async function fetchTaxasExcursao(userId: string): Promise<TaxasExcursaoData> {
  const { data, error } = await supabase
    .from("pedidos")
    .select("excursao, excursao_id, taxa_excursao, status_pedido, status_pagamento")
    .eq("user_id", userId)
    .eq("status_entrega", "NO CARRO")
    .gt("taxa_excursao", 0);

  if (error) throw error;

  const pedidos = (data || []).filter(p => {
    const statusPedido = (p.status_pedido || "").toUpperCase();
    const statusPag = (p.status_pagamento || "").toUpperCase();
    return !STATUS_CANCELADOS.includes(statusPedido) && !STATUS_CANCELADOS.includes(statusPag);
  });

  const grupoMap: Record<string, ExcursaoResumo> = {};

  pedidos.forEach(p => {
    const chave = p.excursao_id ?? `nome:${(p.excursao || "Sem excursão").toLowerCase().trim()}`;
    const nome = p.excursao || "Sem excursão";
    if (!grupoMap[chave]) {
      grupoMap[chave] = { nome, excursaoId: p.excursao_id ?? null, totalTaxa: 0, numPedidos: 0 };
    }
    grupoMap[chave].totalTaxa += p.taxa_excursao || 0;
    grupoMap[chave].numPedidos += 1;
  });

  const porExcursao = Object.values(grupoMap).sort((a, b) => b.totalTaxa - a.totalTaxa);
  const totalGeral = porExcursao.reduce((sum, e) => sum + e.totalTaxa, 0);

  return { totalGeral, porExcursao };
}

export function useTaxasExcursao() {
  const { user } = useAuth();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["taxas-excursao", user?.id],
    queryFn: () => fetchTaxasExcursao(user!.id),
    enabled: !!user,
    staleTime: 30000,
    retry: 2,
  });

  return {
    data: data ?? { totalGeral: 0, porExcursao: [] },
    loading,
  };
}
