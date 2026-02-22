import { useMemo } from "react";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Holiday } from "@/hooks/useHolidays";
import type {
  MetaAutomatica,
  TendenciaVenda,
  EstoqueBaixoItem,
  TopModelo,
  FaturamentoDiaSemana,
} from "@/hooks/useDashboardData";

export interface InsightItem {
  id: string;
  tipo: "alerta" | "positivo" | "info" | "neutro";
  mensagem: string;
  icone: "trending-down" | "trending-up" | "alert" | "package" | "check";
}

interface InsightsDashboardParams {
  kpis: {
    faturamento: number;
    faturamentoYoY: number;
    pedidosPendentes: number;
    anoPassado: number;
  };
  metaAutomatica: MetaAutomatica;
  tendenciaVendas: TendenciaVenda[];
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

export function useInsightsDashboard(params: InsightsDashboardParams): InsightItem[] {
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
    if (loading) return [];

    const insights: InsightItem[] = [];

    // 1. Ritmo vs Meta
    if (metaAutomatica.metaCalculada > 0) {
      if (metaAutomatica.statusMeta === "atingida") {
        insights.push({
          id: "meta-atingida",
          tipo: "positivo",
          mensagem: `Meta mensal atingida! Faturamento atual: ${formatCurrencyShort(metaAutomatica.faturamentoAtualMes)}.`,
          icone: "check",
        });
      } else if (metaAutomatica.statusMeta === "acima") {
        insights.push({
          id: "meta-acima",
          tipo: "positivo",
          mensagem: `Faturamento acima do ritmo esperado (+${Math.abs(metaAutomatica.diferencaRitmo).toFixed(0)}pp). Projeção de ${formatCurrencyShort(metaAutomatica.faturamentoAtualMes / (metaAutomatica.percentualRealizado || 1) * 100)} para o mês.`,
          icone: "trending-up",
        });
      } else if (metaAutomatica.statusMeta === "abaixo" && metaAutomatica.diferencaRitmo < -10) {
        insights.push({
          id: "meta-abaixo",
          tipo: "alerta",
          mensagem: `Faturamento significativamente abaixo do ritmo sazonal (${metaAutomatica.diferencaRitmo.toFixed(0)}pp). Queda pode estar concentrada nos últimos dias.`,
          icone: "trending-down",
        });
      } else if (metaAutomatica.statusMeta === "abaixo") {
        insights.push({
          id: "meta-abaixo-leve",
          tipo: "info",
          mensagem: `Faturamento levemente abaixo do ritmo esperado (${metaAutomatica.diferencaRitmo.toFixed(0)}pp). Acompanhe nos próximos dias.`,
          icone: "trending-down",
        });
      }
    }

    // 2. Estoque crítico impactando vendas
    const topNomes = new Set(topModelos.map((m) => m.nome.toLowerCase()));
    const modelosZeradosTop = estoqueBaixo
      .filter((e) => (e.quantidade <= 0) && topNomes.has(e.nome.toLowerCase()))
      .map((e) => e.nome);

    if (modelosZeradosTop.length > 0) {
      const nomes = modelosZeradosTop.slice(0, 2).join("' e '");
      insights.push({
        id: "estoque-top-zerado",
        tipo: "alerta",
        mensagem: `Modelo '${nomes}' está entre os mais vendidos mas com estoque zerado. Pode estar perdendo vendas.`,
        icone: "package",
      });
    }

    // 3. Concentração de vendas
    const totalFatSemana = faturamentoDiaSemana.reduce((s, d) => s + d.valor, 0);
    if (totalFatSemana > 0) {
      const diaConcentrado = faturamentoDiaSemana.find((d) => d.percentual > 40);
      if (diaConcentrado) {
        insights.push({
          id: "concentracao-dia",
          tipo: "info",
          mensagem: `${diaConcentrado.percentual.toFixed(0)}% do faturamento está concentrado em ${diaConcentrado.diaSemana}. Considere ações para distribuir vendas.`,
          icone: "alert",
        });
      }
    }

    // 4. Tendência de queda
    if (tendenciaVendas.length >= 3) {
      const ultimos3 = tendenciaVendas.slice(-3);
      const quedaConsecutiva =
        ultimos3[2].valor < ultimos3[1].valor && ultimos3[1].valor < ultimos3[0].valor;
      if (quedaConsecutiva && ultimos3[0].valor > 0) {
        insights.push({
          id: "tendencia-queda",
          tipo: "alerta",
          mensagem: `Queda consecutiva de faturamento nos últimos 3 períodos. Verifique possíveis causas.`,
          icone: "trending-down",
        });
      }
    }

    // 5. Pedidos pendentes acumulados
    if (kpis.pedidosPendentes > 10) {
      insights.push({
        id: "pendentes-alto",
        tipo: "alerta",
        mensagem: `Existem ${kpis.pedidosPendentes} pedidos pendentes de pagamento no período. Considere ação de cobrança.`,
        icone: "alert",
      });
    }

    // 6. Comparação YoY
    if (kpis.faturamentoYoY > 0) {
      const varYoY = ((kpis.faturamento - kpis.faturamentoYoY) / kpis.faturamentoYoY) * 100;
      if (varYoY < -20) {
        insights.push({
          id: "yoy-queda",
          tipo: "alerta",
          mensagem: `Faturamento ${Math.abs(varYoY).toFixed(0)}% abaixo do mesmo período de ${kpis.anoPassado}. Verifique se há fatores sazonais.`,
          icone: "trending-down",
        });
      } else if (varYoY > 20) {
        insights.push({
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
      insights.push({
        id: "historico-mes",
        tipo: "info",
        mensagem: `Historicamente, ${mesNome} teve faturamento médio de ${formatCurrencyShort(metaAutomatica.mediaBase)} nos últimos ${metaAutomatica.anosUsados.length} anos.`,
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
          insights.push({
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

    // Se nenhum insight relevante, mostrar mensagem neutra
    if (insights.length === 0) {
      return [
        {
          id: "sem-anomalias",
          tipo: "neutro" as const,
          mensagem: "Desempenho dentro do esperado para o período analisado.",
          icone: "check" as const,
        },
      ];
    }

    // Retornar no máximo 4 insights (os mais relevantes = os primeiros pela ordem de prioridade)
    return insights.slice(0, 4);
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
