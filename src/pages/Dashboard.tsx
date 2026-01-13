import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
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
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { 
  KpiCardSkeleton, 
  ChartSkeleton, 
  DonutChartSkeleton, 
  ListItemSkeleton, 
  TopModelosSkeleton,
  ProducaoKanbanSkeleton 
} from "@/components/ui/dashboard-skeleton";
import { 
  Banknote, 
  Package, 
  AlertCircle, 
  Factory, 
  TrendingUp, 
  TrendingDown,
  Calendar as CalendarIcon,
  AlertTriangle,
  ChevronRight,
  Wrench,
  Wand2,
  Target,
  Pencil,
  X,
  Filter,
} from "lucide-react";
import { useDashboardData, Periodo, DateRange, TendenciaVenda, TipoAgrupamento, STATUS_COLORS, MetaYoY } from "@/hooks/useDashboardData";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { format, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function calcVariation(atual: number, anterior: number): { value: number; isPositive: boolean } {
  if (anterior === 0) return { value: 0, isPositive: true };
  const variation = ((atual - anterior) / anterior) * 100;
  return { value: Math.abs(variation), isPositive: variation >= 0 };
}

// Custom tooltip for sales trend chart
function CustomTooltip({ 
  active, 
  payload,
  tipoAgrupamento 
}: { 
  active?: boolean; 
  payload?: Array<{ payload: TendenciaVenda }>;
  tipoAgrupamento?: TipoAgrupamento;
}) {
  if (active && payload?.[0]) {
    const data = payload[0].payload;
    return (
      <div className="bg-card p-3 rounded-lg border shadow-lg">
        <p className="font-medium text-sm">{data.diaCompleto}</p>
        <p className="text-primary font-bold text-lg">{formatCurrency(data.valor)}</p>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span>{data.pedidos} pedidos</span>
          <span>{data.pecas} peças</span>
        </div>
      </div>
    );
  }
  return null;
}

export default function Dashboard() {
  // Estado inicial vindo do localStorage
  const [periodo, setPeriodo] = useState<Periodo>(() => {
    const saved = localStorage.getItem('dashboard-periodo');
    return (saved as Periodo) || 'mes';
  });
  
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const saved = localStorage.getItem('dashboard-daterange');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          from: parsed.from ? new Date(parsed.from) : undefined,
          to: parsed.to ? new Date(parsed.to) : undefined,
        };
      } catch {
        return { from: undefined, to: undefined };
      }
    }
    return { from: undefined, to: undefined };
  });
  
  const [excluirCancelados, setExcluirCancelados] = useState(() => {
    const saved = localStorage.getItem('dashboard-excluir-cancelados');
    return saved !== null ? saved === 'true' : true;
  });
  
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Persistir mudanças no localStorage
  useEffect(() => {
    localStorage.setItem('dashboard-periodo', periodo);
  }, [periodo]);

  useEffect(() => {
    localStorage.setItem('dashboard-daterange', JSON.stringify({
      from: dateRange.from?.toISOString(),
      to: dateRange.to?.toISOString(),
    }));
  }, [dateRange]);

  useEffect(() => {
    localStorage.setItem('dashboard-excluir-cancelados', String(excluirCancelados));
  }, [excluirCancelados]);
  
  const { data, loading } = useDashboardData(periodo, dateRange, excluirCancelados);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const periodos: { label: string; value: Periodo }[] = [
    { label: "Hoje", value: "hoje" },
    { label: "7 dias", value: "7dias" },
    { label: "Mês", value: "mes" },
  ];

  // Verifica se há filtros ativos (diferente do padrão)
  const hasActiveFilters = periodo !== 'mes' || dateRange.from !== undefined || !excluirCancelados;

  const handleClearFilters = () => {
    setPeriodo('mes');
    setDateRange({ from: undefined, to: undefined });
    setExcluirCancelados(true);
    setCalendarOpen(false);
  };

  const handlePeriodoClick = (value: Periodo) => {
    setPeriodo(value);
    if (value !== "personalizado") {
      setDateRange({ from: undefined, to: undefined });
    }
  };

  const handleDateRangeSelect = (range: { from?: Date; to?: Date } | undefined) => {
    if (range) {
      setDateRange({ from: range.from, to: range.to });
      if (range.from && range.to) {
        setPeriodo("personalizado");
        setCalendarOpen(false);
      }
    }
  };

  const getPeriodoLabel = () => {
    switch (periodo) {
      case 'hoje':
        return 'Hoje';
      case '7dias':
        return 'Últimos 7 dias';
      case 'mes':
        return `${format(startOfMonth(new Date()), "dd/MM")} - ${format(new Date(), "dd/MM")} (Mês atual)`;
      case 'personalizado':
        if (dateRange.from && dateRange.to) {
          return `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`;
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

  const kpiCards = [
    {
      title: "Faturamento Total",
      value: formatCurrency(data.kpis.faturamento),
      icon: Banknote,
      variation: calcVariation(data.kpis.faturamento, data.kpis.faturamentoYoY),
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
      clickable: false,
      showBruto: !excluirCancelados,
    },
    {
      title: "Peças Vendidas",
      value: `${formatNumber(data.kpis.pecasVendidas)} un`,
      icon: Package,
      variation: calcVariation(data.kpis.pecasVendidas, data.kpis.pecasYoY),
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      clickable: false,
      showBruto: !excluirCancelados,
    },
    {
      title: "Pedidos Pendentes",
      value: formatNumber(data.kpis.pedidosPendentes),
      icon: AlertCircle,
      variation: calcVariation(data.kpis.pedidosPendentes, data.kpis.pedidosYoY),
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      invertVariation: true,
      clickable: true,
      onClick: () => navigate("/pedidos/criados?status=PENDENTE,INCOMPLETO"),
      showBruto: false,
    },
    {
      title: "Produção Ativa",
      value: `${formatNumber(data.kpis.producaoAtiva)} pçs`,
      icon: Factory,
      variation: calcVariation(data.kpis.producaoAtiva, data.kpis.producaoYoY),
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      clickable: true,
      onClick: () => navigate("/"),
      showBruto: false,
    },
  ];

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

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      
      {/* Mobile Header */}
      {isMobile && <MobileHeader title="Dashboard" />}

      <main className={cn(
        "flex-1 overflow-auto",
        isMobile ? "p-4 pt-[72px] pb-20" : "p-6"
      )}>
        {/* Header com Filtros Reorganizados */}
        <div className="mb-6 sm:mb-8">
          {/* Título - apenas desktop */}
          {!isMobile && (
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard Geral</h1>
                <p className="text-muted-foreground text-sm">
                  Visão geral do desempenho e controle
                </p>
              </div>
            </div>
          )}

          {/* Card de Filtros */}
          <Card className="border-border/50 bg-muted/30">
            <CardContent className="p-3 sm:p-4">
              {isMobile ? (
                /* Layout Mobile - Vertical */
                <div className="space-y-3">
                  {/* Linha 1: Botões de período + Calendário */}
                  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                    {periodos.map((p) => (
                      <Button
                        key={p.value}
                        variant={periodo === p.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePeriodoClick(p.value)}
                        className={cn(
                          "h-9 whitespace-nowrap flex-shrink-0",
                          periodo === p.value && "shadow-neu-inset"
                        )}
                      >
                        {p.label}
                      </Button>
                    ))}
                    
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant={periodo === "personalizado" ? "default" : "outline"} 
                          size="sm" 
                          className={cn(
                            "gap-2 h-9 flex-shrink-0",
                            periodo === "personalizado" && "shadow-neu-inset"
                          )}
                        >
                          <CalendarIcon size={14} />
                          {getDateRangeLabel()}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={handleDateRangeSelect}
                          numberOfMonths={1}
                          locale={ptBR}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  {/* Linha 2: Switch + Limpar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="show-raw-mobile" 
                        checked={!excluirCancelados}
                        onCheckedChange={(checked) => setExcluirCancelados(!checked)}
                      />
                      <Label htmlFor="show-raw-mobile" className="text-xs text-muted-foreground cursor-pointer">
                        Incluir cancelados
                      </Label>
                    </div>
                    
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                      >
                        <X size={14} className="mr-1" />
                        Limpar
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                /* Layout Desktop - Horizontal */
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
                      {periodos.map((p) => (
                        <Button
                          key={p.value}
                          variant={periodo === p.value ? "default" : "ghost"}
                          size="sm"
                          onClick={() => handlePeriodoClick(p.value)}
                          className={cn(
                            "h-8",
                            periodo === p.value && "shadow-neu-inset"
                          )}
                        >
                          {p.label}
                        </Button>
                      ))}
                    </div>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    {/* Calendário */}
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant={periodo === "personalizado" ? "default" : "outline"} 
                          size="sm" 
                          className={cn(
                            "gap-2 h-8",
                            periodo === "personalizado" && "shadow-neu-inset"
                          )}
                        >
                          <CalendarIcon size={14} />
                          {periodo === "personalizado" && dateRange.from && dateRange.to ? (
                            <span className="font-medium">
                              {format(dateRange.from, "dd/MM")} - {format(dateRange.to, "dd/MM")}
                            </span>
                          ) : (
                            <span>Período</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="range"
                          selected={dateRange}
                          onSelect={handleDateRangeSelect}
                          numberOfMonths={2}
                          locale={ptBR}
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    
                    <Separator orientation="vertical" className="h-6" />
                    
                    {/* Switch cancelados */}
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="show-raw" 
                        checked={!excluirCancelados}
                        onCheckedChange={(checked) => setExcluirCancelados(!checked)}
                      />
                      <Label htmlFor="show-raw" className="text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                        Incluir cancelados
                      </Label>
                    </div>
                  </div>
                  
                  {/* Lado direito: Limpar filtros */}
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearFilters}
                      className="h-8 px-2 text-muted-foreground hover:text-destructive"
                    >
                      <X size={14} className="mr-1" />
                      Limpar filtros
                    </Button>
                  )}
                </div>
              )}
              
              {/* Indicador de Período Ativo */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
                <span className="text-xs text-muted-foreground">Exibindo:</span>
                <Badge variant="secondary" className="font-normal text-xs">
                  {getPeriodoLabel()}
                </Badge>
                {!excluirCancelados && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs">
                    + Cancelados
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Meta YoY Card - Destaque */}
        <div className="mb-6">
          <Card className="neu-card border-primary/20 shadow-lg bg-gradient-to-br from-card to-primary/5">
            <CardContent className="p-4 sm:p-6">
              {loading ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <Skeleton className="h-24 flex-1" />
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 sm:items-center">
                  {/* Ícone e título */}
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Target size={24} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">Meta Mensal (YoY)</h3>
                      <p className="text-xs text-muted-foreground capitalize">
                        {data.metaYoY.mesAtual} {new Date().getFullYear()}
                      </p>
                    </div>
                  </div>

                  {/* Conteúdo principal */}
                  {data.metaYoY.temDadosAnoPassado ? (
                    <div className="flex-1 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">Meta (+15%)</p>
                          <p className="text-xl sm:text-2xl font-bold text-foreground">
                            {formatCurrency(data.metaYoY.metaAnual)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Base {data.metaYoY.anoPassado}: {formatCurrency(data.metaYoY.faturamentoAnoPassado)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Faturado</p>
                          <p className="text-xl sm:text-2xl font-bold text-primary">
                            {formatCurrency(data.metaYoY.faturamentoAtualAcumulado)}
                          </p>
                          <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold justify-end",
                            data.metaYoY.variacaoVsMesmoDia >= 0 ? "text-emerald-600" : "text-red-500"
                          )}>
                            {data.metaYoY.variacaoVsMesmoDia >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span>{Math.abs(data.metaYoY.variacaoVsMesmoDia).toFixed(1)}% vs. mesmo dia</span>
                          </div>
                        </div>
                      </div>

                      {/* Barra de progresso */}
                      <div className="space-y-1">
                        <Progress 
                          value={Math.min(data.metaYoY.percentualAtingido, 100)} 
                          className={cn(
                            "h-3",
                            data.metaYoY.percentualAtingido >= 80 ? "[&>div]:bg-emerald-500" :
                            data.metaYoY.percentualAtingido >= 50 ? "[&>div]:bg-amber-500" :
                            "[&>div]:bg-red-500"
                          )}
                        />
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-muted-foreground">
                            {data.metaYoY.faltaParaMeta > 0 
                              ? `Faltam ${formatCurrency(data.metaYoY.faltaParaMeta)} para superar ${data.metaYoY.mesAtual} ${data.metaYoY.anoPassado}`
                              : `🎉 Meta de ${data.metaYoY.anoPassado} superada!`
                            }
                          </span>
                          <span className={cn(
                            "text-sm font-bold",
                            data.metaYoY.percentualAtingido >= 80 ? "text-emerald-600" :
                            data.metaYoY.percentualAtingido >= 50 ? "text-amber-600" :
                            "text-red-500"
                          )}>
                            {data.metaYoY.percentualAtingido.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex items-center justify-center py-4">
                      <div className="text-center">
                        <p className="text-sm text-muted-foreground mb-2">
                          Sem dados de {data.metaYoY.mesAtual} {data.metaYoY.anoPassado}
                        </p>
                        <Button variant="outline" size="sm" className="gap-2">
                          <Pencil size={14} />
                          Definir meta manual
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* KPI Cards - 2 columns on mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          {loading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : kpiCards.map((kpi) => (
            <Card 
              key={kpi.title} 
              className={cn(
                "neu-card transition-all duration-200 relative",
                kpi.clickable && "cursor-pointer hover:scale-[1.02] hover:shadow-lg"
              )}
              onClick={kpi.clickable ? kpi.onClick : undefined}
            >
              {kpi.showBruto && (
                <Badge 
                  variant="outline" 
                  className="absolute top-2 right-2 text-[10px] bg-amber-50 text-amber-600 border-amber-200"
                >
                  Bruto
                </Badge>
              )}
              <CardContent className="p-3 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl ${kpi.bgColor} flex items-center justify-center mb-2 sm:mb-3`}>
                      <kpi.icon size={isMobile ? 16 : 20} className={kpi.color} />
                    </div>
                    <p className="text-xl sm:text-3xl font-bold text-foreground tracking-tight">{kpi.value}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground/70 uppercase tracking-wide mt-1 line-clamp-1">{kpi.title}</p>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className={`flex items-center gap-1 text-[10px] sm:text-xs font-semibold ${
                      (kpi.invertVariation ? !kpi.variation.isPositive : kpi.variation.isPositive) 
                        ? "text-emerald-600" 
                        : "text-red-500"
                    }`}>
                      {(kpi.invertVariation ? !kpi.variation.isPositive : kpi.variation.isPositive) 
                        ? <TrendingUp size={isMobile ? 12 : 14} /> 
                        : <TrendingDown size={isMobile ? 12 : 14} />
                      }
                      <span>{kpi.variation.value.toFixed(1)}%</span>
                    </div>
                    <span className="text-[8px] sm:text-[10px] text-muted-foreground/50 mt-0.5">
                      vs. mesmo período de {anoPassado}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Tendência de Vendas - Takes 2 columns */}
          <Card className="neu-card lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Tendência de Vendas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Receita {data.tipoAgrupamento === "dia" ? "diária" : data.tipoAgrupamento === "semana" ? "semanal" : "mensal"} no período
              </p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : data.tendenciaVendas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  Nenhuma venda no período
                </p>
              ) : (
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.tendenciaVendas}>
                      <defs>
                        <linearGradient id="colorValor" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis 
                        dataKey="dia" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip content={<CustomTooltip tipoAgrupamento={data.tipoAgrupamento} />} />
                      <Area
                        type="monotone"
                        dataKey="valor"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValor)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Estoque Baixo */}
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={18} className="text-amber-500" />
                  <CardTitle className="text-base font-semibold">Estoque Crítico</CardTitle>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs gap-1"
                  onClick={() => navigate("/estoque")}
                >
                  Ver tudo <ChevronRight size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : data.estoqueBaixo.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum item com estoque baixo
                </p>
              ) : (
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {data.estoqueBaixo.map((item) => {
                      const statusConfig = getEstoqueStatusConfig(item.status);
                      const ActionIcon = statusConfig.actionIcon;
                      
                      return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all hover:scale-[1.01]",
                            statusConfig.bgColor
                          )}
                          onClick={() => navigate(`/estoque?search=${encodeURIComponent(item.nome)}`)}
                        >
                          <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center overflow-hidden">
                            {item.imagem_url ? (
                              <img src={item.imagem_url} alt={item.nome} className="w-full h-full object-cover" />
                            ) : (
                              <Package size={18} className="text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.nome}</p>
                            <div className="flex items-center gap-2">
                              <span className={cn("text-xs font-semibold", statusConfig.textColor)}>
                                Restam: {item.quantidade}
                              </span>
                              <Badge variant="outline" className={cn("text-[10px] px-1 py-0", statusConfig.textColor)}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className={cn("h-7 text-xs gap-1", statusConfig.textColor)}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/estoque?search=${encodeURIComponent(item.nome)}`);
                            }}
                          >
                            <ActionIcon size={12} />
                            {statusConfig.actionLabel}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Top 5 Modelos */}
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Top 5 Modelos</CardTitle>
              <p className="text-sm text-muted-foreground">Mais vendidos no período</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : data.topModelos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma venda no período
                </p>
              ) : (
                <div className="space-y-4">
                  {data.topModelos.map((modelo, index) => (
                    <div 
                      key={modelo.nome} 
                      className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => navigate(`/estoque?search=${encodeURIComponent(modelo.nome)}`)}
                    >
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">
                            {index + 1}
                          </span>
                          <span className="flex-1 leading-tight" title={modelo.nome}>{modelo.nome}</span>
                        </span>
                        <span className="font-medium">{modelo.quantidade} un</span>
                      </div>
                      <Progress 
                        value={(modelo.quantidade / maxModelo) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Status de Pedidos */}
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Status de Pedidos</CardTitle>
              <p className="text-sm text-muted-foreground">Distribuição por status</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <DonutChartSkeleton />
              ) : data.statusPedidos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum pedido no período
                </p>
              ) : (() => {
                const totalPedidos = data.statusPedidos.reduce((acc, s) => acc + s.count, 0);
                const sortedStatus = [...data.statusPedidos].sort((a, b) => b.count - a.count);
                // Limitar a 6 status, agrupar resto em "Outros"
                const topStatus = sortedStatus.slice(0, 6);
                const outrosStatus = sortedStatus.slice(6);
                const outrosCount = outrosStatus.reduce((acc, s) => acc + s.count, 0);
                const displayStatus = outrosCount > 0 
                  ? [...topStatus, { status: 'OUTROS', count: outrosCount, color: '#9ca3af' }]
                  : topStatus;
                
                return (
                  <div className="flex flex-col items-center gap-4">
                    {/* Donut Chart with Center Label */}
                    <div className="relative w-[130px] h-[130px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={sortedStatus}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={2}
                            dataKey="count"
                            nameKey="status"
                          >
                            {sortedStatus.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={entry.color}
                                className="cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => navigate(`/pedidos-criados?status=${entry.status}`)}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string) => [`${value} pedidos`, name]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      {/* Center Label */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-2xl font-bold text-foreground">{totalPedidos}</span>
                        <span className="text-[10px] text-muted-foreground">pedidos</span>
                      </div>
                    </div>
                    
                    {/* Status List - Grid compacto */}
                    <div className="w-full grid grid-cols-2 gap-x-4 gap-y-1">
                      {displayStatus.map((status) => {
                        const percentage = totalPedidos > 0 ? ((status.count / totalPedidos) * 100).toFixed(0) : 0;
                        const isClickable = status.status !== 'OUTROS';
                        
                        return (
                          <button 
                            key={status.status}
                            className={cn(
                              "flex items-center justify-between py-1 px-1.5 rounded text-left transition-colors",
                              isClickable && "hover:bg-muted/50 cursor-pointer"
                            )}
                            onClick={() => isClickable && navigate(`/pedidos-criados?status=${status.status}`)}
                            disabled={!isClickable}
                          >
                            <div className="flex items-center gap-1.5">
                              <div 
                                className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ backgroundColor: status.color }}
                              />
                              <span className="text-[11px] text-muted-foreground">
                                {status.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-semibold">{status.count}</span>
                              <span className="text-[10px] text-muted-foreground">({percentage}%)</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Produção por Etapa */}
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">Produção</CardTitle>
                  <p className="text-sm text-muted-foreground">Peças por etapa</p>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs gap-1"
                  onClick={() => navigate("/")}
                >
                  Ver Kanban <ChevronRight size={14} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (() => {
                const etapasAtivas = data.producaoKanban.filter(e => e.pecas > 0);
                
                if (etapasAtivas.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <Factory size={24} className="mb-2 opacity-50" />
                      <span className="text-sm">Sem movimentação</span>
                    </div>
                  );
                }
                
                return (
                  <div className={cn(
                    "grid gap-2",
                    etapasAtivas.length === 1 ? "grid-cols-1" :
                    etapasAtivas.length === 2 ? "grid-cols-2" :
                    etapasAtivas.length === 3 ? "grid-cols-3" :
                    etapasAtivas.length === 4 ? "grid-cols-4" :
                    "grid-cols-5"
                  )}>
                    {etapasAtivas.map((etapa) => (
                      <div 
                        key={etapa.etapa}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-lg text-center cursor-pointer transition-all hover:scale-105",
                          etapa.isBottleneck && "ring-2 ring-amber-400 animate-pulse"
                        )}
                        style={{ backgroundColor: `${etapa.color}20` }}
                        onClick={() => navigate("/")}
                      >
                        {etapa.isBottleneck && (
                          <AlertTriangle size={12} className="text-amber-500 mb-0.5" />
                        )}
                        <span 
                          className="text-lg font-bold"
                          style={{ color: etapa.color }}
                        >
                          {formatNumber(etapa.pecas)}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate w-full">
                          {etapa.etapa.slice(0, 4)}.
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Bottom Navigation for Mobile */}
      <BottomNavigation />
    </div>
  );
}
