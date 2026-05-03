import { useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";
import type { Holiday } from "@/hooks/useHolidays";
import type {
  MetaAutomatica,
  EstoqueBaixoItem,
  TopModelo,
  FaturamentoDiaSemana,
} from "@/hooks/useDashboardData";
import { TrendMode } from "./useSalesTrendChart";

export interface InsightItem {
  id: string;
  tipo: "alerta" | "positivo" | "info" | "neutro";
  prioridade: "critico" | "atencao" | "contexto";
  mensagem: string;
  icone: "trending-down" | "trending-up" | "alert" | "package" | "check";
}

export interface InsightsDashboardResult {
  insights: InsightItem[];
  resumoExecutivo: string;
  sugestaoFoco: string | null;
}

interface InsightsDashboardParams {
  kpis: {
    faturamento: number;
    pedidosPendentes: number;
  };
  metaAutomatica: MetaAutomatica;
  tendenciaVendas: { atual: number }[];
  estoqueBaixo: EstoqueBaixoItem[];
  topModelos: TopModelo[];
  faturamentoDiaSemana: FaturamentoDiaSemana[];
  holidayMap: Map<string, Holiday[]>;
  dateRange?: { from?: Date; to?: Date };
  loading: boolean;
  trendMode: TrendMode;
  excluirCancelados: boolean;
  chartTotals?: { atual: number; anterior: number; deltaPct: number | null };
  currentLabel?: string;
  previousLabel?: string;
}

const MESES_PT: Record<number, string> = {
  0: "janeiro", 1: "fevereiro", 2: "março", 3: "abril",
  4: "maio", 5: "junho", 6: "julho", 7: "agosto",
  8: "setembro", 9: "outubro", 10: "novembro", 11: "dezembro",
};

function formatCurrencyShort(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

const PRIORIDADE_ORDER: Record<InsightItem["prioridade"], number> = {
  critico: 0,
  atencao: 1,
  contexto: 2,
};

const ATENCAO_IDS = new Set(["meta-abaixo-leve", "concentracao-dia", "meta-atingida", "meta-acima", "trend-comparativo"]);
const CONTEXTO_IDS = new Set(["historico-mes", "feriados-periodo", "sem-anomalias", "ticket-medio"]);

function getPrioridade(tipo: InsightItem["tipo"], id: string): InsightItem["prioridade"] {
  if (tipo === "alerta") return "critico";
  if (CONTEXTO_IDS.has(id) || tipo === "neutro") return "contexto";
  if (ATENCAO_IDS.has(id) || tipo === "positivo") return "atencao";
  return "contexto";
}

const FOCO_MAP: Record<string, string> = {
  "meta-abaixo": "Prioridade: investigar a queda de faturamento em relação ao ritmo sazonal.",
  "estoque-top-zerado": "Prioridade: repor estoque dos modelos mais vendidos para evitar perda de vendas.",
  "tendencia-queda": "Prioridade: entender a queda consecutiva dos últimos períodos.",
  "pendentes-alto": "Prioridade: acionar cobrança dos pedidos pendentes acumulados.",
  "trend-comparativo-queda": "Prioridade: analisar os fatores da queda comparado ao período equivalente anterior.",
};

export function useInsightsDashboard(params: InsightsDashboardParams): InsightsDashboardResult {
  const {
    kpis,
    metaAutomatica,
    tendenciaVendas,
    estoqueBaixo,
    topModelos,
    faturamentoDiaSemana,
    holidayMap,
    dateRange,
    loading,
    trendMode,
    chartTotals,
    currentLabel,
    previousLabel,
  } = params;

  return useMemo(() => {
    const empty: InsightsDashboardResult = {
      insights: [],
      resumoExecutivo: "Desempenho dentro do esperado para o período analisado.",
      sugestaoFoco: null,
    };

    if (loading) return empty;

    const raw: Omit<InsightItem, "prioridade">[] = [];

    // 1. Ritmo vs Meta
    if (metaAutomatica.metaCalculada > 0) {
      if (metaAutomatica.statusMeta === "atingida") {
        raw.push({
          id: "meta-atingida",
          tipo: "positivo",
          mensagem: `Meta mensal atingida! Faturamento atual: ${formatCurrencyShort(metaAutomatica.faturamentoAtualMes)}.`,
          icone: "check",
        });
      } else if (metaAutomatica.statusMeta === "acima") {
        raw.push({
          id: "meta-acima",
          tipo: "positivo",
          mensagem: `Faturamento acima do ritmo esperado (+${Math.abs(metaAutomatica.diferencaRitmo).toFixed(0)}pp). Projeção de ${formatCurrencyShort(metaAutomatica.faturamentoAtualMes / (metaAutomatica.percentualRealizado || 1) * 100)} para o mês.`,
          icone: "trending-up",
        });
      } else if (metaAutomatica.statusMeta === "abaixo" && metaAutomatica.diferencaRitmo < -10) {
        raw.push({
          id: "meta-abaixo",
          tipo: "alerta",
          mensagem: `Faturamento significativamente abaixo do ritmo sazonal (${metaAutomatica.diferencaRitmo.toFixed(0)}pp). Queda pode estar concentrada nos últimos dias.`,
          icone: "trending-down",
        });
      } else if (metaAutomatica.statusMeta === "abaixo") {
        raw.push({
          id: "meta-abaixo-leve",
          tipo: "info",
          mensagem: `Faturamento levemente abaixo do ritmo esperado (${metaAutomatica.diferencaRitmo.toFixed(0)}pp). Acompanhe nos próximos dias.`,
          icone: "trending-down",
        });
      }
    }

    function normalizeStr(s: string): string {
      return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    }
    const topNomesNorm = new Set(topModelos.map((m) => normalizeStr(m.nome)));
    const modelosZeradosTop = estoqueBaixo
      .filter((e) => e.quantidade <= 0 && topNomesNorm.has(normalizeStr(e.nome)))
      .map((e) => e.nome);

    if (modelosZeradosTop.length > 0) {
      const nomes = modelosZeradosTop.slice(0, 2).join("' e '");
      raw.push({
        id: "estoque-top-zerado",
        tipo: "alerta",
        mensagem: `Modelo '${nomes}' está entre os mais vendidos mas com estoque zerado. Pode estar perdendo vendas.`,
        icone: "package",
      });
    }

    const totalFatSemana = faturamentoDiaSemana.reduce((s, d) => s + d.valor, 0);
    if (totalFatSemana > 0) {
      const diaConcentrado = faturamentoDiaSemana.find((d) => d.percentual > 65);
      if (diaConcentrado) {
        raw.push({
          id: "concentracao-dia",
          tipo: "info",
          mensagem: `${diaConcentrado.percentual.toFixed(0)}% do faturamento está concentrado em ${diaConcentrado.diaSemana}. Concentração atípica — considere ações para distribuir vendas ao longo da semana.`,
          icone: "alert",
        });
      }
    }

    if (tendenciaVendas.length >= 3) {
      const ultimos3 = tendenciaVendas.slice(-3);
      const quedaConsecutiva =
        ultimos3[2].atual < ultimos3[1].atual && ultimos3[1].atual < ultimos3[0].atual;
      if (quedaConsecutiva && ultimos3[0].atual > 0) {
        raw.push({
          id: "tendencia-queda",
          tipo: "alerta",
          mensagem: `Queda consecutiva de faturamento nos últimos 3 períodos. Verifique possíveis causas.`,
          icone: "trending-down",
        });
      }
    }

    if (kpis.pedidosPendentes > 20) {
      raw.push({
        id: "pendentes-alto",
        tipo: "alerta",
        mensagem: `Existem ${kpis.pedidosPendentes} pedidos pendentes de pagamento no período. Considere ação de cobrança.`,
        icone: "alert",
      });
    }

    const totalPedidosPeriodo = faturamentoDiaSemana.reduce((sum, d) => sum + d.pedidos, 0);
    if (totalPedidosPeriodo > 0 && kpis.faturamento > 0) {
      const ticketMedio = kpis.faturamento / totalPedidosPeriodo;
      raw.push({
        id: "ticket-medio",
        tipo: "info",
        mensagem: `Ticket médio de ${formatCurrencyShort(ticketMedio)} por pedido no período (${totalPedidosPeriodo} pedidos pagos).`,
        icone: "check",
      });
    }

    // Comparação do Gráfico Tendência de Vendas
    let isQuedaTrend = false;
    if (chartTotals && chartTotals.deltaPct !== null && currentLabel && previousLabel) {
      const absDelta = Math.abs(chartTotals.deltaPct).toFixed(0);
      const isQueda = chartTotals.deltaPct < 0;
      isQuedaTrend = isQueda;

      let msg = "";
      if (trendMode.granularity === 'year') {
        msg = `Faturamento ${absDelta}% ${isQueda ? 'abaixo' : 'acima'} de ${previousLabel}.`;
      } else if (trendMode.granularity === 'month') {
        if (trendMode.submode === 'yoy') {
          msg = `Faturamento ${absDelta}% ${isQueda ? 'abaixo' : 'acima'} dos mesmos dias de ${previousLabel}.`;
        } else {
          msg = `Faturamento ${absDelta}% ${isQueda ? 'abaixo' : 'acima'} dos mesmos dias de ${previousLabel}.`;
        }
      } else if (trendMode.granularity === 'week') {
        if (trendMode.submode === 'wow') {
          msg = `Faturamento ${absDelta}% ${isQueda ? 'abaixo' : 'acima'} da ${previousLabel}.`;
        } else {
          msg = `${currentLabel} ${absDelta}% ${isQueda ? 'abaixo' : 'acima'} da ${previousLabel}.`;
        }
      }

      if (isQueda && chartTotals.deltaPct < -10) {
        raw.push({
          id: "trend-comparativo-queda",
          tipo: "alerta",
          mensagem: msg,
          icone: "trending-down",
        });
      } else if (!isQueda && chartTotals.deltaPct > 10) {
        raw.push({
          id: "trend-comparativo",
          tipo: "positivo",
          mensagem: msg,
          icone: "trending-up",
        });
      }
    }

    if (metaAutomatica.temHistoricoSazonal && metaAutomatica.anosUsados.length > 0) {
      const mesNome = MESES_PT[new Date().getMonth()] || "";
      const nAnos = metaAutomatica.anosUsados.length;
      const periodoStr = nAnos === 1 ? "no último ano" : `nos últimos ${nAnos} anos`;
      raw.push({
        id: "historico-mes",
        tipo: "info",
        mensagem: `Historicamente, ${mesNome} teve faturamento médio de ${formatCurrencyShort(metaAutomatica.mediaBase)} ${periodoStr}.`,
        icone: "check",
      });
    }

    if (holidayMap.size > 0 && dateRange?.from && dateRange?.to) {
      try {
        const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        const feriadosNoPeriodo: string[] = [];
        for (const day of days) {
          const key = format(day, "yyyy-MM-dd");
          const holidays = holidayMap.get(key);
          if (holidays) {
            const nationals = holidays.filter((h) => h.type === "national");
            for (const n of nationals) {
              if (!feriadosNoPeriodo.includes(n.title)) {
                feriadosNoPeriodo.push(n.title);
              }
            }
          }
        }
        if (feriadosNoPeriodo.length > 0) {
          raw.push({
            id: "feriados-periodo",
            tipo: "info",
            mensagem: `Período inclui ${feriadosNoPeriodo.slice(0, 3).join(", ")}. Isso pode impactar o volume de vendas.`,
            icone: "alert",
          });
        }
      } catch {
        // ignore invalid intervals
      }
    }

    const insights: InsightItem[] = raw
      .map((item) => ({ ...item, prioridade: getPrioridade(item.tipo, item.id) }))
      .sort((a, b) => PRIORIDADE_ORDER[a.prioridade] - PRIORIDADE_ORDER[b.prioridade])
      .slice(0, 4);

    if (insights.length === 0) {
      insights.push({
        id: "sem-anomalias",
        tipo: "neutro",
        prioridade: "contexto",
        mensagem: "Desempenho dentro do esperado para o período analisado.",
        icone: "check",
      });
    }

    let resumoExecutivo = "Desempenho dentro do esperado para o período analisado.";
    if (metaAutomatica.metaCalculada > 0) {
      if (metaAutomatica.statusMeta === "atingida" || metaAutomatica.statusMeta === "acima") {
        resumoExecutivo = "Desempenho positivo no período — faturamento acima do ritmo esperado.";
      } else if (metaAutomatica.statusMeta === "abaixo" && metaAutomatica.diferencaRitmo < -10) {
        resumoExecutivo = "Período com desempenho abaixo do esperado — faturamento significativamente abaixo do ritmo sazonal.";
      } else if (metaAutomatica.statusMeta === "abaixo") {
        resumoExecutivo = "Desempenho levemente abaixo do ritmo esperado para o período.";
      }
    }

    if (isQuedaTrend && resumoExecutivo.includes("positivo")) {
      resumoExecutivo = "Faturamento acima do ritmo sazonal, mas abaixo do mesmo período anterior.";
    }

    const firstCritico = insights.find((i) => i.prioridade === "critico");
    const sugestaoFoco = firstCritico ? (FOCO_MAP[firstCritico.id] ?? null) : null;

    return { insights, resumoExecutivo, sugestaoFoco };
  }, [
    loading,
    kpis.faturamento,
    kpis.pedidosPendentes,
    metaAutomatica,
    tendenciaVendas,
    estoqueBaixo,
    topModelos,
    faturamentoDiaSemana,
    holidayMap,
    dateRange?.from,
    dateRange?.to,
    trendMode,
    chartTotals,
    currentLabel,
    previousLabel,
  ]);
}
