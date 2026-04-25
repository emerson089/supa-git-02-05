import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LotImage } from "@/components/production/LotImage";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { HolidayCalendar } from "@/components/ui/holiday-calendar";
import { useHolidays } from "@/hooks/useHolidays";

import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip as TooltipUI, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { KpiCardSkeleton, ChartSkeleton, DonutChartSkeleton, ListItemSkeleton, TopModelosSkeleton, ProducaoKanbanSkeleton } from "@/components/ui/dashboard-skeleton";
import { Banknote, Package, AlertCircle, Factory, TrendingUp, TrendingDown, Calendar as CalendarIcon, AlertTriangle, ChevronRight, Wrench, Wand2, Target, Pencil, X, Settings, Bus, CheckCircle2, ArrowUp, ArrowDown, Flame, Users, ShieldAlert } from "lucide-react";
import { useDashboardData, Periodo, DateRange, STATUS_COLORS, MetaYoY, TopModelo, StatusPedido, TopModelosCoverage, PrevisaoMensal, MetaAutomatica, FaturamentoDiaSemana, ConcentracaoVendas } from "@/hooks/useDashboardData";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format, startOfMonth, getYear, subDays, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TendenciaVendasChart } from "@/components/dashboard/TendenciaVendasChart";
import { RecebimentosTrendChart } from "@/components/dashboard/RecebimentosTrendChart";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendMode, useSalesTrendChart } from "@/hooks/useSalesTrendChart";
import { useRecebimentosTrendChart } from "@/hooks/useRecebimentosTrendChart";
import { useTaxasExcursao } from "@/hooks/useTaxasExcursao";


function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(value);
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}
function calcVariation(atual: number, anterior: number): {
  value: number;
  isPositive: boolean;
} {
  if (anterior === 0) return {
    value: 0,
    isPositive: true
  };
  const variation = (atual - anterior) / anterior * 100;
  return {
    value: Math.abs(variation),
    isPositive: variation >= 0
  };
}



// Custom tooltip for weekday chart
function WeekdayTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: Array<{
    payload: FaturamentoDiaSemana;
  }>;
}) {
  if (active && payload?.[0]) {
    const data = payload[0].payload;
    return <div className="bg-white shadow-lg rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
      <p className="font-medium text-sm text-gray-800">{data.diaSemana}</p>
      <p className="text-primary font-bold text-lg">{formatCurrency(data.valor)}</p>
      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
        <span>{data.pedidos} pedidos</span>
        <span>{data.pecas} peças</span>
        <span>{data.percentual.toFixed(1)}%</span>
      </div>
    </div>;
  }
  return null;
}
export default function Dashboard() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  // Estado inicial vindo do localStorage
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const saved = localStorage.getItem('dashboard-periodo');
    return saved as Periodo || 'mes';
  });
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem('dashboard-daterange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined
        };
      } catch {
        return {
          from: undefined,
          to: undefined
        };
      }
    }
    return {
      from: undefined,
      to: undefined
    };
  });
  const [excluirCancelados, setExcluirCancelados] = useState(() => {
    const saved = localStorage.getItem('dashboard-excluir-cancelados');
    return saved !== null ? saved === 'true' : true;
  });
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Holiday data for calendar markers
  const currentYear = new Date().getFullYear();
  const holidayYears = [currentYear, currentYear + 1];
  const { holidayMap } = useHolidays(holidayYears);
  const [percentualCrescimento, setPercentualCrescimento] = useState(() => {
    const saved = localStorage.getItem('dashboard-meta-crescimento');
    return saved ? parseFloat(saved) : 10;
  });
  const [metaConfigOpen, setMetaConfigOpen] = useState(false);

  // Estados para modais de detalhes (mobile)
  const [selectedModelo, setSelectedModelo] = useState<TopModelo | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusPedido | null>(null);

  // Persistir mudanças no localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-periodo', periodo);
  }, [periodo]);
  useEffect(() => {
    localStorage.setItem('dashboard-daterange', JSON.stringify({
      from: dateRange.from?.toISOString(),
      to: dateRange.to?.toISOString()
    }));
  }, [dateRange]);
  useEffect(() => {
    localStorage.setItem('dashboard-excluir-cancelados', String(excluirCancelados));
  }, [excluirCancelados]);

  // NOVO: Persistir % de crescimento
  const handlePercentualChange = (value: number) => {
    setPercentualCrescimento(value);
    localStorage.setItem('dashboard-meta-crescimento', String(value));
  };
  const {
    data,
    loading,
    isError
  } = useDashboardData(periodo, dateRange, excluirCancelados, percentualCrescimento);

  const [trendMode, setTrendMode] = useState<TrendMode>({ granularity: 'month', submode: 'yoy' });

  // Hooks chamados diretamente no pai para fluxo de dados estável
  const salesTrend = useSalesTrendChart({
    excluirCancelados,
    mode: trendMode,
  });

  const recebimentosTrend = useRecebimentosTrendChart({
    mode: trendMode,
  });

  const { data: taxasExcursao, loading: taxasLoading } = useTaxasExcursao();
  const periodos: {
    label: string;
    value: Periodo;
  }[] = [{
    label: "Hoje",
    value: "hoje"
  }, {
    label: "30 dias",
    value: "30dias"
  }, {
    label: "90 dias",
    value: "90dias"
  }, {
    label: "Ano atual",
    value: "ano_atual"
  }, {
    label: "12 meses",
    value: "12meses"
  }, {
    label: "Mês",
    value: "mes"
  }];

  // Verifica se há filtros ativos (diferente do padrão)
  const hasActiveFilters = periodo !== 'mes' || dateRange.from !== undefined || !excluirCancelados;
  const handleClearFilters = () => {
    setPeriodo('mes');
    setDateRange({
      from: undefined,
      to: undefined
    });
    setExcluirCancelados(true);
    setCalendarOpen(false);
  };
  const handlePeriodoClick = (value: Periodo) => {
    setPeriodo(value);
    if (value !== "personalizado") {
      setDateRange({
        from: undefined,
        to: undefined
      });
    }
  };
  const handleDateRangeSelect = (range: {
    from?: Date;
    to?: Date;
  } | undefined) => {
    if (range) {
      setDateRange({
        from: range.from,
        to: range.to
      });
      if (range.from && range.to) {
        setPeriodo("personalizado");
        setCalendarOpen(false);
      }
    }
  };
  // Detecta se o período cruza anos diferentes
  const periodoAcrossaAnos = (() => {
    if (periodo === "personalizado" && dateRange.from && dateRange.to) {
      return getYear(dateRange.from) !== getYear(dateRange.to);
    }
    // Para presets que podem cruzar anos
    const now = new Date();
    if (periodo === "90dias") {
      return getYear(subDays(now, 90)) !== getYear(now);
    }
    if (periodo === "12meses") {
      return getYear(subMonths(now, 12)) !== getYear(now);
    }
    if (periodo === "ano_atual") {
      return false; // ano_atual nunca cruza anos
    }
    return false;
  })();

  // Formata o período de forma explícita para exibir no gráfico
  const formatPeriodoExplicito = () => {
    const now = new Date();
    let from: Date, to: Date;

    switch (periodo) {
      case 'hoje':
        from = now;
        to = now;
        break;
      case '30dias':
        from = subDays(now, 30);
        to = now;
        break;
      case '90dias':
        from = subDays(now, 90);
        to = now;
        break;
      case 'ano_atual':
        from = startOfYear(now);
        to = now;
        break;
      case '12meses':
        from = subMonths(now, 12);
        to = now;
        break;
      case 'mes':
        from = startOfMonth(now);
        to = now;
        break;
      case 'personalizado':
        if (dateRange.from && dateRange.to) {
          from = dateRange.from;
          to = dateRange.to;
        } else {
          return '';
        }
        break;
      default:
        from = startOfMonth(now);
        to = now;
    }

    // Se cruza anos, mostrar ano completo
    if (getYear(from) !== getYear(to)) {
      return `${format(from, "dd/MM/yyyy")} → ${format(to, "dd/MM/yyyy")}`;
    }
    return `${format(from, "dd/MM")} → ${format(to, "dd/MM")}`;
  };

  const getPeriodoLabel = () => {
    switch (periodo) {
      case 'hoje':
        return 'Hoje';
      case '30dias':
        return 'Últimos 30 dias';
      case '90dias':
        return 'Últimos 90 dias';
      case 'ano_atual':
        return `Ano ${getYear(new Date())}`;
      case '12meses':
        return 'Últimos 12 meses';
      case 'mes':
        return `${format(startOfMonth(new Date()), "dd/MM")} - ${format(new Date(), "dd/MM")} (Mês atual)`;
      case 'personalizado':
        if (dateRange.from && dateRange.to) {
          // Se cruza anos, mostrar ano completo
          if (getYear(dateRange.from) !== getYear(dateRange.to)) {
            return `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
          }
          return `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
        }
        return 'Período personalizado';
      default:
        return 'Mês';
    }
  };
  const getDateRangeLabel = () => {
    if (periodo === "personalizado" && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`;
    }
    return "Período";
  };
  const anoPassado = data.kpis.anoPassado;
  const kpiCards = [{
    title: "Faturamento Total",
    value: formatCurrency(data.kpis.faturamento),
    icon: Banknote,
    variation: calcVariation(data.kpis.faturamento, data.kpis.faturamentoYoY),
    color: "text-emerald-600",
    bgColor: "bg-emerald-100",
    clickable: false,
    showBruto: !excluirCancelados
  }, {
    title: "Peças Vendidas",
    value: `${formatNumber(data.kpis.pecasVendidas)} un`,
    icon: Package,
    variation: calcVariation(data.kpis.pecasVendidas, data.kpis.pecasYoY),
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    clickable: false,
    showBruto: !excluirCancelados
  }, {
    title: "Pedidos Pendentes",
    value: formatNumber(data.kpis.pedidosPendentes),
    icon: AlertCircle,
    variation: calcVariation(data.kpis.pedidosPendentes, data.kpis.pedidosYoY),
    color: "text-amber-600",
    bgColor: "bg-amber-100",
    invertVariation: true,
    clickable: true,
    onClick: () => navigate("/pedidos/criados?status=PENDENTE,INCOMPLETO,PEND. ENTREGA"),
    showBruto: false,
    breakdown: [
      { label: "Pendente", value: data.kpis.pedidosPendentesSimples, colorClass: "bg-amber-100 text-amber-700" },
      { label: "Pend. Entrega", value: data.kpis.pedidosPendEntrega, colorClass: "bg-blue-100 text-blue-700" },
      { label: "Incompleto", value: data.kpis.pedidosIncompletos, colorClass: "bg-orange-100 text-orange-700" },
    ],
  }];
  const maxModelo = Math.max(...data.topModelos.map(m => m.quantidade), 1);
  const getEstoqueStatusConfig = (status: "baixo" | "zerado" | "negativo") => {
    switch (status) {
      case "negativo":
        return {
          label: "Furou",
          bgColor: "bg-red-100",
          textColor: "text-red-600",
          actionLabel: "Ajustar",
          actionIcon: Wrench
        };
      case "zerado":
        return {
          label: "Zerado",
          bgColor: "bg-orange-100",
          textColor: "text-orange-600",
          actionLabel: "Urgente",
          actionIcon: AlertCircle
        };
      default:
        return {
          label: "Baixo",
          bgColor: "bg-amber-100",
          textColor: "text-amber-600",
          actionLabel: "Produzir",
          actionIcon: Wand2
        };
    }
  };
  return <div className="flex min-h-screen bg-gray-100">
    <AppSidebar />

    {/* Mobile Header */}
    {isMobile && <MobileHeader title="Dashboard" />}

    <main className={cn("flex-1 overflow-auto", isMobile ? "p-4 pt-[72px] pb-20" : "p-6")}>
      {/* Header com Filtros Reorganizados */}
      <div className="mb-6 sm:mb-8">
        {/* Título - apenas desktop */}
        {!isMobile && <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">DASHBOARD GERAL </h1>
            <p className="text-sm text-gray-500">
              Visão geral do desempenho e controle
            </p>
          </div>
        </div>}

        {/* Barra de Filtros */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          {isMobile ? (
            /* ── Mobile ─────────────────────────────────── */
            <div className="p-3 space-y-2.5">
              {/* Scroll de períodos */}
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5 scrollbar-hide">
                <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-0.5 shrink-0">
                  {periodos.map(p => (
                    <button key={p.value} onClick={() => handlePeriodoClick(p.value)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap",
                        periodo === p.value
                          ? "bg-white shadow-sm text-gray-900 font-semibold"
                          : "text-gray-500 hover:text-gray-700"
                      )}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all shrink-0",
                      periodo === "personalizado"
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                    )}>
                      <CalendarIcon size={13} />
                      {periodo === "personalizado" && dateRange.from && dateRange.to
                        ? `${format(dateRange.from, "dd/MM")} – ${format(dateRange.to, "dd/MM")}`
                        : "Personalizado"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <HolidayCalendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect}
                      numberOfMonths={1} locale={ptBR} initialFocus className="pointer-events-auto"
                      defaultMonth={dateRange.from} holidayMap={holidayMap} />
                  </PopoverContent>
                </Popover>
              </div>
              {/* Linha 2: toggle + limpar + exibindo */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setExcluirCancelados(v => !v)}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all",
                      !excluirCancelados
                        ? "bg-amber-50 border-amber-300 text-amber-700"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                    )}>
                    <span className={cn("w-1.5 h-1.5 rounded-full", !excluirCancelados ? "bg-amber-500" : "bg-gray-300")} />
                    Cancelados
                  </button>
                  <span className="text-xs text-muted-foreground">
                    {getPeriodoLabel()}
                  </span>
                </div>
                {hasActiveFilters && (
                  <button onClick={handleClearFilters}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors">
                    <X size={12} />
                    Limpar
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ── Desktop ─────────────────────────────────── */
            <div className="flex items-center gap-3 px-4 py-2.5">
              {/* Segmented control de período */}
              <div className="inline-flex items-center bg-gray-100 rounded-lg p-1 gap-0.5">
                {periodos.map(p => (
                  <button key={p.value} onClick={() => handlePeriodoClick(p.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                      periodo === p.value
                        ? "bg-white shadow-sm text-gray-900 font-semibold"
                        : "text-gray-500 hover:text-gray-700"
                    )}>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Botão de período personalizado */}
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                    periodo === "personalizado"
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
                  )}>
                    <CalendarIcon size={13} />
                    {periodo === "personalizado" && dateRange.from && dateRange.to ? (
                      <span>
                        {getYear(dateRange.from) !== getYear(dateRange.to)
                          ? `${format(dateRange.from, "dd/MM/yy")} – ${format(dateRange.to, "dd/MM/yy")}`
                          : `${format(dateRange.from, "dd/MM")} – ${format(dateRange.to, "dd/MM")}`}
                      </span>
                    ) : "Período"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <HolidayCalendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect}
                    numberOfMonths={2} locale={ptBR} initialFocus className="pointer-events-auto"
                    defaultMonth={dateRange.from} holidayMap={holidayMap} />
                </PopoverContent>
              </Popover>

              {/* Divisor */}
              <div className="w-px h-5 bg-gray-200 shrink-0" />

              {/* Toggle cancelados — chip estilo */}
              <button
                onClick={() => setExcluirCancelados(v => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                  !excluirCancelados
                    ? "bg-amber-50 border-amber-300 text-amber-700 shadow-sm"
                    : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300"
                )}>
                <span className={cn(
                  "w-2 h-2 rounded-full transition-colors",
                  !excluirCancelados ? "bg-amber-500" : "bg-gray-300"
                )} />
                Incluir cancelados
              </button>

              {/* Exibindo — texto compacto */}
              <span className="text-xs text-muted-foreground ml-1 hidden xl:block">
                Exibindo: <span className="font-medium text-foreground">{getPeriodoLabel()}</span>
              </span>

              {/* Limpar — só quando há filtros não-padrão */}
              {hasActiveFilters && (
                <button onClick={handleClearFilters}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                  <X size={13} />
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* KPI Cards - 2 columns on mobile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {loading ? <>
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </> : kpiCards.map(kpi => <Card 
            key={kpi.title} 
            className={cn(
              "bg-white rounded-xl shadow-sm border border-gray-200 transition-all duration-200 relative overflow-hidden", 
              kpi.clickable && "cursor-pointer hover:shadow-md active:scale-[0.98]"
            )} 
            onClick={kpi.clickable ? kpi.onClick : undefined}
          >
          {kpi.showBruto && <Badge variant="outline" className="absolute top-2 right-2 text-[8px] sm:text-[10px] bg-amber-50 text-amber-600 border-amber-200 px-1 py-0">
            Bruto
          </Badge>}
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3">
              {/* Top Row: Icon and Variation */}
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-indigo-600/10 flex items-center justify-center">
                  <kpi.icon size={isMobile ? 18 : 22} className="text-indigo-600" />
                </div>
                <div className="flex flex-col items-end">
                  <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-bold ${(kpi.invertVariation ? !kpi.variation.isPositive : kpi.variation.isPositive) ? "text-emerald-600" : "text-red-500"}`}>
                    {(kpi.invertVariation ? !kpi.variation.isPositive : kpi.variation.isPositive) ? <TrendingUp size={isMobile ? 12 : 14} /> : <TrendingDown size={isMobile ? 12 : 14} />}
                    <span>{kpi.variation.value.toFixed(1)}%</span>
                  </div>
                  <span className="text-[7px] sm:text-[9px] text-muted-foreground/60 uppercase font-medium">
                    vs. {anoPassado}
                  </span>
                </div>
              </div>

              {/* Main Info Row */}
              <div className="space-y-0.5">
                <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-none break-all">
                  {kpi.value}
                </p>
                <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest truncate">
                  {kpi.title}
                </p>
              </div>

              {/* Breakdown Tags (If any) */}
              {kpi.breakdown && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {kpi.breakdown
                    .filter((item: { label: string; value: number; colorClass: string }) => item.value >= 0)
                    .map((item: { label: string; value: number; colorClass: string }) => (
                      <span
                        key={item.label}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[10px] font-bold border border-transparent transition-colors shadow-sm ${item.colorClass}`}
                      >
                        <span className="opacity-70">{item.value}</span>
                        <span className="uppercase tracking-tighter">{item.label}</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>)}

        {/* Card Pareto 80/20 — Concentração de Vendas */}
        {!loading && (() => {
          const c = data.concentracaoVendas;
          const riscoConfig = {
            alto:  { bg: 'bg-red-50',     border: 'border-red-200',    icon: 'text-red-500',    label: 'Risco Alto',    labelClass: 'bg-red-100 text-red-700',    bar: 'bg-red-400' },
            medio: { bg: 'bg-amber-50',   border: 'border-amber-200',  icon: 'text-amber-500',  label: 'Risco Médio',   labelClass: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
            baixo: { bg: 'bg-emerald-50', border: 'border-emerald-200',icon: 'text-emerald-500',label: 'Saudável',      labelClass: 'bg-emerald-100 text-emerald-700', bar: 'bg-emerald-400' },
          } as const;
          const rc = riscoConfig[c.risco];

          return (
            <Card 
              className={cn("rounded-xl shadow-sm border transition-all duration-200 relative overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99]", rc.bg, rc.border)}
              onClick={() => navigate('/clientes?filter=top_pareto&sort=maior_historico')}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex flex-col gap-3">
                  {/* Top row */}
                  <div className="flex items-center justify-between w-full">
                    <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-white/70 flex items-center justify-center">
                      <ShieldAlert size={isMobile ? 18 : 22} className={rc.icon} />
                    </div>
                    <span className={cn("text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full", rc.labelClass)}>
                      {rc.label}
                    </span>
                  </div>

                  {/* Valor principal */}
                  <div className="space-y-0.5">
                    <p className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-none">
                      {c.totalClientes === 0 ? '—' : `${c.percentualReceitaTop20.toFixed(0)}%`}
                    </p>
                    <p className="text-[9px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                      Concentração 80/20
                    </p>
                  </div>

                  {/* Detalhes */}
                  {c.totalClientes > 0 && (
                    <div className="space-y-1.5">
                      {/* Barra de concentração */}
                      <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", rc.bar)}
                          style={{ width: `${Math.min(c.percentualReceitaTop20, 100)}%` }} />
                      </div>
                      <p className="text-[9px] sm:text-[10px] text-slate-500 leading-snug">
                        Top {c.top20pctClientes} de {c.totalClientes} clientes geram {c.percentualReceitaTop20.toFixed(0)}% da receita
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Vendas por Dia + Status de Pedidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">

        {/* ── Vendas por Dia ─────────────────────────────────── */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <CardContent className="p-4"><Skeleton className="h-[220px] w-full" /></CardContent>
          ) : (() => {
            const dias = data.faturamentoDiaSemana;
            const temDados = dias.some(d => d.valor > 0);
            if (!temDados) return (
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <CalendarIcon size={32} className="mb-2 opacity-20" />
                <p className="text-sm">Nenhuma venda no período</p>
              </CardContent>
            );
            const melhorDia = dias[0];
            const totalValor = dias.reduce((s, d) => s + d.valor, 0);
            const totalPedidosDia = dias.reduce((s, d) => s + d.pedidos, 0);
            const diasComVenda = dias.filter(d => d.valor > 0).length;
            const mediaDiaria = totalValor / Math.max(1, diasComVenda);
            const maxValor = melhorDia.valor;
            const periodoLabel = periodo === "hoje" ? "hoje" : periodo === "30dias" ? "30 dias" : periodo === "90dias" ? "90 dias" : periodo === "mes" ? "este mês" : periodo === "ano_atual" ? "este ano" : periodo === "12meses" ? "12 meses" : "período";
            return (
              <>
                <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <CalendarIcon size={15} className="text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground">Vendas por Dia</span>
                      <span className="text-xs text-muted-foreground">({periodoLabel})</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Faturamento e pedidos por dia da semana</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Melhor dia</div>
                    <div className="text-sm font-bold text-primary">{melhorDia.diaSemana.slice(0, 3)}</div>
                    <div className="text-xs font-semibold text-foreground tabular-nums">{formatCurrency(melhorDia.valor)}</div>
                  </div>
                </div>
                <div className="px-5 py-3 space-y-2">
                  {dias.map((dia, idx) => {
                    const pct = maxValor > 0 ? (dia.valor / maxValor) * 100 : 0;
                    const isTop = idx === 0;
                    const semVenda = dia.valor === 0;
                    const ticketMedio = dia.pedidos > 0 ? dia.valor / dia.pedidos : 0;
                    return (
                      <div key={dia.diaSemana} className="flex items-center gap-3">
                        <span className={cn("text-xs font-semibold w-7 shrink-0", isTop ? "text-primary" : "text-muted-foreground")}>
                          {dia.diaSemana.slice(0, 3)}
                        </span>
                        <div className="flex-1 relative h-6 bg-gray-100 rounded-md overflow-hidden">
                          {!semVenda && (
                            <div className={cn("h-full rounded-md transition-all duration-500", isTop ? "bg-primary" : "bg-primary/30")}
                              style={{ width: `${pct}%` }} />
                          )}
                          {!semVenda && (
                            <div className="absolute inset-y-0 left-2 flex items-center">
                              <span className={cn("text-[11px] font-bold tabular-nums",
                                pct > 35 ? (isTop ? "text-white" : "text-primary/90") : "text-foreground")}>
                                {formatCurrency(dia.valor)}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="shrink-0 text-right w-24 hidden sm:block">
                          <div className="text-xs font-semibold tabular-nums text-foreground">
                            {dia.pedidos > 0 ? `${dia.pedidos} ped` : <span className="text-muted-foreground/40">—</span>}
                          </div>
                          {ticketMedio > 0 && (
                            <div className="text-[10px] text-muted-foreground tabular-nums">~{formatCurrency(ticketMedio)}</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-5 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total: <strong className="text-foreground tabular-nums">{formatCurrency(totalValor)}</strong></span>
                  <span>Média: <strong className="text-foreground tabular-nums">{formatCurrency(mediaDiaria)}/dia</strong></span>
                  <span><strong className="text-foreground tabular-nums">{totalPedidosDia}</strong> pedidos</span>
                </div>
              </>
            );
          })()}
        </Card>

        {/* ── Status de Pedidos ──────────────────────────────── */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <CardContent className="p-4"><DonutChartSkeleton /></CardContent>
          ) : data.statusPedidos.length === 0 ? (
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package size={32} className="mb-2 opacity-20" />
              <p className="text-sm">Nenhum pedido no período</p>
            </CardContent>
          ) : (() => {
            const totalPedidos = data.statusPedidos.reduce((acc, s) => acc + s.count, 0);
            const sortedStatus = [...data.statusPedidos].sort((a, b) => b.count - a.count);
            const totalPendentes = sortedStatus
              .filter(s => ['PENDENTE', 'INCOMPLETO', 'PEND. ENTREGA'].includes(s.status))
              .reduce((s, p) => s + p.count, 0);
            return (
              <>
                <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <span className="text-sm font-bold text-foreground">Status de Pedidos</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Distribuição por status no período</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xl font-extrabold text-foreground tabular-nums">{totalPedidos}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">pedidos</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Donut */}
                  <div className="relative w-[80px] h-[80px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sortedStatus} cx="50%" cy="50%" innerRadius={24} outerRadius={38} paddingAngle={2} dataKey="count" nameKey="status">
                          {sortedStatus.map((entry, index) => (
                            <Cell key={`cell-st-${index}`} fill={entry.color}
                              className="cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => navigate(`/pedidos-criados?status=${entry.status}`)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: number, name: string) => [`${v} pedidos`, name]}
                          contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "0.5rem", fontSize: "0.8rem" }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-base font-black text-foreground">{totalPedidos}</span>
                      <span className="text-[8px] text-muted-foreground leading-none">ped</span>
                    </div>
                  </div>
                  {/* Barras de status */}
                  <div className="flex-1 space-y-2.5 min-w-0">
                    {sortedStatus.slice(0, 5).map(status => {
                      const pct = totalPedidos > 0 ? (status.count / totalPedidos) * 100 : 0;
                      const isCritical = ['INCOMPLETO', 'PENDENTE'].includes(status.status);
                      return (
                        <button key={status.status} onClick={() => navigate(`/pedidos-criados?status=${status.status}`)} className="w-full text-left group">
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                              <span className={cn("text-[11px] font-medium truncate", isCritical ? "text-amber-700 font-semibold" : "text-muted-foreground")}>
                                {status.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                              <span className="text-[11px] font-bold tabular-nums text-foreground">{status.count}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500 group-hover:opacity-75"
                              style={{ width: `${pct}%`, backgroundColor: status.color }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                {totalPendentes > 0 ? (
                  <button onClick={() => navigate('/pedidos-criados?status=PENDENTE,INCOMPLETO,PEND. ENTREGA')}
                    className="w-full flex items-center justify-between px-5 py-2.5 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      <strong>{totalPendentes}</strong> pedido{totalPendentes !== 1 ? 's' : ''} precisam de atenção
                    </span>
                    <span className="font-medium">Ver todos →</span>
                  </button>
                ) : (
                  <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    Nenhum pedido pendente de ação
                  </div>
                )}
              </>
            );
          })()}
        </Card>
      </div>

      {/* Card de Meta Mensal — Painel de Desempenho */}
      {(() => {
        const m = data.metaAutomatica;
        const p = data.previsaoMensal;
        const falta = Math.max(0, m.metaCalculada - m.faturamentoAtualMes);
        const diasRestantes = Math.max(0, p.diasTotais - p.diasDecorridos);
        const mediaNecessaria = diasRestantes > 0 ? falta / diasRestantes : 0;
        const ritmoOk = m.statusMeta === 'atingida' || m.statusMeta === 'acima' || m.statusMeta === 'noritmo';

        const statusConfig = {
          atingida:  { color: 'emerald', label: 'Meta atingida!',           Icon: CheckCircle2 },
          acima:     { color: 'emerald', label: 'Acima do ritmo esperado',  Icon: ArrowUp },
          noritmo:   { color: 'blue',    label: 'Dentro do ritmo esperado', Icon: CheckCircle2 },
          abaixo:    { color: 'amber',   label: 'Abaixo do ritmo esperado', Icon: ArrowDown },
        } as const;

        const st = statusConfig[m.statusMeta] ?? statusConfig.abaixo;

        return (
          <div className="mb-6">
            <Card className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 flex flex-col sm:flex-row gap-4">
                    <Skeleton className="h-28 flex-1" />
                    <Skeleton className="h-28 flex-1" />
                    <Skeleton className="h-28 flex-1" />
                  </div>
                ) : (
                  <>
                    {/* ── Header ─────────────────────────────────────── */}
                    <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Target size={16} className="text-primary shrink-0" />
                        <span className="text-sm font-bold text-foreground">Meta Mensal</span>
                        {m.temHistoricoSazonal ? (
                          <Badge className="text-[10px] h-5 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">
                            Sazonal +{m.percentualCrescimento.toFixed(0)}%
                          </Badge>
                        ) : m.temHistorico ? (
                          <Badge className="text-[10px] h-5 bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">
                            Média 3m +{m.percentualCrescimento.toFixed(0)}%
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-300">
                            Sem histórico
                          </Badge>
                        )}
                        {!m.curvaDisponivel && m.temHistorico && (
                          <Badge variant="outline" className="text-[10px] h-5 text-slate-500 border-slate-200">
                            Ritmo linear
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Base: {formatCurrency(m.mediaBase)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-lg font-extrabold text-foreground tabular-nums">
                          {formatCurrency(m.metaCalculada)}
                        </span>
                        <Popover open={metaConfigOpen} onOpenChange={setMetaConfigOpen}>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                              <Settings size={13} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64" align="end">
                            <div className="space-y-3">
                              <div className="space-y-1">
                                <Label className="text-xs font-semibold">% de Crescimento sobre a base</Label>
                                <div className="flex items-center gap-2">
                                  <Input type="number" value={percentualCrescimento}
                                    onChange={e => handlePercentualChange(parseFloat(e.target.value) || 0)}
                                    className="h-8 text-sm" min={0} max={100} />
                                  <span className="text-sm text-muted-foreground">%</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground">
                                  {m.temHistoricoSazonal
                                    ? 'Aplicado sobre a média do mesmo mês em anos anteriores'
                                    : 'Aplicado sobre a média dos últimos 3 meses'}
                                </p>
                              </div>
                              {m.temHistorico && (
                                <div className="text-[10px] text-muted-foreground border-t pt-2 space-y-1">
                                  <p className="font-semibold">Base: {m.mesesUsados.join(', ')}</p>
                                  {m.temHistoricoSazonal && Object.entries(m.faturamentosPorAno).map(([ano, valor]) => (
                                    <p key={ano}>{ano}: {formatCurrency(Number(valor))}</p>
                                  ))}
                                </div>
                              )}
                              <Button size="sm" className="w-full h-8" onClick={() => {
                                setMetaConfigOpen(false);
                                window.location.reload();
                              }}>
                                Aplicar
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    {/* ── 3 KPIs ──────────────────────────────────────── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                      {/* Realizado */}
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Banknote size={14} className="text-emerald-500" />
                          <span className="text-xs text-muted-foreground font-medium">Faturamento Atual</span>
                        </div>
                        <p className="text-xl font-extrabold text-foreground tabular-nums leading-tight">
                          {formatCurrency(m.faturamentoAtualMes)}
                        </p>
                        <p className={cn(
                          "text-xs font-semibold mt-0.5 tabular-nums",
                          m.percentualRealizado >= 100 ? "text-emerald-600" : "text-muted-foreground"
                        )}>
                          {m.metaCalculada > 0 ? `${m.percentualRealizado.toFixed(1)}% da meta` : '—'}
                        </p>
                      </div>

                      {/* Falta para meta */}
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Flame size={14} className={m.statusMeta === 'atingida' ? "text-emerald-500" : "text-amber-500"} />
                          <span className="text-xs text-muted-foreground font-medium">
                            {m.statusMeta === 'atingida' ? 'Meta atingida' : 'Falta para a meta'}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xl font-extrabold tabular-nums leading-tight",
                          m.statusMeta === 'atingida' ? "text-emerald-600" : "text-foreground"
                        )}>
                          {m.statusMeta === 'atingida' ? '✓ Concluída' : formatCurrency(falta)}
                        </p>
                        {m.statusMeta !== 'atingida' && diasRestantes > 0 ? (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''} restante{diasRestantes !== 1 ? 's' : ''}
                          </p>
                        ) : m.statusMeta === 'atingida' ? (
                          <p className="text-xs text-emerald-600 mt-0.5">Parabéns!</p>
                        ) : null}
                      </div>

                      {/* Ritmo / Projeção */}
                      <div className="px-5 py-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <TrendingUp size={14} className="text-blue-500" />
                          <span className="text-xs text-muted-foreground font-medium">Projeção do Mês</span>
                        </div>
                        <p className={cn(
                          "text-xl font-extrabold tabular-nums leading-tight",
                          p.projecaoMensal >= m.metaCalculada ? "text-emerald-600" : "text-foreground"
                        )}>
                          {formatCurrency(p.projecaoMensal)}
                        </p>
                        <p className={cn(
                          "text-xs font-semibold mt-0.5 tabular-nums",
                          m.diferencaRitmo >= 0 ? "text-emerald-600" : "text-amber-600"
                        )}>
                          {m.diferencaRitmo >= 0 ? '+' : ''}{m.diferencaRitmo.toFixed(1)}pp vs ritmo esperado
                        </p>
                      </div>
                    </div>

                    {/* ── Barras de Progresso ─────────────────────────── */}
                    {m.metaCalculada > 0 && (
                      <div className="px-5 pb-4 space-y-2.5">
                        {/* Barra esperado */}
                        <div>
                          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                            <span>Esperado até dia {p.diasDecorridos}</span>
                            <span className="tabular-nums">{m.percentualEsperadoHoje.toFixed(1)}%</span>
                          </div>
                          <Progress
                            value={Math.min(m.percentualEsperadoHoje, 100)}
                            className="h-1.5 bg-gray-100 [&>div]:bg-gray-300 rounded-full"
                          />
                        </div>

                        {/* Barra realizado */}
                        <div>
                          <div className="flex justify-between text-[11px] mb-1">
                            <span className="text-muted-foreground">Realizado</span>
                            <span className={cn(
                              "font-bold tabular-nums",
                              m.percentualRealizado >= 100 ? "text-emerald-600"
                                : m.percentualRealizado >= m.percentualEsperadoHoje ? "text-emerald-600"
                                : "text-amber-600"
                            )}>
                              {m.percentualRealizado.toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.min(m.percentualRealizado, 100)}
                            className={cn(
                              "h-2.5 bg-gray-100 rounded-full",
                              m.percentualRealizado >= m.percentualEsperadoHoje
                                ? "[&>div]:bg-indigo-600"
                                : "[&>div]:bg-amber-500"
                            )}
                          />
                        </div>

                        {/* Linha de contexto */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] sm:text-[11px] text-muted-foreground pt-1 gap-2">
                          <span className="font-medium">Dia {p.diasDecorridos} de {p.diasTotais}</span>
                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-0 pt-2 sm:pt-0">
                            <span className="flex flex-col sm:flex-row sm:gap-1">
                              Média atual: <strong className="text-foreground tabular-nums">{formatCurrency(p.mediaDiaria)}/dia</strong>
                            </span>
                            {m.statusMeta !== 'atingida' && diasRestantes > 0 && mediaNecessaria > 0 && (
                              <span className={cn(
                                "flex flex-col sm:flex-row sm:gap-1 font-medium tabular-nums",
                                mediaNecessaria > p.mediaDiaria ? "text-amber-600" : "text-emerald-600"
                              )}>
                                Necessária: <strong className="text-current">{formatCurrency(mediaNecessaria)}/dia</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Status Banner ───────────────────────────────── */}
                    {m.metaCalculada > 0 && (
                      <div className={cn(
                        "flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 px-5 py-3 border-t text-xs sm:text-sm font-medium",
                        st.color === 'emerald' ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                          : st.color === 'blue' ? "bg-blue-50 border-blue-100 text-blue-800"
                          : "bg-amber-50 border-amber-100 text-amber-800"
                      )}>
                        <div className="flex items-center gap-2">
                          <st.Icon size={15} className="shrink-0" />
                          <span>{st.label}</span>
                        </div>
                        {m.statusMeta === 'abaixo' && diasRestantes > 0 && mediaNecessaria > 0 && (
                          <span className="sm:ml-auto text-[10px] sm:text-xs font-normal opacity-80 tabular-nums">
                            Precisa de {formatCurrency(mediaNecessaria)}/dia para atingir a meta
                          </span>
                        )}
                      </div>
                    )}

                    {/* Sem histórico */}
                    {!m.temHistorico && (
                      <div className="px-5 py-3 border-t bg-muted/30">
                        <p className="text-xs text-muted-foreground">
                          A meta será calculada automaticamente com base no histórico de vendas. Continue registrando pedidos pagos.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        );
      })()}



      {/* Error banner - shown when data fetch fails */}
      {isError && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm mb-2">
          <AlertCircle size={16} className="flex-shrink-0" />
          <span>Erro ao carregar dados do dashboard. Verifique sua conexão e tente recarregar a página.</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto text-xs underline hover:no-underline font-medium"
          >
            Recarregar
          </button>
        </div>
      )}

      <TendenciaVendasChart 
        excluirCancelados={excluirCancelados}
        mode={trendMode}
        setMode={setTrendMode}
        salesTrend={salesTrend}
      />
      <RecebimentosTrendChart 
        mode={trendMode} 
        recebimentosTrend={recebimentosTrend}
      />



      {/* Bottom Grid - Ajustado para 3 COLUNAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top 5 Modelos */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top 10 Modelos</CardTitle>
            <p className="text-sm text-muted-foreground">
              Mais vendidos nesta semana (atualizado automaticamente)
            </p>
          </CardHeader>
          <CardContent>
            {loading ? <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </div> : data.topModelos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma venda no período
            </p> : <div className="space-y-4">
              {/* Aviso de cobertura quando < 60% */}
              {data.topModelosCoverage.coverage < 0.6 && data.topModelosCoverage.totalPedidos > 0 && <div className="flex items-start gap-2 p-2 rounded-md bg-amber-100/50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  Top 10 baseado apenas em {Math.round(data.topModelosCoverage.coverage * 100)}% dos pedidos
                  ({data.topModelosCoverage.pedidosComItens} de {data.topModelosCoverage.totalPedidos} têm itens detalhados)
                </span>
              </div>}
              <TooltipProvider delayDuration={200}>
                {data.topModelos.map((modelo, index) => (
                  <TooltipUI key={modelo.nome}>
                    <TooltipTrigger asChild>
                      <div
                        className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity"
                        onClick={() => {
                          if (isMobile) {
                            setSelectedModelo(modelo);
                          } else {
                            navigate(`/estoque?search=${encodeURIComponent(modelo.nome)}`);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] flex items-center justify-center font-bold flex-shrink-0">
                              {index + 1}
                            </span>
                            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border border-border/50 flex-shrink-0">
                              <LotImage src={modelo.imagemUrl} alt={modelo.nome} className="w-full h-full object-cover" />
                            </div>
                            <span
                              className="flex-1 leading-tight line-clamp-2 break-words text-sm font-semibold text-slate-700"
                              title={modelo.nome}
                              aria-label={modelo.nome}
                            >
                              {modelo.nome}
                            </span>
                          </span>
                          <span className="font-medium flex-shrink-0 ml-2">{modelo.quantidade} peças</span>
                        </div>
                        <Progress value={modelo.quantidade / maxModelo * 100} className="h-2" />
                      </div>
                    </TooltipTrigger>
                    {!isMobile && (
                      <TooltipContent side="top" className="max-w-[200px]">
                        <p className="font-medium">{modelo.nome}</p>
                        <p className="text-xs text-muted-foreground">{modelo.quantidade} unidades vendidas</p>
                      </TooltipContent>
                    )}
                  </TooltipUI>
                ))}
              </TooltipProvider>
            </div>}
          </CardContent>
        </Card>

        {/* Card de Taxas de Excursão */}
        <Card className="bg-white rounded-xl shadow-sm border border-orange-200/60">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Bus size={18} className="text-orange-600" />
              <CardTitle className="text-base font-semibold">Taxas de Excursão</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">A repassar — NO CARRO</p>
          </CardHeader>
          <CardContent>
            {taxasLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            ) : taxasExcursao.totalGeral === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum pedido NO CARRO com taxa
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(taxasExcursao.totalGeral)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {taxasExcursao.porExcursao.reduce((s, e) => s + e.numPedidos, 0)} pedido{taxasExcursao.porExcursao.reduce((s, e) => s + e.numPedidos, 0) !== 1 ? "s" : ""} com excursão
                  </p>
                </div>
                {taxasExcursao.porExcursao.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {taxasExcursao.porExcursao.map(exc => (
                      <div key={exc.excursaoId ?? exc.nome} className="flex items-center justify-between gap-2 bg-orange-50/60 rounded-lg px-3 py-1.5">
                        <span className="text-xs font-medium text-foreground truncate">{exc.nome}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-muted-foreground">{exc.numPedidos} ped.</span>
                          <span className="text-xs font-bold text-orange-700">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(exc.totalTaxa)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Produção por Etapa — redesenhado */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <CardContent className="p-4 space-y-3">
              <Skeleton className="h-6 w-32" />
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-8 w-full" />)}
            </CardContent>
          ) : (() => {
            const todasEtapas = data.producaoKanban;
            const etapaVendas = todasEtapas.find(e => e.etapa === "Vendas");
            const etapasProducao = todasEtapas.filter(e => e.etapa !== "Vendas" && e.pecas > 0);
            const totalEmProducao = etapasProducao.reduce((s, e) => s + e.pecas, 0);
            const totalProntas = etapaVendas?.pecas || 0;
            const totalGeral = totalEmProducao + totalProntas;
            const gargalos = etapasProducao.filter(e => e.isBottleneck);
            const maxPecas = etapasProducao.length > 0 ? Math.max(...etapasProducao.map(e => e.pecas)) : 1;

            if (totalGeral === 0) return (
              <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Factory size={32} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">Sem peças em produção</p>
                <p className="text-xs mt-1 opacity-70">Nenhuma peça registrada no Kanban</p>
              </CardContent>
            );

            return (
              <>
                {/* Header */}
                <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Factory size={15} className="text-primary shrink-0" />
                      <span className="text-sm font-bold text-foreground">Produção</span>
                      {gargalos.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-[10px] font-bold">
                          <AlertTriangle size={10} />
                          {gargalos.length} gargalo{gargalos.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Peças por etapa do Kanban</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-xs gap-1 h-7 shrink-0" onClick={() => navigate("/")}>
                    Ver Kanban <ChevronRight size={13} />
                  </Button>
                </div>

                {/* KPIs resumo */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
                  <div className="px-4 py-2.5 text-center">
                    <div className="text-lg font-extrabold text-foreground tabular-nums">{formatNumber(totalEmProducao)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Em produção</div>
                  </div>
                  <div className="px-4 py-2.5 text-center">
                    <div className="text-lg font-extrabold text-emerald-600 tabular-nums">{formatNumber(totalProntas)}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Prontas</div>
                  </div>
                  <div className="px-4 py-2.5 text-center">
                    <div className={cn("text-lg font-extrabold tabular-nums", gargalos.length > 0 ? "text-amber-600" : "text-muted-foreground")}>
                      {gargalos.length > 0 ? gargalos.length : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Gargalo{gargalos.length !== 1 ? 's' : ''}</div>
                  </div>
                </div>

                {/* Pipeline de etapas */}
                {etapasProducao.length > 0 ? (
                  <div className="px-5 py-3 space-y-2.5">
                    {etapasProducao.map(etapa => {
                      const pct = maxPecas > 0 ? (etapa.pecas / maxPecas) * 100 : 0;
                      const pctTotal = totalEmProducao > 0 ? (etapa.pecas / totalEmProducao) * 100 : 0;
                      return (
                        <button key={etapa.etapa} onClick={() => navigate("/")}
                          className={cn(
                            "w-full text-left group rounded-lg transition-all",
                            etapa.isBottleneck ? "ring-1 ring-amber-300 bg-amber-50/50 p-2" : "p-0"
                          )}>
                          <div className="flex items-center justify-between mb-1 px-0.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: etapa.color }} />
                              <span className={cn("text-[11px] font-semibold truncate",
                                etapa.isBottleneck ? "text-amber-800" : "text-muted-foreground")}>
                                {etapa.etapa}
                              </span>
                              {etapa.isBottleneck && (
                                <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 py-0.5 rounded shrink-0">GARGALO</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-2">
                              <span className="text-xs font-bold tabular-nums text-foreground">{formatNumber(etapa.pecas)}</span>
                              <span className="text-[10px] text-muted-foreground tabular-nums w-7 text-right">{pctTotal.toFixed(0)}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500 group-hover:opacity-75"
                              style={{ width: `${pct}%`, backgroundColor: etapa.isBottleneck ? '#f59e0b' : etapa.color }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : totalProntas > 0 ? (
                  <div className="px-5 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={16} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-emerald-700">Produção finalizada</p>
                      <p className="text-xs text-muted-foreground">
                        {formatNumber(totalProntas)} peça{totalProntas !== 1 ? 's' : ''} prontas para venda — nenhuma em etapa de produção
                      </p>
                    </div>
                  </div>
                ) : null}

                {/* Footer: gargalo alert ou status verde */}
                {gargalos.length > 0 ? (
                  <button onClick={() => navigate("/")}
                    className="w-full flex items-center justify-between px-5 py-2.5 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} />
                      Gargalo em <strong>{gargalos.map(g => g.etapa).join(', ')}</strong> — acúmulo acima do normal
                    </span>
                    <span className="font-medium shrink-0">Ver →</span>
                  </button>
                ) : totalProntas > 0 && etapasProducao.length === 0 ? (
                  <div className="px-5 py-2.5 bg-emerald-50 border-t border-emerald-100 text-xs text-emerald-700 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    Tudo pronto — {formatNumber(totalProntas)} peças disponíveis para venda
                  </div>
                ) : totalEmProducao > 0 ? (
                  <div className="px-5 py-2.5 bg-blue-50 border-t border-blue-100 text-xs text-blue-700 flex items-center gap-1.5">
                    <Factory size={13} />
                    {formatNumber(totalEmProducao)} peças em processamento — sem gargalos detectados
                  </div>
                ) : null}
              </>
            );
          })()}
        </Card>
      </div>

      {/* Modal: Detalhes do Modelo (Mobile) */}
      <Dialog open={!!selectedModelo} onOpenChange={(open) => !open && setSelectedModelo(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Detalhes do Modelo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Nome do Modelo</p>
              <p className="font-medium text-foreground">{selectedModelo?.nome}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Quantidade Vendida</p>
              <p className="text-2xl font-bold text-primary">{selectedModelo?.quantidade} un</p>
            </div>
            <Button
              className="w-full"
              onClick={() => {
                navigate(`/estoque?search=${encodeURIComponent(selectedModelo?.nome || '')}`);
                setSelectedModelo(null);
              }}
            >
              Ver no Estoque
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Detalhes do Status (Mobile) */}
      <Dialog open={!!selectedStatus} onOpenChange={(open) => !open && setSelectedStatus(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Status do Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-center">
            <div
              className="w-6 h-6 rounded-full mx-auto"
              style={{ backgroundColor: selectedStatus?.color }}
            />
            <p className="text-lg font-bold text-foreground">{selectedStatus?.status}</p>
            <p className="text-3xl font-bold text-primary">{selectedStatus?.count}</p>
            <p className="text-sm text-muted-foreground">
              {data.statusPedidos.reduce((acc, s) => acc + s.count, 0) > 0
                ? `${((selectedStatus?.count || 0) / data.statusPedidos.reduce((acc, s) => acc + s.count, 0) * 100).toFixed(1)}% do total`
                : '0% do total'
              }
            </p>
            <Button
              className="w-full"
              onClick={() => {
                navigate(`/pedidos-criados?status=${selectedStatus?.status}`);
                setSelectedStatus(null);
              }}
            >
              Ver Pedidos
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>

    {/* Bottom Navigation for Mobile */}
    <BottomNavigation />
  </div>;
}