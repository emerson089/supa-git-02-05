import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, subDays, startOfMonth, format, parseISO, differenceInDays, endOfDay, startOfWeek, startOfYear, getWeek, endOfMonth, subYears, getMonth, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";

export type Periodo = "hoje" | "7dias" | "mes" | "personalizado";

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

export type TipoAgrupamento = "dia" | "semana" | "mes";

interface KPIs {
  faturamento: number;
  faturamentoYoY: number; // Mesmo período do ano passado
  pecasVendidas: number;
  pecasYoY: number; // Mesmo período do ano passado
  pedidosPendentes: number;
  pedidosYoY: number; // Mesmo período do ano passado
  producaoAtiva: number;
  producaoYoY: number; // Mesmo período do ano passado
  anoPassado: number; // Ano de referência
}

export interface TendenciaVenda {
  dia: string;
  diaCompleto: string;
  valor: number;
  pedidos: number;
  pecas: number;
  dataOriginal: Date;
}

export interface EstoqueBaixoItem {
  id: string;
  nome: string;
  quantidade: number;
  quantidade_minima: number;
  imagem_url: string | null;
  status: "baixo" | "zerado" | "negativo";
}

export interface TopModelo {
  nome: string;
  quantidade: number;
}

export interface StatusPedido {
  status: string;
  count: number;
  color: string;
}

export interface ProducaoEtapa {
  etapa: string;
  pecas: number;
  color: string;
  isBottleneck: boolean;
}

export interface MetaYoY {
  metaAnual: number;              // Ano anterior + 15%
  faturamentoAnoPassado: number;  // Total do mês inteiro ano passado
  faturamentoAtualAcumulado: number; // Total acumulado até hoje
  faturamentoMesmoDiaAnoPassado: number; // Até o mesmo dia do ano passado
  percentualAtingido: number;     // % da meta atingida
  variacaoVsMesmoDia: number;     // Comparativo mesmo dia YoY
  faltaParaMeta: number;          // Quanto falta para atingir
  temDadosAnoPassado: boolean;    // Flag para fallback manual
  mesAtual: string;               // Nome do mês atual
  anoPassado: number;             // Ano anterior
}

interface DashboardData {
  kpis: KPIs;
  tendenciaVendas: TendenciaVenda[];
  estoqueBaixo: EstoqueBaixoItem[];
  topModelos: TopModelo[];
  statusPedidos: StatusPedido[];
  producaoKanban: ProducaoEtapa[];
  tipoAgrupamento: TipoAgrupamento;
  metaYoY: MetaYoY;
}

const ETAPA_COLORS: Record<string, string> = {
  "Corte": "hsl(var(--stage-corte))",
  "Costura": "hsl(var(--stage-costura))",
  "Lavanderia": "hsl(var(--stage-lavanderia))",
  "Acabamento": "hsl(var(--stage-acabamento))",
  "Concluído": "hsl(var(--stage-concluido))",
};

export const STATUS_COLORS: Record<string, string> = {
  "PAGO": "#22c55e",
  "PENDENTE": "#eab308",
  "INCOMPLETO": "#f97316",
  "PEND. ENTREGA": "#3b82f6",
  "CANCELADO": "#ef4444",
  "GOLPE CANCELADO": "#dc2626",
  "GOLPE": "#b91c1c",
};

const STATUS_CANCELADOS = ["CANCELADO", "GOLPE CANCELADO", "GOLPE"];

function getDateRange(periodo: Periodo, dateRange?: DateRange) {
  const now = new Date();

  // Custom date range
  if (periodo === "personalizado" && dateRange?.from && dateRange?.to) {
    const startDate = startOfDay(dateRange.from);
    const endDate = endOfDay(dateRange.to);
    const days = differenceInDays(endDate, startDate) + 1;
    const startDateAnterior = subDays(startDate, days);
    const endDateAnterior = subDays(endDate, days);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      startDateAnterior: startDateAnterior.toISOString(),
      endDateAnterior: endDateAnterior.toISOString(),
    };
  }

  let startDate: Date;
  let startDateAnterior: Date;
  let endDateAnterior: Date;

  switch (periodo) {
    case "hoje":
      startDate = startOfDay(now);
      startDateAnterior = startOfDay(subDays(now, 1));
      endDateAnterior = startOfDay(now);
      break;
    case "7dias":
      startDate = startOfDay(subDays(now, 7));
      startDateAnterior = startOfDay(subDays(now, 14));
      endDateAnterior = startOfDay(subDays(now, 7));
      break;
    case "mes":
    default:
      startDate = startOfMonth(now);
      startDateAnterior = startOfMonth(subDays(startOfMonth(now), 1));
      endDateAnterior = startOfMonth(now);
      break;
  }

  return {
    startDate: startDate.toISOString(),
    endDate: now.toISOString(),
    startDateAnterior: startDateAnterior.toISOString(),
    endDateAnterior: endDateAnterior.toISOString(),
  };
}

function getTipoAgrupamento(startDate: string, endDate: string): TipoAgrupamento {
  const dias = differenceInDays(new Date(endDate), new Date(startDate));
  if (dias > 90) return "mes";
  if (dias > 30) return "semana";
  return "dia";
}

function getEstoqueStatus(quantidade: number): "baixo" | "zerado" | "negativo" {
  if (quantidade < 0) return "negativo";
  if (quantidade === 0) return "zerado";
  return "baixo";
}

function detectBottlenecks(etapas: ProducaoEtapa[]): ProducaoEtapa[] {
  // Skip "Concluído" for bottleneck detection
  const activeEtapas = etapas.filter(e => e.etapa !== "Concluído");
  
  return etapas.map((etapa) => {
    if (etapa.etapa === "Concluído") {
      return { ...etapa, isBottleneck: false };
    }
    
    const currentIndex = activeEtapas.findIndex(e => e.etapa === etapa.etapa);
    if (currentIndex < activeEtapas.length - 1) {
      const nextEtapa = activeEtapas[currentIndex + 1];
      // Is bottleneck if has 100+ pieces AND more than 3x the next stage
      const isBottleneck = etapa.pecas > 100 && nextEtapa.pecas > 0 && etapa.pecas > nextEtapa.pecas * 3;
      return { ...etapa, isBottleneck };
    }
    return { ...etapa, isBottleneck: false };
  });
}

export function useDashboardData(
  periodo: Periodo,
  dateRange?: DateRange,
  excluirCancelados: boolean = true
) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    kpis: {
      faturamento: 0,
      faturamentoYoY: 0,
      pecasVendidas: 0,
      pecasYoY: 0,
      pedidosPendentes: 0,
      pedidosYoY: 0,
      producaoAtiva: 0,
      producaoYoY: 0,
      anoPassado: new Date().getFullYear() - 1,
    },
    tendenciaVendas: [],
    estoqueBaixo: [],
    topModelos: [],
    statusPedidos: [],
    producaoKanban: [],
    tipoAgrupamento: "dia",
    metaYoY: {
      metaAnual: 0,
      faturamentoAnoPassado: 0,
      faturamentoAtualAcumulado: 0,
      faturamentoMesmoDiaAnoPassado: 0,
      percentualAtingido: 0,
      variacaoVsMesmoDia: 0,
      faltaParaMeta: 0,
      temDadosAnoPassado: false,
      mesAtual: "",
      anoPassado: 0,
    },
  });

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);
      const { startDate, endDate, startDateAnterior, endDateAnterior } = getDateRange(periodo, dateRange);
      const tipoAgrupamento = getTipoAgrupamento(startDate, endDate);

      try {
        // Fetch all data in parallel
        // Meta YoY: calcular datas do mesmo mês do ano passado
        const now = new Date();
        const mesAtual = getMonth(now);
        const anoAtual = getYear(now);
        const anoPassado = anoAtual - 1;
        const nomeMesAtual = format(now, "MMMM", { locale: ptBR });
        
        // Mês completo do ano passado
        const inicioMesAnoPassado = new Date(anoPassado, mesAtual, 1);
        const fimMesAnoPassado = endOfMonth(inicioMesAnoPassado);
        
        // Início do mês atual
        const inicioMesAtual = startOfMonth(now);
        
        // Mesmo dia do ano passado
        const mesmoDiaAnoPassado = subYears(now, 1);
        const inicioMesmoDiaAnoPassado = new Date(anoPassado, mesAtual, 1);

        // YoY: Calcular datas para comparar mesmo período do ano passado
        const startDateYoY = subYears(new Date(startDate), 1).toISOString();
        const endDateYoY = subYears(new Date(endDate), 1).toISOString();

        const [
          pedidosAtual,
          pedidosYoY, // Mesmo período do ano passado (YoY)
          estoque,
          pedidoItens,
          producao,
          producaoYoY, // Produção do mesmo período do ano passado (YoY)
          pedidosMesAnoPassadoCompleto,
          pedidosMesAnoPassadoAteDia,
          pedidosMesAtualAcumulado,
        ] = await Promise.all([
          // Pedidos período atual
          supabase
            .from("pedidos")
            .select("valor_total, total_pecas, status_pagamento, status_pedido, created_at")
            .eq("user_id", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),

          // Pedidos mesmo período do ano passado (YoY)
          supabase
            .from("pedidos")
            .select("valor_total, total_pecas, status_pagamento, status_pedido")
            .eq("user_id", user.id)
            .gte("created_at", startDateYoY)
            .lte("created_at", endDateYoY),

          // Estoque baixo
          supabase
            .from("estoque_itens")
            .select("id, nome, quantidade, quantidade_minima, imagem_url")
            .eq("user_id", user.id)
            .order("quantidade", { ascending: true })
            .limit(10),

          // Itens de pedido para top modelos
          supabase
            .from("pedido_itens")
            .select("produto_nome, quantidade, pedidos!inner(user_id, created_at)")
            .eq("pedidos.user_id", user.id)
            .gte("pedidos.created_at", startDate),

          // Produção atual
          supabase
            .from("producao")
            .select("processo_atual, quantidade, created_date")
            .eq("user_id", user.id),

          // Produção mesmo período do ano passado (YoY)
          supabase
            .from("producao")
            .select("processo_atual, quantidade")
            .eq("user_id", user.id)
            .gte("created_date", startDateYoY)
            .lte("created_date", endDateYoY),

          // Meta YoY: Pedidos do mês completo do ano passado (status PAGO)
          supabase
            .from("pedidos")
            .select("valor_total")
            .eq("user_id", user.id)
            .eq("status_pagamento", "PAGO")
            .gte("created_at", inicioMesAnoPassado.toISOString())
            .lte("created_at", fimMesAnoPassado.toISOString()),

          // Meta YoY: Pedidos até o mesmo dia do ano passado
          supabase
            .from("pedidos")
            .select("valor_total")
            .eq("user_id", user.id)
            .eq("status_pagamento", "PAGO")
            .gte("created_at", inicioMesmoDiaAnoPassado.toISOString())
            .lte("created_at", mesmoDiaAnoPassado.toISOString()),

          // Meta YoY: Faturamento acumulado do mês atual
          supabase
            .from("pedidos")
            .select("valor_total")
            .eq("user_id", user.id)
            .eq("status_pagamento", "PAGO")
            .gte("created_at", inicioMesAtual.toISOString())
            .lte("created_at", now.toISOString()),
        ]);

        // Calculate KPIs
        const pedidosAtualData = pedidosAtual.data || [];
        const pedidosYoYData = pedidosYoY.data || [];

        // Filter out canceled orders if excluirCancelados is true
        const pedidosFiltrados = excluirCancelados
          ? pedidosAtualData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
          : pedidosAtualData;

        const pedidosYoYFiltrados = excluirCancelados
          ? pedidosYoYData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
          : pedidosYoYData;

        const faturamento = pedidosFiltrados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
        const faturamentoYoY = pedidosYoYFiltrados.reduce((sum, p) => sum + (p.valor_total || 0), 0);
        const pecasVendidas = pedidosFiltrados.reduce((sum, p) => sum + (p.total_pecas || 0), 0);
        const pecasYoY = pedidosYoYFiltrados.reduce((sum, p) => sum + (p.total_pecas || 0), 0);
        const pedidosPendentes = pedidosAtualData.filter(p => p.status_pagamento === "PENDENTE" || p.status_pagamento === "INCOMPLETO").length;
        const pedidosYoYPendentes = pedidosYoYData.filter(p => p.status_pagamento === "PENDENTE" || p.status_pagamento === "INCOMPLETO").length;

        const producaoData = producao.data || [];
        const producaoYoYData = producaoYoY.data || [];
        const producaoAtiva = producaoData.filter(p => p.processo_atual !== "Concluído").reduce((sum, p) => sum + (p.quantidade || 0), 0);
        const producaoYoYAtiva = producaoYoYData.filter(p => p.processo_atual !== "Concluído").reduce((sum, p) => sum + (p.quantidade || 0), 0);

        // Tendência de vendas (grouped by tipoAgrupamento)
        const vendasAgrupadas: Record<string, { valor: number; pedidos: number; pecas: number; data: Date }> = {};
        
        pedidosFiltrados.forEach(p => {
          const dataCompleta = parseISO(p.created_at);
          let chave: string;
          
          switch (tipoAgrupamento) {
            case "mes":
              chave = format(dataCompleta, "MMM/yy", { locale: ptBR });
              break;
            case "semana":
              chave = `Sem ${getWeek(dataCompleta)}`;
              break;
            default:
              chave = format(dataCompleta, "dd/MM");
          }
          
          if (!vendasAgrupadas[chave]) {
            vendasAgrupadas[chave] = { valor: 0, pedidos: 0, pecas: 0, data: dataCompleta };
          }
          vendasAgrupadas[chave].valor += p.valor_total || 0;
          vendasAgrupadas[chave].pedidos += 1;
          vendasAgrupadas[chave].pecas += p.total_pecas || 0;
        });

        const tendenciaVendas: TendenciaVenda[] = Object.entries(vendasAgrupadas)
          .map(([dia, dados]) => {
            let diaCompleto: string;
            switch (tipoAgrupamento) {
              case "mes":
                diaCompleto = format(dados.data, "MMMM 'de' yyyy", { locale: ptBR });
                break;
              case "semana":
                diaCompleto = `Semana ${getWeek(dados.data)} de ${format(dados.data, "yyyy")}`;
                break;
              default:
                diaCompleto = format(dados.data, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
            }
            return {
              dia,
              diaCompleto,
              valor: dados.valor,
              pedidos: dados.pedidos,
              pecas: dados.pecas,
              dataOriginal: dados.data,
            };
          })
          .sort((a, b) => a.dataOriginal.getTime() - b.dataOriginal.getTime());

        // Estoque baixo (filtrar onde quantidade < quantidade_minima)
        const estoqueData = estoque.data || [];
        const estoqueBaixo: EstoqueBaixoItem[] = estoqueData
          .filter(item => item.quantidade < (item.quantidade_minima || 0))
          .map(item => ({
            ...item,
            status: getEstoqueStatus(item.quantidade),
          }))
          .slice(0, 5);

        // Top modelos
        const modelosMap: Record<string, number> = {};
        (pedidoItens.data || []).forEach(item => {
          const nome = item.produto_nome || "Sem nome";
          modelosMap[nome] = (modelosMap[nome] || 0) + (item.quantidade || 0);
        });
        const topModelos = Object.entries(modelosMap)
          .map(([nome, quantidade]) => ({ nome, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 5);

        // Status de pedidos
        const statusMap: Record<string, number> = {};
        pedidosAtualData.forEach(p => {
          const status = p.status_pagamento || "PENDENTE";
          statusMap[status] = (statusMap[status] || 0) + 1;
        });
        const statusPedidos = Object.entries(statusMap).map(([status, count]) => ({
          status,
          count,
          color: STATUS_COLORS[status] || "hsl(var(--muted))",
        }));

        // Produção por etapa com detecção de gargalos
        const etapaMap: Record<string, number> = {};
        producaoData.forEach(p => {
          const etapa = p.processo_atual || "Corte";
          etapaMap[etapa] = (etapaMap[etapa] || 0) + (p.quantidade || 0);
        });
        const producaoKanbanBase = ["Corte", "Costura", "Lavanderia", "Acabamento", "Concluído"].map(etapa => ({
          etapa,
          pecas: etapaMap[etapa] || 0,
          color: ETAPA_COLORS[etapa] || "hsl(var(--muted))",
          isBottleneck: false,
        }));
        const producaoKanban = detectBottlenecks(producaoKanbanBase);

        // Calcular Meta YoY
        const faturamentoAnoPassadoTotal = (pedidosMesAnoPassadoCompleto.data || []).reduce(
          (sum, p) => sum + (p.valor_total || 0), 0
        );
        const faturamentoMesmoDiaAnoPassadoTotal = (pedidosMesAnoPassadoAteDia.data || []).reduce(
          (sum, p) => sum + (p.valor_total || 0), 0
        );
        const faturamentoAtualAcumulado = (pedidosMesAtualAcumulado.data || []).reduce(
          (sum, p) => sum + (p.valor_total || 0), 0
        );
        
        const temDadosAnoPassado = faturamentoAnoPassadoTotal > 0;
        const metaAnual = faturamentoAnoPassadoTotal * 1.15; // +15%
        const percentualAtingido = metaAnual > 0 ? (faturamentoAtualAcumulado / metaAnual) * 100 : 0;
        const faltaParaMeta = Math.max(0, faturamentoAnoPassadoTotal - faturamentoAtualAcumulado);
        const variacaoVsMesmoDia = faturamentoMesmoDiaAnoPassadoTotal > 0 
          ? ((faturamentoAtualAcumulado - faturamentoMesmoDiaAnoPassadoTotal) / faturamentoMesmoDiaAnoPassadoTotal) * 100
          : 0;

        setData({
          kpis: {
            faturamento,
            faturamentoYoY,
            pecasVendidas,
            pecasYoY,
            pedidosPendentes,
            pedidosYoY: pedidosYoYPendentes,
            producaoAtiva,
            producaoYoY: producaoYoYAtiva,
            anoPassado,
          },
          tendenciaVendas,
          estoqueBaixo,
          topModelos,
          statusPedidos,
          producaoKanban,
          tipoAgrupamento,
          metaYoY: {
            metaAnual,
            faturamentoAnoPassado: faturamentoAnoPassadoTotal,
            faturamentoAtualAcumulado,
            faturamentoMesmoDiaAnoPassado: faturamentoMesmoDiaAnoPassadoTotal,
            percentualAtingido,
            variacaoVsMesmoDia,
            faltaParaMeta,
            temDadosAnoPassado,
            mesAtual: nomeMesAtual,
            anoPassado,
          },
        });
      } catch (error) {
        console.error("Erro ao buscar dados do dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, periodo, dateRange?.from?.getTime(), dateRange?.to?.getTime(), excluirCancelados]);

  return { data, loading };
}
