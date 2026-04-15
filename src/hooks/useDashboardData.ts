import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchAllRows } from "@/lib/supabase-utils";
import { parseProductName } from "@/utils/productNameUtils";
import { startOfDay, subDays, startOfMonth, format, parseISO, differenceInDays, endOfDay, startOfWeek, startOfYear, getWeek, endOfMonth, subYears, getMonth, getYear, subMonths, getDate, getDaysInMonth, getDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export type Periodo = "hoje" | "30dias" | "90dias" | "ano_atual" | "12meses" | "mes" | "personalizado";

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
  pedidosPendentes: number;       // Total: PENDENTE + INCOMPLETO + PEND. ENTREGA
  pedidosPendentesSimples: number; // Apenas PENDENTE
  pedidosIncompletos: number;      // Apenas INCOMPLETO
  pedidosPendEntrega: number;      // Apenas PEND. ENTREGA
  pedidosYoY: number; // Mesmo período do ano passado
  producaoAtiva: number;
  producaoYoY: number; // Mesmo período do ano passado
  anoPassado: number; // Ano de referência
  producaoFiltrada: boolean; // Se produção usa filtro de período
}

export interface TopModelosCoverage {
  pedidosComItens: number;
  totalPedidos: number;
  coverage: number; // 0-1
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
  imagemUrl: string | null;
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

// NOVOS TIPOS: Inteligência de Vendas
export interface PrevisaoMensal {
  projecaoMensal: number;        // Faturamento projetado para o mês
  mediaDiaria: number;           // Média diária atual
  diasDecorridos: number;        // Dias do início do mês até hoje
  diasTotais: number;            // Total de dias do mês
  variacaoVsMeta: number;        // % acima/abaixo da meta
  acimaOuAbaixo: 'acima' | 'abaixo' | 'igual';
}

export interface MetaAutomatica {
  // Base da meta
  mediaBase: number;              // Média base (sazonal ou 3 meses)
  media3Meses: number;            // Fallback: média 3 meses
  percentualCrescimento: number;  // % de crescimento (default 10)
  metaCalculada: number;          // Média × (1 + %)
  mesesUsados: string[];          // Lista de meses/anos usados no cálculo
  temHistorico: boolean;          // Se há dados suficientes

  // Sazonalidade
  temHistoricoSazonal: boolean;   // Se há dados do mesmo mês em anos anteriores
  anosUsados: number[];           // Ex: [2025, 2024]
  faturamentosPorAno: Record<string, number>; // { "2025": 231253, "2024": 0 }

  // Ritmo sazonal
  percentualEsperadoHoje: number; // % esperado até hoje baseado na curva histórica
  percentualRealizado: number;    // % realizado (faturamento / meta)
  diferencaRitmo: number;         // realizado - esperado (em pontos percentuais)
  curvaDisponivel: boolean;       // Se há curva histórica

  // Faturamento e status
  faturamentoAtualMes: number;    // Faturamento acumulado do mês atual
  percentualAtingido: number;     // % atingido (faturamento / meta)
  diferencaPrevisao: number;      // Previsão - Meta
  statusMeta: 'acima' | 'abaixo' | 'atingida' | 'noritmo'; // Status baseado na curva sazonal
}

export interface FaturamentoDiaSemana {
  diaSemana: string;             // Segunda, Terça, etc.
  diaSemanaIndex: number;        // 0=Dom, 1=Seg, ..., 6=Sáb
  valor: number;                 // Total faturado
  pedidos: number;               // Quantidade de pedidos
  pecas: number;                 // Total de peças
  percentual: number;            // % do total
}

interface DashboardData {
  kpis: KPIs;
  estoqueBaixo: EstoqueBaixoItem[];
  topModelos: TopModelo[];
  topModelosCoverage: TopModelosCoverage;
  statusPedidos: StatusPedido[];
  producaoKanban: ProducaoEtapa[];
  tipoAgrupamento: TipoAgrupamento;
  metaYoY: MetaYoY;
  // Inteligência de Vendas
  previsaoMensal: PrevisaoMensal;
  metaAutomatica: MetaAutomatica;
  faturamentoDiaSemana: FaturamentoDiaSemana[];
}

// Ordem padrão das etapas de produção (alinhado com STAGES em production-data.ts)
const ETAPA_ORDER: string[] = [
  "Corte",
  "Costura/Facção",
  "Travete",
  "Destroyed",
  "Lavanderia",
  "Acabamento",
  "Aprontamento",
  "Vendas",
];

const ETAPA_COLORS: Record<string, string> = {
  "Corte": "hsl(210 100% 50%)",         // Blue
  "Costura/Facção": "hsl(var(--primary))",
  "Travete": "hsl(239 84% 67%)",        // Indigo
  "Destroyed": "hsl(25 95% 53%)",       // Orange
  "Lavanderia": "hsl(187 85% 53%)",     // Cyan
  "Acabamento": "hsl(168 76% 42%)",        // Teal (ID remains Acabamento, Label is Limpado)
  "Aprontamento": "hsl(271 81% 56%)",   // Purple
  "Vendas": "hsl(152 76% 43%)",         // Emerald
};

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Função para ordenar etapas conforme ordem padrão ou alfabética
function sortEtapas(etapas: string[]): string[] {
  return etapas.sort((a, b) => {
    const indexA = ETAPA_ORDER.indexOf(a);
    const indexB = ETAPA_ORDER.indexOf(b);
    // Se ambos estão na lista, usar ordem da lista
    if (indexA !== -1 && indexB !== -1) return indexA - indexB;
    // Se apenas um está na lista, ele vem primeiro
    if (indexA !== -1) return -1;
    if (indexB !== -1) return 1;
    // Fallback: ordem alfabética
    return a.localeCompare(b);
  });
}

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
    case "30dias":
      startDate = startOfDay(subDays(now, 30));
      startDateAnterior = startOfDay(subDays(now, 60));
      endDateAnterior = startOfDay(subDays(now, 30));
      break;
    case "90dias":
      startDate = startOfDay(subDays(now, 90));
      startDateAnterior = startOfDay(subDays(now, 180));
      endDateAnterior = startOfDay(subDays(now, 90));
      break;
    case "ano_atual":
      startDate = startOfYear(now);
      startDateAnterior = startOfYear(subYears(now, 1));
      endDateAnterior = subYears(now, 1);
      break;
    case "12meses":
      startDate = startOfDay(subMonths(now, 12));
      startDateAnterior = startOfDay(subMonths(now, 24));
      endDateAnterior = startOfDay(subMonths(now, 12));
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
  // Skip "Vendas" (final stage) for bottleneck detection
  const activeEtapas = etapas.filter(e => e.etapa !== "Vendas");

  return etapas.map((etapa) => {
    if (etapa.etapa === "Vendas") {
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


const DASHBOARD_DEFAULTS: DashboardData = {
  kpis: {
    faturamento: 0,
    faturamentoYoY: 0,
    pecasVendidas: 0,
    pecasYoY: 0,
    pedidosPendentes: 0,
    pedidosPendentesSimples: 0,
    pedidosIncompletos: 0,
    pedidosPendEntrega: 0,
    pedidosYoY: 0,
    producaoAtiva: 0,
    producaoYoY: 0,
    anoPassado: new Date().getFullYear() - 1,
    producaoFiltrada: false,
  },
  estoqueBaixo: [],
  topModelos: [],
  topModelosCoverage: { pedidosComItens: 0, totalPedidos: 0, coverage: 0 },
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
  previsaoMensal: {
    projecaoMensal: 0,
    mediaDiaria: 0,
    diasDecorridos: 0,
    diasTotais: 0,
    variacaoVsMeta: 0,
    acimaOuAbaixo: 'igual',
  },
  metaAutomatica: {
    mediaBase: 0,
    media3Meses: 0,
    percentualCrescimento: 10,
    metaCalculada: 0,
    mesesUsados: [],
    temHistorico: false,
    temHistoricoSazonal: false,
    anosUsados: [],
    faturamentosPorAno: {},
    percentualEsperadoHoje: 0,
    percentualRealizado: 0,
    diferencaRitmo: 0,
    curvaDisponivel: false,
    faturamentoAtualMes: 0,
    percentualAtingido: 0,
    diferencaPrevisao: 0,
    statusMeta: 'abaixo',
  },
  faturamentoDiaSemana: [],
};

async function fetchDashboardData(
  periodo: Periodo,
  dateRange: DateRange | undefined,
  userId: string,
  excluirCancelados: boolean
): Promise<DashboardData> {
  const { startDate, endDate, startDateAnterior, endDateAnterior } = getDateRange(periodo, dateRange);
  const tipoAgrupamento = getTipoAgrupamento(startDate, endDate);

  const now = new Date();
  const mesAtual = getMonth(now);
  const anoAtual = getYear(now);
  const anoPassado = anoAtual - 1;
  const nomeMesAtual = format(now, "MMMM", { locale: ptBR });

  const inicioMesAnoPassado = new Date(anoPassado, mesAtual, 1);
  const fimMesAnoPassado = endOfMonth(inicioMesAnoPassado);
  const inicioMesAtual = startOfMonth(now);
  const mesmoDiaAnoPassado = subYears(now, 1);
  const inicioMesmoDiaAnoPassado = new Date(anoPassado, mesAtual, 1);

  // START OF WEEK specifically for Top Modelos
  const startDateTopModelos = startOfWeek(now, { weekStartsOn: 0 }).toISOString();

  const startDateYoY = subYears(new Date(startDate), 1).toISOString();
  const endDateYoY = subYears(new Date(endDate), 1).toISOString();

  const savedPercentual = localStorage.getItem('dashboard-meta-crescimento');
  const percentualCrescimento = savedPercentual ? parseFloat(savedPercentual) / 100 : 0.10;

  const [
    pedidosAtual,
    pedidosYoY,
    estoque,
    pedidoItens,
    producao,
    producaoYoY,
    pedidosMesAnoPassadoCompleto,
    pedidosMesAnoPassadoAteDia,
    pedidosMesAtualAcumulado,
    pedidosUltimos4Meses,
    mediaSazonalResult,
    curvaMesResult,
  ] = await Promise.all([
    fetchAllRows<any>(() =>
      supabase
        .from("pedidos")
        .select("valor_total, total_pecas, status_pagamento, status_pedido, created_at, paid_at")
        .eq("user_id", userId)
        .gte("created_at", startDate)
        .lte("created_at", endDate)
        .order("created_at", { ascending: true })
    ).then(data => ({ data, error: null })),

    fetchAllRows<any>(() =>
      supabase
        .from("pedidos")
        .select("valor_total, total_pecas, status_pagamento, status_pedido, paid_at")
        .eq("user_id", userId)
        .gte("created_at", startDateYoY)
        .lte("created_at", endDateYoY)
        .order("created_at", { ascending: true })
    ).then(data => ({ data, error: null })),

    supabase
      .from("estoque_itens")
      .select("id, nome, quantidade, quantidade_minima, imagem_url")
      .eq("user_id", userId)
      .order("quantidade", { ascending: true })
      .limit(10),

    fetchAllRows<any>(() =>
      supabase
        .from("pedido_itens")
        .select(`
          pedido_id, 
          produto_id, 
          produto_nome, 
          quantidade, 
          pedidos!inner(user_id, created_at, status_pagamento, status_pedido),
          estoque_itens(nome, imagem_url)
        `)
        .eq("pedidos.user_id", userId)
        .in("pedidos.status_pagamento", ["PAGO", "CONCLUIDO", "PEND. ENTREGA"])
        .gte("pedidos.created_at", startDateTopModelos)
        .lte("pedidos.created_at", now.toISOString())
        .order("pedido_id", { ascending: true })
    ).then(data => ({ data, error: null })),

    supabase
      .from("producao")
      .select("processo_atual, quantidade")
      .eq("user_id", userId),

    supabase
      .from("producao")
      .select("processo_atual, quantidade")
      .eq("user_id", userId)
      .gte("created_date", startDateYoY)
      .lte("created_date", endDateYoY),

    supabase
      .from("pedidos")
      .select("valor_total")
      .eq("user_id", userId)
      .eq("status_pagamento", "PAGO")
      .gte("created_at", inicioMesAnoPassado.toISOString())
      .lte("created_at", fimMesAnoPassado.toISOString()),

    supabase
      .from("pedidos")
      .select("valor_total")
      .eq("user_id", userId)
      .eq("status_pagamento", "PAGO")
      .gte("created_at", inicioMesmoDiaAnoPassado.toISOString())
      .lte("created_at", mesmoDiaAnoPassado.toISOString()),

    supabase
      .from("pedidos")
      .select("valor_total")
      .eq("user_id", userId)
      .eq("status_pagamento", "PAGO")
      .gte("created_at", inicioMesAtual.toISOString())
      .lte("created_at", now.toISOString()),

    fetchAllRows<any>(() =>
      supabase
        .from("pedidos")
        .select("valor_total, paid_at, created_at")
        .eq("user_id", userId)
        .eq("status_pagamento", "PAGO")
        .gte("created_at", subMonths(startOfMonth(now), 4).toISOString())
        .lt("created_at", startOfMonth(now).toISOString())
        .order("created_at", { ascending: true })
    ).then(data => ({ data, error: null })),

    supabase.rpc('get_media_mes_anos_anteriores', {
      p_user_id: userId,
      p_mes: mesAtual + 1,
      p_limite_anos: 5
    }),

    supabase.rpc('get_curva_mes', {
      p_user_id: userId,
      p_mes: mesAtual + 1
    }),
  ]);

  // Calculate KPIs
  const pedidosAtualData = pedidosAtual.data || [];
  const pedidosYoYData = pedidosYoY.data || [];

  const pedidosSemCancelados = excluirCancelados
    ? pedidosAtualData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
    : pedidosAtualData;

  const pedidosYoYSemCancelados = excluirCancelados
    ? pedidosYoYData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
    : pedidosYoYData;

  const pedidosPagos = pedidosSemCancelados.filter(p =>
    (p.status_pagamento || "").toUpperCase() === "PAGO"
  );
  const pedidosYoYPagos = pedidosYoYSemCancelados.filter(p =>
    (p.status_pagamento || "").toUpperCase() === "PAGO"
  );

  const faturamento = pedidosPagos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const faturamentoYoY = pedidosYoYPagos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  const pecasVendidas = pedidosPagos.reduce((sum, p) => sum + (p.total_pecas || 0), 0);
  const pecasYoY = pedidosYoYPagos.reduce((sum, p) => sum + (p.total_pecas || 0), 0);

  const pedidosPendentesSimples = pedidosSemCancelados.filter(p =>
    (p.status_pagamento || "").toUpperCase() === "PENDENTE"
  ).length;
  const pedidosIncompletos = pedidosSemCancelados.filter(p =>
    (p.status_pagamento || "").toUpperCase() === "INCOMPLETO"
  ).length;
  const pedidosPendEntrega = pedidosSemCancelados.filter(p =>
    (p.status_pagamento || "").toUpperCase() === "PEND. ENTREGA"
  ).length;
  const pedidosPendentes = pedidosPendentesSimples + pedidosIncompletos + pedidosPendEntrega;
  const pedidosYoYPendentes = pedidosYoYSemCancelados.filter(p => {
    const s = (p.status_pagamento || "").toUpperCase();
    return s === "PENDENTE" || s === "INCOMPLETO" || s === "PEND. ENTREGA";
  }).length;

  const producaoData = producao.data || [];
  const producaoYoYData = producaoYoY.data || [];
  const producaoAtiva = producaoData.reduce((sum, p) => sum + (p.quantidade || 0), 0);
  const producaoYoYAtiva = producaoYoYData.reduce((sum, p) => sum + (p.quantidade || 0), 0);

  // Tendência de vendas
  const vendasAgrupadas: Record<string, { valor: number; pedidos: number; pecas: number; data: Date }> = {};

  pedidosPagos.forEach(p => {
    const dataEfetiva = p.created_at;
    const dataCompleta = parseISO(dataEfetiva);
    let chave: string;

    switch (tipoAgrupamento) {
      case "mes":
        chave = format(dataCompleta, "MMM/yy", { locale: ptBR });
        break;
      case "semana": {
        const wStart = startOfWeek(dataCompleta, { weekStartsOn: 1 });
        const wEnd = new Date(wStart);
        wEnd.setDate(wEnd.getDate() + 6);
        const mesIgual = wStart.getMonth() === wEnd.getMonth();
        chave = mesIgual
          ? `${wStart.getDate()}–${wEnd.getDate()} ${format(wEnd, "MMM", { locale: ptBR })}`
          : `${wStart.getDate()} ${format(wStart, "MMM", { locale: ptBR })}–${wEnd.getDate()} ${format(wEnd, "MMM", { locale: ptBR })}`;
        break;
      }
      default:
        chave = format(dataCompleta, "dd/MM/yy");
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
        case "semana": {
          const ws = startOfWeek(dados.data, { weekStartsOn: 1 });
          const we = new Date(ws);
          we.setDate(we.getDate() + 6);
          const mm = ws.getMonth() === we.getMonth();
          diaCompleto = mm
            ? `Semana de ${ws.getDate()} a ${we.getDate()} de ${format(we, "MMMM 'de' yyyy", { locale: ptBR })}`
            : `Semana de ${ws.getDate()} de ${format(ws, "MMMM", { locale: ptBR })} a ${we.getDate()} de ${format(we, "MMMM 'de' yyyy", { locale: ptBR })}`;
          break;
        }
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

  // Estoque crítico
  const estoqueData = estoque.data || [];
  const estoqueBaixo: EstoqueBaixoItem[] = estoqueData
    .filter(item => {
      const minimo = item.quantidade_minima || 0;
      if (minimo > 0) {
        return item.quantidade < minimo;
      }
      return item.quantidade <= 10;
    })
    .sort((a, b) => {
      if (a.quantidade === 0 && b.quantidade !== 0) return -1;
      if (a.quantidade !== 0 && b.quantidade === 0) return 1;
      return a.quantidade - b.quantidade;
    })
    .map(item => ({
      ...item,
      status: getEstoqueStatus(item.quantidade),
    }))
    .slice(0, 5);

  // Top modelos
  const pedidoItensData = pedidoItens.data || [];
  const pedidoItensFiltrados = excluirCancelados
    ? pedidoItensData.filter((item: any) => {
      const statusPedido = (item.pedidos?.status_pedido || "").toUpperCase();
      return !STATUS_CANCELADOS.includes(statusPedido);
    })
    : pedidoItensData;

  const modelosMap: Record<string, { quantidade: number; nome: string; imagemUrl: string | null }> = {};
  pedidoItensFiltrados.forEach((item: any) => {
    const rawNome = (item.produto_nome || "Sem nome").trim();
    const estoqueItem = item.estoque_itens;
    const estoqueNome = estoqueItem?.nome?.trim();
    const imagemUrl = estoqueItem?.imagem_url || null;

    // Normalizar em dash para hífen antes de parsear (ex: "Jeans — 34" → "Jeans - 34")
    const normalizedNome = rawNome.replace(/\s*—\s*/g, ' - ');

    // Extrair refBase (referência sem tamanho) para agrupamento
    const infoRef = parseProductName(normalizedNome, normalizedNome);
    const chave = (infoRef.refBase || normalizedNome).toLowerCase().trim();

    // Montar nome de exibição
    let displayNome: string;
    if (estoqueNome && estoqueNome !== rawNome) {
      // Tem nome amigável do estoque: ex "Calça Jeans Wide Leg 616"
      const infoDisplay = parseProductName(estoqueNome, normalizedNome);
      displayNome = infoDisplay.nomeExibicao || infoRef.refBase || rawNome;
    } else {
      // Sem nome amigável: usa a referência base limpa, ex: "SS2603-616"
      displayNome = infoRef.refBase || normalizedNome;
    }

    if (!modelosMap[chave]) {
      modelosMap[chave] = { quantidade: 0, nome: displayNome, imagemUrl };
    }
    modelosMap[chave].quantidade += item.quantidade || 0;
  });

  const topModelos = Object.values(modelosMap)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10)
    .map(({ nome, quantidade, imagemUrl }) => ({ nome, quantidade, imagemUrl }));

  const pedidoIdsComItens = new Set(pedidoItensFiltrados.map((item: any) => item.pedido_id));

  // Calculate total paid orders IN THIS WEEK precisely for the coverage denominator
  const totalPedidosPagosNaSemana = pedidosSemCancelados.filter(p => {
    const isPago = ["PAGO", "CONCLUIDO"].includes((p.status_pagamento || "").toUpperCase());
    const isEstaSemana = p.created_at >= startDateTopModelos;
    return isPago && isEstaSemana;
  }).length;

  const pedidosComItens = pedidoIdsComItens.size;
  const coverage = totalPedidosPagosNaSemana > 0 ? pedidosComItens / totalPedidosPagosNaSemana : 0;
  // If we somehow get more items than orders due to timing/cache, cap at 1.0 (100%)
  const finalCoverage = Math.min(coverage, 1);

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

  // Produção por etapa
  const etapaMap: Record<string, number> = {};
  producaoData.forEach(p => {
    const etapa = p.processo_atual || "Corte";
    etapaMap[etapa] = (etapaMap[etapa] || 0) + (p.quantidade || 0);
  });

  const etapasDoDb = Object.keys(etapaMap);
  const etapasOrdenadas = sortEtapas(etapasDoDb);

  const producaoKanbanBase = etapasOrdenadas.map(etapa => ({
    etapa,
    pecas: etapaMap[etapa] || 0,
    color: ETAPA_COLORS[etapa] || "hsl(var(--muted))",
    isBottleneck: false,
  }));
  const producaoKanban = detectBottlenecks(producaoKanbanBase);

  // Meta YoY
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
  const metaAnual = faturamentoAnoPassadoTotal * 1.15;
  const percentualAtingido = metaAnual > 0 ? (faturamentoAtualAcumulado / metaAnual) * 100 : 0;
  const faltaParaMeta = Math.max(0, faturamentoAnoPassadoTotal - faturamentoAtualAcumulado);
  const variacaoVsMesmoDia = faturamentoMesmoDiaAnoPassadoTotal > 0
    ? ((faturamentoAtualAcumulado - faturamentoMesmoDiaAnoPassadoTotal) / faturamentoMesmoDiaAnoPassadoTotal) * 100
    : 0;

  // Meta com sazonalidade
  const pedidosHistorico = pedidosUltimos4Meses.data || [];
  const faturamentoPorMes: Record<string, number> = {};

  pedidosHistorico.forEach(p => {
    const dataEfetiva = p.created_at;
    const mesAno = format(parseISO(dataEfetiva), "yyyy-MM");
    faturamentoPorMes[mesAno] = (faturamentoPorMes[mesAno] || 0) + (p.valor_total || 0);
  });

  const meses3anteriores = [
    format(subMonths(now, 1), "yyyy-MM"),
    format(subMonths(now, 2), "yyyy-MM"),
    format(subMonths(now, 3), "yyyy-MM"),
  ];

  const somaMeses = meses3anteriores.map(m => faturamentoPorMes[m] || 0);
  const mesesComDados = somaMeses.filter(v => v > 0);
  const media3Meses = mesesComDados.length > 0
    ? mesesComDados.reduce((a, b) => a + b, 0) / mesesComDados.length
    : 0;

  const mediaSazonalData = mediaSazonalResult.data;
  const curvaMesData = curvaMesResult.data || [];

  const mediaSazonal = mediaSazonalData && mediaSazonalData.length > 0
    ? Number(mediaSazonalData[0]?.media_faturamento || 0)
    : 0;
  const anosUsados: number[] = mediaSazonalData && mediaSazonalData.length > 0
    ? (mediaSazonalData[0]?.anos_usados || [])
    : [];
  const faturamentosPorAno: Record<string, number> = mediaSazonalData && mediaSazonalData.length > 0
    ? (mediaSazonalData[0]?.faturamentos_por_ano as Record<string, number> || {})
    : {};

  const temHistoricoSazonal = anosUsados.length > 0 && mediaSazonal > 0;

  const mediaBase = temHistoricoSazonal ? mediaSazonal : media3Meses;
  const metaCalculada = mediaBase * (1 + percentualCrescimento);

  const diasDecorridosCalc = getDate(now);
  const diasTotaisCalc = getDaysInMonth(now);
  const curvaDisponivel = curvaMesData.length > 0;

  let percentualEsperadoHoje = (diasDecorridosCalc / diasTotaisCalc) * 100;

  if (curvaDisponivel) {
    const curvaAteDia = curvaMesData.filter((c: { dia: number }) => c.dia <= diasDecorridosCalc);
    if (curvaAteDia.length > 0) {
      const ultimoDiaCurva = curvaAteDia[curvaAteDia.length - 1];
      percentualEsperadoHoje = Number(ultimoDiaCurva.percentual_acumulado || 0);
    }
  }

  const percentualRealizado = metaCalculada > 0
    ? (faturamentoAtualAcumulado / metaCalculada) * 100
    : 0;
  const diferencaRitmo = percentualRealizado - percentualEsperadoHoje;

  // Lógica de projeção baseada em dias úteis de venda (Segunda=1 a Quinta=4)
  // Evita a distorção causada por sextas e fins de semana sem vendas
  const DIAS_VENDA = [1, 2, 3, 4]; // getDay(): 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb

  function contarDiasVenda(inicio: Date, fim: Date): number {
    let count = 0;
    const cur = new Date(inicio);
    cur.setHours(0, 0, 0, 0);
    const end = new Date(fim);
    end.setHours(23, 59, 59, 999);
    while (cur <= end) {
      if (DIAS_VENDA.includes(getDay(cur))) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  const diasVendaDecorridos = contarDiasVenda(inicioMesAtual, now);
  const diasVendaTotaisNoMes = contarDiasVenda(inicioMesAtual, endOfMonth(now));

  // Se já houve pelo menos 1 dia de venda, projeta com base neles; senão usa média linear como fallback
  const mediaDiariaCalc = diasVendaDecorridos > 0
    ? faturamentoAtualAcumulado / diasVendaDecorridos
    : (diasDecorridosCalc > 0 ? faturamentoAtualAcumulado / diasDecorridosCalc : 0);

  const projecaoMensalCalc = diasVendaDecorridos > 0
    ? mediaDiariaCalc * diasVendaTotaisNoMes
    : mediaDiariaCalc * diasTotaisCalc;

  const diferencaPrevisao = projecaoMensalCalc - metaCalculada;

  const statusMeta: 'acima' | 'abaixo' | 'atingida' | 'noritmo' =
    percentualRealizado >= 100 ? 'atingida' :
      diferencaRitmo >= 5 ? 'acima' :
        diferencaRitmo >= -5 ? 'noritmo' : 'abaixo';

  const mesesUsados = temHistoricoSazonal
    ? anosUsados.map(ano => `${format(now, "MMM", { locale: ptBR })}/${String(ano).slice(-2)}`)
    : [
      format(subMonths(now, 1), "MMM/yy", { locale: ptBR }),
      format(subMonths(now, 2), "MMM/yy", { locale: ptBR }),
      format(subMonths(now, 3), "MMM/yy", { locale: ptBR }),
    ];

  const metaAutomatica: MetaAutomatica = {
    mediaBase,
    media3Meses,
    percentualCrescimento: percentualCrescimento * 100,
    metaCalculada,
    mesesUsados,
    temHistorico: mesesComDados.length >= 1 || temHistoricoSazonal,
    temHistoricoSazonal,
    anosUsados,
    faturamentosPorAno,
    percentualEsperadoHoje,
    percentualRealizado,
    diferencaRitmo,
    curvaDisponivel,
    faturamentoAtualMes: faturamentoAtualAcumulado,
    percentualAtingido: percentualRealizado,
    diferencaPrevisao,
    statusMeta,
  };

  // Previsão Mensal — usa a mesma projeção por dias úteis já calculada em metaAutomatica
  const diasDecorridos = getDate(now);
  const diasTotais = getDaysInMonth(now);

  const variacaoVsMetaAuto = metaAutomatica.metaCalculada > 0
    ? ((projecaoMensalCalc - metaAutomatica.metaCalculada) / metaAutomatica.metaCalculada) * 100
    : 0;

  const previsaoMensal: PrevisaoMensal = {
    projecaoMensal: projecaoMensalCalc,
    mediaDiaria: mediaDiariaCalc,
    diasDecorridos,
    diasTotais,
    variacaoVsMeta: variacaoVsMetaAuto,
    acimaOuAbaixo: projecaoMensalCalc > metaAutomatica.metaCalculada
      ? 'acima'
      : projecaoMensalCalc < metaAutomatica.metaCalculada
        ? 'abaixo'
        : 'igual',
  };

  // Faturamento por Dia da Semana
  const diaSemanaMap: Record<number, { valor: number; pedidos: number; pecas: number }> = {
    0: { valor: 0, pedidos: 0, pecas: 0 },
    1: { valor: 0, pedidos: 0, pecas: 0 },
    2: { valor: 0, pedidos: 0, pecas: 0 },
    3: { valor: 0, pedidos: 0, pecas: 0 },
    4: { valor: 0, pedidos: 0, pecas: 0 },
    5: { valor: 0, pedidos: 0, pecas: 0 },
    6: { valor: 0, pedidos: 0, pecas: 0 },
  };

  // Para "Vendas por Dia": inclui PEND. ENTREGA pois o item já foi fisicamente enviado
  const pedidosParaDiaSemana = pedidosSemCancelados.filter(p =>
    ["PAGO", "CONCLUIDO", "PEND. ENTREGA"].includes((p.status_pagamento || "").toUpperCase())
  );

  pedidosParaDiaSemana.forEach(p => {
    const dataEfetiva = p.paid_at || p.created_at;
    const dia = getDay(parseISO(dataEfetiva));
    diaSemanaMap[dia].valor += p.valor_total || 0;
    diaSemanaMap[dia].pedidos += 1;
    diaSemanaMap[dia].pecas += p.total_pecas || 0;
  });

  const totalValorSemana = Object.values(diaSemanaMap).reduce((s, d) => s + d.valor, 0);

  const faturamentoDiaSemana: FaturamentoDiaSemana[] = [1, 2, 3, 4, 5, 6]
    .map(i => ({
      diaSemana: DIAS_SEMANA[i],
      diaSemanaIndex: i,
      valor: diaSemanaMap[i].valor,
      pedidos: diaSemanaMap[i].pedidos,
      pecas: diaSemanaMap[i].pecas,
      percentual: totalValorSemana > 0 ? (diaSemanaMap[i].valor / totalValorSemana) * 100 : 0,
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    kpis: {
      faturamento,
      faturamentoYoY,
      pecasVendidas,
      pecasYoY,
      pedidosPendentes,
      pedidosPendentesSimples,
      pedidosIncompletos,
      pedidosPendEntrega,
      pedidosYoY: pedidosYoYPendentes,
      producaoAtiva,
      producaoYoY: producaoYoYAtiva,
      anoPassado,
      producaoFiltrada: true,
    },
    estoqueBaixo,
    topModelos,
    topModelosCoverage: {
      pedidosComItens,
      totalPedidos: totalPedidosPagosNaSemana,
      coverage: finalCoverage,
    },
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
    previsaoMensal,
    metaAutomatica,
    faturamentoDiaSemana,
  };
}

export function useDashboardData(
  periodo: Periodo,
  dateRange?: DateRange,
  excluirCancelados: boolean = true,
  percentualCrescimento?: number
) {
  const { user } = useAuth();

  const { data, isLoading: loading, isError } = useQuery({
    queryKey: [
      'dashboard-data',
      periodo,
      dateRange?.from?.getTime(),
      dateRange?.to?.getTime(),
      excluirCancelados,
      user?.id,
      percentualCrescimento, // Ensures refetch when growth % changes
    ],
    queryFn: () => fetchDashboardData(periodo, dateRange, user!.id, excluirCancelados),
    enabled: !!user,
    staleTime: 60000, // 60s cache
    retry: 2,
  });

  return { data: data || DASHBOARD_DEFAULTS, loading, isError };
}
