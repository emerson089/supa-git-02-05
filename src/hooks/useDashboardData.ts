import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { startOfDay, subDays, startOfMonth, format, parseISO, differenceInDays, endOfDay, startOfWeek, startOfYear, getWeek, endOfMonth, subYears, getMonth, getYear, subMonths, getDate, getDaysInMonth, getDay } from "date-fns";
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
  media3Meses: number;           // Média faturamento últimos 3 meses
  percentualCrescimento: number; // % de crescimento (default 10)
  metaCalculada: number;         // Média × (1 + %)
  mesesUsados: string[];         // Lista de meses usados no cálculo
  temHistorico: boolean;         // Se há dados suficientes
  faturamentoAtualMes: number;   // Faturamento acumulado do mês atual
  percentualAtingido: number;    // % atingido (faturamento / meta)
  diferencaPrevisao: number;     // Previsão - Meta
  statusMeta: 'acima' | 'abaixo' | 'atingida'; // Status baseado na previsão
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
  tendenciaVendas: TendenciaVenda[];
  estoqueBaixo: EstoqueBaixoItem[];
  topModelos: TopModelo[];
  topModelosCoverage: TopModelosCoverage;
  statusPedidos: StatusPedido[];
  producaoKanban: ProducaoEtapa[];
  tipoAgrupamento: TipoAgrupamento;
  metaYoY: MetaYoY;
  // NOVOS CAMPOS: Inteligência de Vendas
  previsaoMensal: PrevisaoMensal;
  metaAutomatica: MetaAutomatica;
  faturamentoDiaSemana: FaturamentoDiaSemana[];
}

// Ordem padrão das etapas de produção (configurável)
const ETAPA_ORDER: string[] = [
  "Corte",
  "Costura",
  "Costura/Facção", // Alias para Costura
  "Lavanderia",
  "Acabamento",
  "Aprontamento",
  "Concluído",
];

const ETAPA_COLORS: Record<string, string> = {
  "Corte": "hsl(var(--stage-corte))",
  "Costura": "hsl(var(--stage-costura))",
  "Costura/Facção": "hsl(var(--stage-costura))", // Mesmo cor que Costura
  "Lavanderia": "hsl(var(--stage-lavanderia))",
  "Acabamento": "hsl(var(--stage-acabamento))",
  "Aprontamento": "hsl(var(--stage-acabamento))", // Fallback cor
  "Concluído": "hsl(var(--stage-concluido))",
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
      producaoFiltrada: false,
    },
    tendenciaVendas: [],
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
    // NOVOS DEFAULTS: Inteligência de Vendas
    previsaoMensal: {
      projecaoMensal: 0,
      mediaDiaria: 0,
      diasDecorridos: 0,
      diasTotais: 0,
      variacaoVsMeta: 0,
      acimaOuAbaixo: 'igual',
    },
    metaAutomatica: {
      media3Meses: 0,
      percentualCrescimento: 10,
      metaCalculada: 0,
      mesesUsados: [],
      temHistorico: false,
      faturamentoAtualMes: 0,
      percentualAtingido: 0,
      diferencaPrevisao: 0,
      statusMeta: 'abaixo',
    },
    faturamentoDiaSemana: [],
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

        // NOVO: Datas para últimos 3 meses (meta automática)
        const mes1Inicio = startOfMonth(subMonths(now, 1));
        const mes1Fim = endOfMonth(subMonths(now, 1));
        const mes2Inicio = startOfMonth(subMonths(now, 2));
        const mes2Fim = endOfMonth(subMonths(now, 2));
        const mes3Inicio = startOfMonth(subMonths(now, 3));
        const mes3Fim = endOfMonth(subMonths(now, 3));

        // Carregar % configurável do localStorage
        const savedPercentual = localStorage.getItem('dashboard-meta-crescimento');
        const percentualCrescimento = savedPercentual ? parseFloat(savedPercentual) / 100 : 0.10;

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
          // NOVO: Pedidos PAGO dos últimos 4 meses para calcular média (usando COALESCE paid_at/created_at)
          pedidosUltimos4Meses,
        ] = await Promise.all([
          // Pedidos período atual (inclui paid_at para agrupamento correto)
          supabase
            .from("pedidos")
            .select("valor_total, total_pecas, status_pagamento, status_pedido, created_at, paid_at")
            .eq("user_id", user.id)
            .gte("created_at", startDate)
            .lte("created_at", endDate),

          // Pedidos mesmo período do ano passado (YoY) - inclui paid_at
          supabase
            .from("pedidos")
            .select("valor_total, total_pecas, status_pagamento, status_pedido, paid_at")
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

          // Itens de pedido para top modelos (filtrar por PAGO e respeitar cancelados)
          supabase
            .from("pedido_itens")
            .select("pedido_id, produto_nome, quantidade, pedidos!inner(user_id, created_at, status_pagamento, status_pedido)")
            .eq("pedidos.user_id", user.id)
            .eq("pedidos.status_pagamento", "PAGO")
            .gte("pedidos.created_at", startDate)
            .lte("pedidos.created_at", endDate),

          // Produção atual (com filtro de período)
          supabase
            .from("producao")
            .select("processo_atual, quantidade, created_date")
            .eq("user_id", user.id)
            .gte("created_date", startDate)
            .lte("created_date", endDate),

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

          // NOVO: Buscar todos os pedidos PAGO dos últimos 4 meses para calcular média com COALESCE
          // Isso permite usar paid_at OU created_at como fallback
          supabase
            .from("pedidos")
            .select("valor_total, paid_at, created_at")
            .eq("user_id", user.id)
            .eq("status_pagamento", "PAGO")
            .gte("created_at", subMonths(startOfMonth(now), 4).toISOString())
            .lt("created_at", startOfMonth(now).toISOString()),
        ]);

        // Calculate KPIs
        const pedidosAtualData = pedidosAtual.data || [];
        const pedidosYoYData = pedidosYoY.data || [];

        // CORREÇÃO: Primeiro filtrar cancelados (se toggle ativo), depois filtrar por PAGO para faturamento
        const pedidosSemCancelados = excluirCancelados
          ? pedidosAtualData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
          : pedidosAtualData;

        const pedidosYoYSemCancelados = excluirCancelados
          ? pedidosYoYData.filter(p => !STATUS_CANCELADOS.includes((p.status_pedido || "").toUpperCase()))
          : pedidosYoYData;

        // CORREÇÃO: Faturamento e Peças agora usam APENAS pedidos PAGOS (consistente com Meta YoY)
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
        
        // Pedidos pendentes do período filtrado (mantém lógica original)
        const pedidosPendentes = pedidosSemCancelados.filter(p => 
          p.status_pagamento === "PENDENTE" || p.status_pagamento === "INCOMPLETO"
        ).length;
        const pedidosYoYPendentes = pedidosYoYSemCancelados.filter(p => 
          p.status_pagamento === "PENDENTE" || p.status_pagamento === "INCOMPLETO"
        ).length;

        // Produção agora é filtrada por período
        const producaoData = producao.data || [];
        const producaoYoYData = producaoYoY.data || [];
        const producaoAtiva = producaoData.filter(p => p.processo_atual !== "Concluído").reduce((sum, p) => sum + (p.quantidade || 0), 0);
        const producaoYoYAtiva = producaoYoYData.filter(p => p.processo_atual !== "Concluído").reduce((sum, p) => sum + (p.quantidade || 0), 0);

        // Tendência de vendas (grouped by tipoAgrupamento) - USA paid_at PARA PEDIDOS PAGOS
        const vendasAgrupadas: Record<string, { valor: number; pedidos: number; pecas: number; data: Date }> = {};
        
        pedidosPagos.forEach(p => {
          // Usar paid_at quando disponível (preferido), fallback para created_at
          const dataEfetiva = p.paid_at || p.created_at;
          const dataCompleta = parseISO(dataEfetiva);
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

        // Top modelos - AGORA filtra por cancelados também (pedidoItens já filtra por PAGO na query)
        const pedidoItensData = pedidoItens.data || [];
        const pedidoItensFiltrados = excluirCancelados
          ? pedidoItensData.filter((item: any) => {
              const statusPedido = (item.pedidos?.status_pedido || "").toUpperCase();
              return !STATUS_CANCELADOS.includes(statusPedido);
            })
          : pedidoItensData;
        
        const modelosMap: Record<string, number> = {};
        pedidoItensFiltrados.forEach((item: any) => {
          const nome = item.produto_nome || "Sem nome";
          modelosMap[nome] = (modelosMap[nome] || 0) + (item.quantidade || 0);
        });
        const topModelos = Object.entries(modelosMap)
          .map(([nome, quantidade]) => ({ nome, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade)
          .slice(0, 5);

        // NOVO: Calcular coverage do Top Modelos
        // Pedidos PAGOS no período que têm itens detalhados
        const pedidoIdsComItens = new Set(pedidoItensFiltrados.map((item: any) => item.pedido_id));
        const totalPedidosPagos = pedidosPagos.length;
        const pedidosComItens = pedidoIdsComItens.size;
        const coverage = totalPedidosPagos > 0 ? pedidosComItens / totalPedidosPagos : 0;

        // Status de pedidos (mantém original - todos os pedidos)
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

        // CORREÇÃO: Produção por etapa - DERIVAR etapas do banco ao invés de hardcoded
        const etapaMap: Record<string, number> = {};
        producaoData.forEach(p => {
          const etapa = p.processo_atual || "Corte";
          etapaMap[etapa] = (etapaMap[etapa] || 0) + (p.quantidade || 0);
        });
        
        // Derivar etapas únicas do banco e ordenar
        const etapasDoDb = Object.keys(etapaMap);
        const etapasOrdenadas = sortEtapas(etapasDoDb);
        
        const producaoKanbanBase = etapasOrdenadas.map(etapa => ({
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

        // NOVO: Calcular Meta Automática (média 3 meses)
        // Agrupar pedidos dos últimos 4 meses por mês usando COALESCE(paid_at, created_at)
        const pedidosHistorico = pedidosUltimos4Meses.data || [];
        const faturamentoPorMes: Record<string, number> = {};
        
        pedidosHistorico.forEach(p => {
          // Usar created_at para cálculo de média histórica
          // porque paid_at foi preenchido retroativamente com data errada em pedidos históricos
          const dataEfetiva = p.created_at;
          const mesAno = format(parseISO(dataEfetiva), "yyyy-MM");
          faturamentoPorMes[mesAno] = (faturamentoPorMes[mesAno] || 0) + (p.valor_total || 0);
        });

        // Pegar os 3 meses anteriores ao mês atual
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

        const metaCalculada = media3Meses * (1 + percentualCrescimento);

        // Calcular campos adicionais para a interface atualizada
        const percentualAtingidoMeta = metaCalculada > 0 
          ? (faturamentoAtualAcumulado / metaCalculada) * 100 
          : 0;
        
        // Previsão será calculada abaixo, então calculamos a diferença depois
        const diasDecorridosCalc = getDate(now);
        const diasTotaisCalc = getDaysInMonth(now);
        const mediaDiariaCalc = diasDecorridosCalc > 0 
          ? faturamentoAtualAcumulado / diasDecorridosCalc 
          : 0;
        const projecaoMensalCalc = mediaDiariaCalc * diasTotaisCalc;
        
        const diferencaPrevisao = projecaoMensalCalc - metaCalculada;
        
        const statusMeta: 'acima' | 'abaixo' | 'atingida' = 
          faturamentoAtualAcumulado >= metaCalculada ? 'atingida' :
          projecaoMensalCalc >= metaCalculada ? 'acima' : 'abaixo';

        const metaAutomatica: MetaAutomatica = {
          media3Meses,
          percentualCrescimento: percentualCrescimento * 100,
          metaCalculada,
          mesesUsados: [
            format(subMonths(now, 1), "MMM/yy", { locale: ptBR }),
            format(subMonths(now, 2), "MMM/yy", { locale: ptBR }),
            format(subMonths(now, 3), "MMM/yy", { locale: ptBR }),
          ],
          temHistorico: mesesComDados.length >= 1, // Permitir com pelo menos 1 mês
          faturamentoAtualMes: faturamentoAtualAcumulado,
          percentualAtingido: percentualAtingidoMeta,
          diferencaPrevisao,
          statusMeta,
        };

        // NOVO: Calcular Previsão Mensal
        const diasDecorridos = getDate(now);
        const diasTotais = getDaysInMonth(now);
        const mediaDiaria = diasDecorridos > 0 
          ? faturamentoAtualAcumulado / diasDecorridos 
          : 0;
        const projecaoMensal = mediaDiaria * diasTotais;

        const variacaoVsMetaAuto = metaAutomatica.metaCalculada > 0 
          ? ((projecaoMensal - metaAutomatica.metaCalculada) / metaAutomatica.metaCalculada) * 100 
          : 0;

        const previsaoMensal: PrevisaoMensal = {
          projecaoMensal,
          mediaDiaria,
          diasDecorridos,
          diasTotais,
          variacaoVsMeta: variacaoVsMetaAuto,
          acimaOuAbaixo: projecaoMensal > metaAutomatica.metaCalculada 
            ? 'acima' 
            : projecaoMensal < metaAutomatica.metaCalculada 
              ? 'abaixo' 
              : 'igual',
        };

        // NOVO: Calcular Faturamento por Dia da Semana (usando pedidos PAGOS do período)
        const diaSemanaMap: Record<number, { valor: number; pedidos: number; pecas: number }> = {
          0: { valor: 0, pedidos: 0, pecas: 0 }, // Domingo
          1: { valor: 0, pedidos: 0, pecas: 0 }, // Segunda
          2: { valor: 0, pedidos: 0, pecas: 0 }, // Terça
          3: { valor: 0, pedidos: 0, pecas: 0 }, // Quarta
          4: { valor: 0, pedidos: 0, pecas: 0 }, // Quinta
          5: { valor: 0, pedidos: 0, pecas: 0 }, // Sexta
          6: { valor: 0, pedidos: 0, pecas: 0 }, // Sábado
        };

        pedidosPagos.forEach(p => {
          const dataEfetiva = p.paid_at || p.created_at;
          const dia = getDay(parseISO(dataEfetiva)); // 0-6
          diaSemanaMap[dia].valor += p.valor_total || 0;
          diaSemanaMap[dia].pedidos += 1;
          diaSemanaMap[dia].pecas += p.total_pecas || 0;
        });

        const totalValorSemana = Object.values(diaSemanaMap).reduce((s, d) => s + d.valor, 0);

        // Filtrar apenas Segunda a Sábado (1-6), ordenar por maior valor
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
            producaoFiltrada: true, // Agora produção é sempre filtrada por período
          },
          tendenciaVendas,
          estoqueBaixo,
          topModelos,
          topModelosCoverage: {
            pedidosComItens,
            totalPedidos: totalPedidosPagos,
            coverage,
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
          // NOVOS CAMPOS
          previsaoMensal,
          metaAutomatica,
          faturamentoDiaSemana,
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
