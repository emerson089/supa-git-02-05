import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { LotImage } from "@/components/production/LotImage";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { BottomNavigation } from "@/components/layout/BottomNavigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip as TooltipUI, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { KpiCardSkeleton, ChartSkeleton, DonutChartSkeleton, ListItemSkeleton, TopModelosSkeleton, ProducaoKanbanSkeleton } from "@/components/ui/dashboard-skeleton";
import { Banknote, Package, AlertCircle, Factory, TrendingUp, TrendingDown, Calendar as CalendarIcon, AlertTriangle, ChevronRight, Wrench, Wand2, Target, Pencil, X, Filter, Settings, Bus } from "lucide-react";
import { useInsightsDashboard } from "@/hooks/useInsightsDashboard";
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";
import { useDashboardData, Periodo, DateRange, STATUS_COLORS, MetaYoY, TopModelo, StatusPedido, TopModelosCoverage, PrevisaoMensal, MetaAutomatica, FaturamentoDiaSemana } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format, startOfMonth, getYear, subDays, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Line, ComposedChart } from "recharts";
import { useSalesTrendChart, TrendDataPoint } from "@/hooks/useSalesTrendChart";
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

// Custom tooltip for sales trend chart
function TrendTooltip({
  active,
  payload,
  label,
  granularity,
  currentYear,
  previousYear
}: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload as TrendDataPoint;
    const isAno = granularity === "ano";

    const diff = data.atual - data.anterior;
    const isPositive = diff >= 0;
    const perc = data.anterior > 0 ? Math.abs((diff / data.anterior) * 100) : (data.atual > 0 ? 100 : 0);

    return (
      <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-lg min-w-[200px] z-50 text-sm text-gray-700">
        <p className="font-medium text-sm border-b border-gray-100 pb-2 mb-2 text-gray-800">
          {isAno ? `${label}` : `Dia ${label}`}
        </p>

        <div className="flex flex-col gap-2">
          {/* Atual */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span className="text-xs font-semibold text-foreground">{currentYear}</span>
            </div>
            <span className="text-sm font-bold text-primary">{formatCurrency(data.atual)}</span>
          </div>

          {/* Anterior */}
          {data.anterior > 0 && (
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full border border-muted-foreground bg-transparent"></div>
                <span className="text-xs text-muted-foreground">{previousYear}</span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{formatCurrency(data.anterior)}</span>
            </div>
          )}

          {/* Diferença */}
          {data.anterior > 0 && (
            <div className={`flex justify-between items-center mt-1 pt-2 border-t text-xs font-semibold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
              <span>Comparativo</span>
              <div className="flex items-center gap-1">
                {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatCurrency(Math.abs(diff))} ({perc.toFixed(1)}%)
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
}

// Renderiza pontos apenas nos picos (valores maiores ou menores significativos)
const renderCustomDot = (props: any) => {
  const { cx, cy, payload, index, value } = props;
  // payload é o elemento inteiro. data é o array?
  // O Recharts não passa o array inteiro facilmente via propriedades simples do dot, 
  // mas podemos apenas desenhar o dot se o valor atual > 0 
  // e se for um dia importante (ex: index % 5 === 0) no mes, ou todo mes no ano
  if (!value || payload.isFuture) return null;

  // Desenha no primeiro, último, ou a cada N pontos. Para 'ano', desenha todos.
  const isMes = payload.label.length <= 2; // "01", "02" vs "Jan", "Fev"
  const isRelevant = !isMes || index === 0 || index % 5 === 0 || value > 5000;

  if (isRelevant) {
    return (
      <circle cx={cx} cy={cy} r={3} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2} />
    );
  }
  return null;
};

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

  const {
    granularity,
    setGranularity,
    chartData: trendData,
    isLoading: trendLoading,
    currentYear: trendCurrentYear,
    previousYear: trendPreviousYear
  } = useSalesTrendChart(excluirCancelados);

  const { data: taxasExcursao, loading: taxasLoading } = useTaxasExcursao();

  // Calcular dateRange efetivo para insights
  const insightsDateRange = (() => {
    if (periodo === "personalizado" && dateRange.from && dateRange.to) {
      return { from: dateRange.from, to: dateRange.to };
    }
    const now = new Date();
    switch (periodo) {
      case "hoje": return { from: now, to: now };
      case "30dias": return { from: subDays(now, 30), to: now };
      case "90dias": return { from: subDays(now, 90), to: now };
      case "ano_atual": return { from: startOfYear(now), to: now };
      case "12meses": return { from: subMonths(now, 12), to: now };
      case "mes": default: return { from: startOfMonth(now), to: now };
    }
  })();

  const { insights: dashboardInsights, resumoExecutivo, sugestaoFoco } = useInsightsDashboard({
    kpis: data.kpis,
    metaAutomatica: data.metaAutomatica,
    tendenciaVendas: trendData,
    estoqueBaixo: data.estoqueBaixo,
    topModelos: data.topModelos,
    faturamentoDiaSemana: data.faturamentoDiaSemana,
    holidayMap,
    dateRange: insightsDateRange,
    loading,
  });

  const navigate = useNavigate();
  const isMobile = useIsMobile();
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
  }, {
    title: "Produção Ativa",
    value: `${formatNumber(data.kpis.producaoAtiva)} pçs`,
    icon: Factory,
    variation: calcVariation(data.kpis.producaoAtiva, data.kpis.producaoYoY),
    color: "text-violet-600",
    bgColor: "bg-violet-100",
    clickable: true,
    onClick: () => navigate("/producao"),
    showBruto: false
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

        {/* Card de Filtros */}
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="p-3 sm:p-4">
            {isMobile ? (/* Layout Mobile - Vertical */
              <div className="space-y-3">
                {/* Linha 1: Botões de período + Calendário */}
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                  {periodos.map(p => <Button key={p.value} variant={periodo === p.value ? "default" : "ghost"} size="sm" onClick={() => handlePeriodoClick(p.value)} className={cn("h-9 whitespace-nowrap flex-shrink-0 rounded-lg", periodo === p.value ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100")}>
                    {p.label}
                  </Button>)}

                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={periodo === "personalizado" ? "default" : "outline"} size="sm" className={cn("gap-2 h-9 flex-shrink-0", periodo === "personalizado" && "shadow-neu-inset")}>
                        <CalendarIcon size={14} />
                        {getDateRangeLabel()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <HolidayCalendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect} numberOfMonths={1} locale={ptBR} initialFocus className="pointer-events-auto" defaultMonth={dateRange.from} holidayMap={holidayMap} />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Linha 2: Switch + Limpar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch id="show-raw-mobile" checked={!excluirCancelados} onCheckedChange={checked => setExcluirCancelados(!checked)} />
                    <Label htmlFor="show-raw-mobile" className="text-xs text-muted-foreground cursor-pointer">
                      Incluir cancelados
                    </Label>
                  </div>

                  {hasActiveFilters && <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                    <X size={14} className="mr-1" />
                    Limpar
                  </Button>}
                </div>
              </div>) : (/* Layout Desktop - Horizontal */
              <div className="flex items-center justify-between gap-4">
                {/* Lado esquerdo: Filtros */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Filter size={14} />
                    <span className="text-xs font-medium">Filtros</span>
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Botões de período */}
                  <div className="flex items-center gap-1">
                    {periodos.map(p => <Button key={p.value} variant={periodo === p.value ? "default" : "ghost"} size="sm" onClick={() => handlePeriodoClick(p.value)} className={cn("h-8 rounded-lg", periodo === p.value ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100")}>
                      {p.label}
                    </Button>)}
                  </div>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Calendário */}
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button variant={periodo === "personalizado" ? "default" : "outline"} size="sm" className={cn("gap-2 h-8", periodo === "personalizado" && "shadow-neu-inset")}>
                        <CalendarIcon size={14} />
                        {periodo === "personalizado" && dateRange.from && dateRange.to ? <span className="font-medium">
                          {getYear(dateRange.from) !== getYear(dateRange.to)
                            ? `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                            : `${format(dateRange.from, "dd/MM")} - ${format(dateRange.to, "dd/MM")}`}
                        </span> : <span>Período</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <HolidayCalendar mode="range" selected={dateRange} onSelect={handleDateRangeSelect} numberOfMonths={2} locale={ptBR} initialFocus className="pointer-events-auto" defaultMonth={dateRange.from} holidayMap={holidayMap} />
                    </PopoverContent>
                  </Popover>

                  <Separator orientation="vertical" className="h-6" />

                  {/* Switch cancelados */}
                  <div className="flex items-center gap-2">
                    <Switch id="show-raw" checked={!excluirCancelados} onCheckedChange={checked => setExcluirCancelados(!checked)} />
                    <Label htmlFor="show-raw" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                      Incluir cancelados
                    </Label>
                  </div>
                </div>

                {/* Lado direito: Limpar filtros */}
                {hasActiveFilters && <Button variant="ghost" size="sm" onClick={handleClearFilters} className="h-8 px-2 text-muted-foreground hover:text-destructive">
                  <X size={14} className="mr-1" />
                  Limpar filtros
                </Button>}
              </div>)}

            {/* Indicador de Período Ativo */}
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
              <span className="text-xs text-muted-foreground">Exibindo:</span>
              <Badge variant="secondary" className="font-normal text-xs">
                {getPeriodoLabel()}
              </Badge>
              {!excluirCancelados && <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                + Cancelados
              </Badge>}
            </div>
          </CardContent>
        </Card>
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
      </div>

      {/* Card de Meta Automática + Faturamento + Ritmo Sazonal */}
      <div className="mb-6">
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardContent className="p-4 sm:p-6">
            {loading ? <div className="flex flex-col sm:flex-row gap-4">
              <Skeleton className="h-24 flex-1" />
              <Skeleton className="h-24 flex-1" />
              <Skeleton className="h-24 flex-1" />
            </div> : <>
              <div className="flex flex-col sm:flex-row gap-6 sm:gap-8">
                {/* Meta Mensal Calculada */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Target size={18} className="text-primary" />
                    <h3 className="text-sm font-semibold">Meta Mensal</h3>
                    {data.metaAutomatica.temHistoricoSazonal ? <Badge className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">
                      Sazonal + {data.metaAutomatica.percentualCrescimento.toFixed(0)}%
                    </Badge> : data.metaAutomatica.temHistorico ? <Badge className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-none">
                      Média 3m + {data.metaAutomatica.percentualCrescimento.toFixed(0)}%
                    </Badge> : <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                      Sem histórico
                    </Badge>}
                    <Popover open={metaConfigOpen} onOpenChange={setMetaConfigOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto">
                          <Settings size={12} className="text-muted-foreground" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64" align="end">
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <Label className="text-xs">% de Crescimento</Label>
                            <div className="flex items-center gap-2">
                              <Input type="number" value={percentualCrescimento} onChange={e => handlePercentualChange(parseFloat(e.target.value) || 0)} className="h-8 text-sm" min={0} max={100} />
                              <span className="text-sm text-muted-foreground">%</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                              {data.metaAutomatica.temHistoricoSazonal ? 'Aplicado sobre a média do mesmo mês em anos anteriores' : 'Aplicado sobre a média dos últimos 3 meses'}
                            </p>
                          </div>
                          {data.metaAutomatica.temHistorico && <div className="text-[10px] text-muted-foreground border-t pt-2 space-y-1">
                            <p className="font-medium">Base: {data.metaAutomatica.mesesUsados.join(', ')}</p>
                            {data.metaAutomatica.temHistoricoSazonal && Object.entries(data.metaAutomatica.faturamentosPorAno).map(([ano, valor]) => <p key={ano}>{ano}: {formatCurrency(Number(valor))}</p>)}
                          </div>}
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
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(data.metaAutomatica.metaCalculada)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Base: {formatCurrency(data.metaAutomatica.mediaBase)}
                  </p>
                </div>

                {/* Faturamento Atual */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Banknote size={18} className="text-emerald-500" />
                    <h3 className="text-sm font-semibold">Faturamento Atual</h3>
                  </div>
                  <p className="text-2xl font-bold text-foreground">
                    {formatCurrency(data.metaAutomatica.faturamentoAtualMes)}
                  </p>
                  <p className={cn("text-xs font-semibold", data.metaAutomatica.percentualRealizado >= 100 ? "text-emerald-600" : "text-muted-foreground")}>
                    {data.metaAutomatica.metaCalculada > 0 ? `${data.metaAutomatica.percentualRealizado.toFixed(1)}% da meta` : 'Meta não definida'}
                  </p>
                </div>

                {/* Ritmo Sazonal */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={18} className="text-blue-500" />
                    <h3 className="text-sm font-semibold">Ritmo Sazonal</h3>
                    {!data.metaAutomatica.curvaDisponivel && <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                      Linear
                    </Badge>}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <p className={cn("text-2xl font-bold", data.metaAutomatica.statusMeta === 'atingida' || data.metaAutomatica.statusMeta === 'acima' ? "text-emerald-600" : data.metaAutomatica.statusMeta === 'noritmo' ? "text-blue-600" : "text-amber-600")}>
                      {data.metaAutomatica.percentualRealizado.toFixed(1)}%
                    </p>
                    <span className="text-sm text-muted-foreground">
                      vs {data.metaAutomatica.percentualEsperadoHoje.toFixed(1)}% esperado
                    </span>
                  </div>
                  <p className={cn("text-xs font-semibold", data.metaAutomatica.diferencaRitmo >= 0 ? "text-emerald-600" : "text-amber-600")}>
                    {data.metaAutomatica.diferencaRitmo >= 0 ? '+' : ''}{data.metaAutomatica.diferencaRitmo.toFixed(1)}pp {data.metaAutomatica.diferencaRitmo >= 0 ? 'acima' : 'abaixo'} do ritmo
                  </p>
                </div>
              </div>

              {/* Barras de Progresso Comparativas */}
              {data.metaAutomatica.metaCalculada > 0 && <div className="mt-4 space-y-2">
                {/* Barra: % Esperado (sazonal) */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Esperado até dia {data.previsaoMensal.diasDecorridos}</span>
                    <span>{data.metaAutomatica.percentualEsperadoHoje.toFixed(1)}%</span>
                  </div>
                  <Progress value={Math.min(data.metaAutomatica.percentualEsperadoHoje, 100)} className="h-2 bg-gray-100 [&>div]:bg-gray-300" />
                </div>

                {/* Barra: % Realizado */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Realizado</span>
                    <span className={cn("font-semibold", data.metaAutomatica.percentualRealizado >= 100 ? "text-emerald-600" : data.metaAutomatica.percentualRealizado >= data.metaAutomatica.percentualEsperadoHoje ? "text-emerald-600" : "text-amber-600")}>
                      {data.metaAutomatica.percentualRealizado.toFixed(1)}%
                    </span>
                  </div>
                  <Progress value={Math.min(data.metaAutomatica.percentualRealizado, 100)} className={cn("h-3 bg-gray-100", data.metaAutomatica.percentualRealizado >= data.metaAutomatica.percentualEsperadoHoje ? "[&>div]:bg-indigo-600" : "[&>div]:bg-amber-500")} />
                </div>

                {/* Info: Dias e Ritmo */}
                <div className="flex justify-between text-xs text-muted-foreground pt-1">
                  <span>Dia {data.previsaoMensal.diasDecorridos} de {data.previsaoMensal.diasTotais}</span>
                  <span>Previsão: {formatCurrency(data.previsaoMensal.projecaoMensal)}</span>
                </div>
              </div>}

              {/* Indicador Visual de Status */}
              {data.metaAutomatica.metaCalculada > 0 && <div className={cn("mt-4 p-4 border-l-4 rounded-r-lg", data.metaAutomatica.statusMeta === 'atingida' ? "bg-emerald-50 border-emerald-500 text-emerald-800" : data.metaAutomatica.statusMeta === 'acima' ? "bg-emerald-50 border-emerald-500 text-emerald-800" : data.metaAutomatica.statusMeta === 'noritmo' ? "bg-blue-50 border-blue-500 text-blue-800" : "bg-amber-50 border-amber-500 text-amber-800")}>
                <p className={cn("text-sm font-medium")}>
                  {data.metaAutomatica.statusMeta === 'atingida' ? '🎉 Meta atingida!' : data.metaAutomatica.statusMeta === 'acima' ? '✅ Acima do ritmo sazonal para este dia do mês!' : data.metaAutomatica.statusMeta === 'noritmo' ? '👍 Dentro do ritmo sazonal esperado' : '⚠️ Ritmo abaixo do esperado para este dia do mês'}
                </p>
              </div>}

              {/* Mensagem quando não há histórico */}
              {!data.metaAutomatica.temHistorico && <div className="mt-4 p-3 rounded-lg bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  📊 A meta será calculada automaticamente com base no histórico de vendas.
                  Continue registrando pedidos pagos para gerar o histórico.
                </p>
              </div>}
            </>}
          </CardContent>
        </Card>
      </div>



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

      {/* Tendência de Vendas - Full Width, antes dos Insights */}
      <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Tendência de Vendas</CardTitle>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary"></span> {trendCurrentYear}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-muted-foreground bg-transparent"></span> {trendPreviousYear}</span>
                </p>
              </div>
            </div>
            <div className="flex bg-muted/50 p-1 rounded-lg">
              <button
                onClick={() => setGranularity("ano")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${granularity === "ano" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Ano
              </button>
              <button
                onClick={() => setGranularity("mes")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${granularity === "mes" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                Mês
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : trendData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-16">
              Nenhuma venda no período
            </p>
          ) : (
            <div>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="label"
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      stroke="#6B7280"
                      interval={granularity === "mes" ? 4 : 0}
                    />
                    <YAxis
                      fontSize={12}
                      tickLine={false}
                      axisLine={false}
                      stroke="#6B7280"
                      tickFormatter={(value: number) => value >= 1000 ? `R$${(value / 1000).toFixed(0)}k` : `R$${value}`}
                      width={55}
                    />
                    <Tooltip
                      content={<TrendTooltip granularity={granularity} currentYear={trendCurrentYear} previousYear={trendPreviousYear} />}
                      cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    {/* Linha do ano anterior */}
                    <Line
                      type="monotone"
                      dataKey="anterior"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="5 3"
                      strokeOpacity={0.7}
                      connectNulls={true}
                      dot={(props: any) => {
                        const { cx, cy, payload } = props;
                        const key = props.key ?? `dot-ant-${cx}-${cy}`;
                        if (!payload?.anterior || payload.anterior === 0) return <g key={key} />;
                        return <circle key={key} cx={cx} cy={cy} r={3} fill="hsl(var(--muted-foreground))" fillOpacity={0.7} stroke="none" />;
                      }}
                      activeDot={{ r: 4, fill: "hsl(var(--muted-foreground))", fillOpacity: 0.9 }}
                    />
                    <Area
                      type="monotone"
                      dataKey={(d) => d.isFuture && d.atual === 0 ? null : d.atual}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorAtual)"
                      dot={renderCustomDot}
                      activeDot={{ r: 6, strokeWidth: 2, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {/* Nota informativa no modo Mês */}
              {granularity === "mes" && (
                <p className="text-xs text-muted-foreground/60 text-center mt-2 flex items-center justify-center gap-1">
                  <span>📊</span>
                  <span>Comparativo com os mesmos dias de {trendPreviousYear} (período equivalente)</span>
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights do Período */}
      <InsightsPanel insights={dashboardInsights} resumoExecutivo={resumoExecutivo} sugestaoFoco={sugestaoFoco} />

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

        {/* NOVO: Vendas por Dia da Semana */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CalendarIcon size={18} className="text-primary" />
              <CardTitle className="text-base font-semibold">Vendas por Dia</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground">
              Faturamento por dia da semana
              <span className="ml-1 text-xs text-muted-foreground/60">
                ({periodo === "hoje" ? "hoje" :
                  periodo === "30dias" ? "30 dias" :
                    periodo === "90dias" ? "90 dias" :
                      periodo === "mes" ? "este mês" :
                        periodo === "ano_atual" ? "este ano" :
                          periodo === "12meses" ? "12 meses" : "período selecionado"})
              </span>
            </p>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-[180px] w-full" /> : data.faturamentoDiaSemana.every(d => d.valor === 0) ? <p className="text-sm text-muted-foreground text-center py-8">
              Nenhuma venda no período
            </p> : <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.faturamentoDiaSemana} layout="vertical" margin={{
                  left: -10,
                  right: 10
                }}>
                  <XAxis type="number" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} fontSize={12} stroke="#6B7280" />
                  <YAxis dataKey="diaSemana" type="category" width={55} fontSize={12} tickLine={false} axisLine={false} stroke="#6B7280" tickFormatter={value => value.slice(0, 3)} />
                  <Tooltip content={<WeekdayTooltip />} />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>}
          </CardContent>
        </Card>

        {/* Status de Pedidos */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Status de Pedidos</CardTitle>
            <p className="text-sm text-muted-foreground">Distribuição por status</p>
          </CardHeader>
          <CardContent>
            {loading ? <DonutChartSkeleton /> : data.statusPedidos.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum pedido no período
            </p> : (() => {
              const totalPedidos = data.statusPedidos.reduce((acc, s) => acc + s.count, 0);
              const sortedStatus = [...data.statusPedidos].sort((a, b) => b.count - a.count);
              // Limitar a 6 status, agrupar resto em "Outros"
              const topStatus = sortedStatus.slice(0, 6);
              const outrosStatus = sortedStatus.slice(6);
              const outrosCount = outrosStatus.reduce((acc, s) => acc + s.count, 0);
              const displayStatus = outrosCount > 0 ? [...topStatus, {
                status: 'OUTROS',
                count: outrosCount,
                color: '#9ca3af'
              }] : topStatus;
              return <div className="flex flex-col items-center gap-4">
                {/* Donut Chart with Center Label */}
                <div className="relative w-[100px] h-[100px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sortedStatus} cx="50%" cy="50%" innerRadius={30} outerRadius={45} paddingAngle={2} dataKey="count" nameKey="status">
                        {sortedStatus.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} className="cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate(`/pedidos-criados?status=${entry.status}`)} />)}
                      </Pie>
                      <Tooltip formatter={(value: number, name: string) => [`${value} pedidos`, name]} contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        color: "#374151",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)"
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Center Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-xl font-bold text-foreground">{totalPedidos}</span>
                    <span className="text-[9px] text-muted-foreground">pedidos</span>
                  </div>
                </div>

                {/* Status List - Grid compacto com tooltips */}
                <TooltipProvider delayDuration={200}>
                  <div className="w-full grid grid-cols-2 gap-x-3 gap-y-1">
                    {displayStatus.slice(0, 4).map(status => {
                      const percentage = totalPedidos > 0 ? (status.count / totalPedidos * 100).toFixed(0) : 0;
                      const isClickable = status.status !== 'OUTROS';
                      return (
                        <TooltipUI key={status.status}>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "flex items-center justify-between py-1 px-1.5 rounded text-left transition-colors min-w-0",
                                isClickable && "hover:bg-muted/50 cursor-pointer"
                              )}
                              onClick={() => {
                                if (isMobile && isClickable) {
                                  setSelectedStatus(status);
                                } else if (isClickable) {
                                  navigate(`/pedidos-criados?status=${status.status}`);
                                }
                              }}
                              disabled={!isClickable}
                              title={status.status}
                              aria-label={`${status.status}: ${status.count} pedidos (${percentage}%)`}
                            >
                              <div className="flex items-center gap-1 min-w-0 flex-1">
                                <div
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: status.color }}
                                />
                                <span
                                  className="text-[10px] text-muted-foreground line-clamp-2 break-words min-w-0"
                                >
                                  {status.status}
                                </span>
                              </div>
                              <span className="text-[10px] font-semibold flex-shrink-0 ml-1">{status.count}</span>
                            </button>
                          </TooltipTrigger>
                          {!isMobile && (
                            <TooltipContent side="top">
                              <p className="font-medium">{status.status}</p>
                              <p className="text-xs text-muted-foreground">
                                {status.count} pedidos ({percentage}%)
                              </p>
                            </TooltipContent>
                          )}
                        </TooltipUI>
                      );
                    })}
                  </div>
                </TooltipProvider>
              </div>;
            })()}
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

        {/* Produção por Etapa */}
        <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Produção</CardTitle>
                <p className="text-sm text-muted-foreground">Peças por etapa</p>
              </div>
              <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => navigate("/")}>
                Ver Kanban <ChevronRight size={14} />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div> : (() => {
              const etapasAtivas = data.producaoKanban.filter(e => e.pecas > 0);
              const totalPecasProducao = data.producaoKanban.reduce((sum, e) => sum + e.pecas, 0);

              if (totalPecasProducao === 0) {
                return <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <Factory size={24} className="mb-2 opacity-50" />
                  <span className="text-sm">Sem peças em produção</span>
                </div>;
              }

              if (etapasAtivas.length === 0) {
                return <div className="space-y-2">
                  <div className="text-center mb-3 pb-2 border-b">
                    <span className="text-2xl font-bold text-foreground">{formatNumber(totalPecasProducao)}</span>
                    <span className="text-sm text-muted-foreground ml-1">peças</span>
                  </div>
                  <p className="text-xs text-amber-600 text-center">Etapas não encontradas</p>
                </div>;
              }

              return <div className="space-y-2">
                {/* Total no topo */}
                <div className="text-center mb-3 pb-2 border-b">
                  <span className="text-2xl font-bold text-foreground">{formatNumber(totalPecasProducao)}</span>
                  <span className="text-sm text-muted-foreground ml-1">peças</span>
                </div>

                {/* Lista de etapas com nomes completos */}
                <TooltipProvider delayDuration={200}>
                  {etapasAtivas.map(etapa => (
                    <TooltipUI key={etapa.etapa}>
                      <TooltipTrigger asChild>
                        <div
                          className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                          style={{ backgroundColor: `${etapa.color}10` }}
                          onClick={() => navigate("/")}
                          title={etapa.etapa}
                          aria-label={`${etapa.etapa}: ${etapa.pecas} peças`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: etapa.color }}
                            />
                            <span
                              className="text-xs line-clamp-1 break-words min-w-0"
                              title={etapa.etapa}
                            >
                              {etapa.etapa}
                            </span>
                            {etapa.isBottleneck && <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />}
                          </div>
                          <span className="text-sm font-bold flex-shrink-0 ml-2" style={{ color: etapa.color }}>
                            {formatNumber(etapa.pecas)}
                          </span>
                        </div>
                      </TooltipTrigger>
                      {!isMobile && (
                        <TooltipContent side="left">
                          <p className="font-medium">{etapa.etapa}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(etapa.pecas)} peças</p>
                        </TooltipContent>
                      )}
                    </TooltipUI>
                  ))}
                </TooltipProvider>
              </div>;
            })()}
          </CardContent>
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