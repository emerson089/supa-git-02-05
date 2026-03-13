import { useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";
import type { Holiday } from "@/hooks/useHolidays";
import type {
  MetaAutomatica,
  EstoqueBaixoItem,
  TopModelo,
  FaturamentoDiaSemana,
} from "@/hooks/useDashboardData";

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
    faturamentoYoY: number;
    pedidosPendentes: number;
    anoPassado: number;
  };
  metaAutomatica: MetaAutomatica;
  /** Simplified trend array — only `atual` (current year value) is needed for drop detection */
  tendenciaVendas: { atual: number }[];
  estoqueBaixo: EstoqueBaixoItem[];
  topModelos: TopModelo[];
  faturamentoDiaSemana: FaturamentoDiaSemana[];
  holidayMap: Map<string, Holiday[]>;
  dateRange?: { from?: Date; to?: Date };
  loading: boolean;
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

const ATENCAO_IDS = new Set(["meta-abaixo-leve", "concentracao-dia", "meta-atingida", "meta-acima", "yoy-crescimento"]);
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
  "yoy-queda": "Prioridade: analisar os fatores da queda comparado ao ano anterior.",
};

function gerarResumoExecutivo(
  metaAutomatica: MetaAutomatica,
  kpis: InsightsDashboardParams["kpis"],
): string {
  if (metaAutomatica.metaCalculada > 0) {
    if (metaAutomatica.statusMeta === "atingida" || metaAutomatica.statusMeta === "acima") {
      return "Desempenho positivo no período — faturamento acima do ritmo esperado.";
    }
    if (metaAutomatica.statusMeta === "abaixo" && metaAutomatica.diferencaRitmo < -10) {
      return "Período com desempenho abaixo do esperado — faturamento significativamente abaixo do ritmo sazonal.";
    }
    if (metaAutomatica.statusMeta === "abaixo") {
      return "Desempenho levemente abaixo do ritmo esperado para o período.";
    }
  }

  if (kpis.faturamentoYoY > 0) {
    const varYoY = ((kpis.faturamento - kpis.faturamentoYoY) / kpis.faturamentoYoY) * 100;
    if (varYoY > 20) return "Período de crescimento — faturamento acima do mesmo período do ano anterior.";
    if (varYoY < -20) return "Atenção: faturamento em queda comparado ao mesmo período do ano anterior.";
  }

  return "Desempenho dentro do esperado para o período analisado.";
}

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

    // Melhoria #3: normalização robusta de nomes para evitar falha com acentos/espaços
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

    // 3. Concentração de vendas
    // Melhoria #1: Threshold subiu de 40% para 65%.
    // Com 4 dias úteis de venda (Seg–Qui), 25% por dia é a base esperada.
    // Só alertamos se UMA única dia ultrapassar 65% (=2.6x a baseline), indicando risco real.
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

    // 4. Tendência de queda (uses current year 'atual' values)
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

    // 5. Pedidos pendentes acumulados
    // Melhoria #2: Threshold subiu de 10 para 20 pedidos — para um atacado, <20 é operacionalmente normal.
    if (kpis.pedidosPendentes > 20) {
      raw.push({
        id: "pendentes-alto",
        tipo: "alerta",
        mensagem: `Existem ${kpis.pedidosPendentes} pedidos pendentes de pagamento no período. Considere ação de cobrança.`,
        icone: "alert",
      });
    }

    // 5b. Ticket médio por pedido — novo insight de contexto
    // Melhoria #4: Usa pedidos pagos do faturamentoDiaSemana para calcular ticket médio
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

    // 6. Comparação YoY
    if (kpis.faturamentoYoY > 0) {
      const varYoY = ((kpis.faturamento - kpis.faturamentoYoY) / kpis.faturamentoYoY) * 100;
      if (varYoY < -20) {
        raw.push({
          id: "yoy-queda",
          tipo: "alerta",
          mensagem: `Faturamento ${Math.abs(varYoY).toFixed(0)}% abaixo do mesmo período de ${kpis.anoPassado}. Verifique se há fatores sazonais.`,
          icone: "trending-down",
        });
      } else if (varYoY > 20) {
        raw.push({
          id: "yoy-crescimento",
          tipo: "positivo",
          mensagem: `Crescimento de ${varYoY.toFixed(0)}% vs mesmo período de ${kpis.anoPassado}.`,
          icone: "trending-up",
        });
      }
    }

    // 7. Contexto sazonal: histórico do mês
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

    // 8. Feriados no período
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

    // Add priority and sort
    const insights: InsightItem[] = raw
      .map((item) => ({ ...item, prioridade: getPrioridade(item.tipo, item.id) }))
      .sort((a, b) => PRIORIDADE_ORDER[a.prioridade] - PRIORIDADE_ORDER[b.prioridade])
      .slice(0, 4);

    // Fallback if empty
    if (insights.length === 0) {
      insights.push({
        id: "sem-anomalias",
        tipo: "neutro",
        prioridade: "contexto",
        mensagem: "Desempenho dentro do esperado para o período analisado.",
        icone: "check",
      });
    }

    // Resumo executivo
    const resumoBase = gerarResumoExecutivo(metaAutomatica, kpis);
    const hasYoyQueda = insights.some(i => i.id === "yoy-queda");
    const resumoExecutivo = (hasYoyQueda && resumoBase.includes("positivo"))
      ? "Faturamento acima do ritmo esperado, mas abaixo do mesmo período do ano anterior."
      : resumoBase;

    // Sugestão de foco: first critical insight
    const firstCritico = insights.find((i) => i.prioridade === "critico");
    const sugestaoFoco = firstCritico ? (FOCO_MAP[firstCritico.id] ?? null) : null;

    return { insights, resumoExecutivo, sugestaoFoco };
  }, [
    loading,
    kpis.faturamento,
    kpis.faturamentoYoY,
    kpis.pedidosPendentes,
    kpis.anoPassado,
    metaAutomatica,
    tendenciaVendas,
    estoqueBaixo,
    topModelos,
    faturamentoDiaSemana,
    holidayMap,
    dateRange?.from,
    dateRange?.to,
  ]);
}
