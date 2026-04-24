import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendMode, UseSalesTrendChartResult } from "@/hooks/useSalesTrendChart";

interface TendenciaVendasChartProps {
  excluirCancelados: boolean;
  mode: TrendMode;
  setMode: (m: TrendMode) => void;
  salesTrend: UseSalesTrendChartResult;
}

export function TendenciaVendasChart({ mode, setMode, salesTrend }: TendenciaVendasChartProps) {
  const { 
    chartData = [], 
    isLoading = false, 
    currentLabel = "", 
    previousLabel = "", 
    totals = { atual: 0, anterior: 0, deltaPct: null } 
  } = salesTrend;

  const renderCustomDot = (props: any) => {
    const { cx, cy, payload, index } = props;
    if (payload.isFuture && payload.atual === 0) return null;
    const isLastPoint = index === chartData.length - 1;
    if (isLastPoint) {
      return (
        <circle key={`dot-${index}`} cx={cx} cy={cy} r={4} fill="hsl(var(--primary))" stroke="white" strokeWidth={2} />
      );
    }
    return null;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-lg text-sm">
          <p className="font-bold mb-1 border-b pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 py-0.5">
              <span style={{ color: entry.color }}>{entry.name}:</span>
              <span className="font-mono font-medium">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(entry.value)}
              </span>
            </div>
          ))}
          {payload[0]?.payload.pedidosAtual > 0 && (
            <div className="mt-1 pt-1 border-t text-[10px] text-muted-foreground flex justify-between">
              <span>Volume:</span>
              <span>{payload[0].payload.pedidosAtual} ped / {payload[0].payload.pecasAtual} pçs</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading && chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50/50">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-slate-100 mb-4 bg-white/50 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg font-bold text-slate-800">Tendência de Vendas</CardTitle>
            {totals.deltaPct !== null && (
              <Badge variant={totals.deltaPct >= 0 ? "default" : "destructive"} className="h-5 px-1.5 text-[10px] font-bold">
                {totals.deltaPct >= 0 ? "+" : ""}{totals.deltaPct.toFixed(1)}%
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-primary/40" /> {currentLabel}
            </span>
            <span className="flex items-center gap-1 ml-2">
              <span className="w-2 h-2 rounded-full bg-slate-300" /> {previousLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100/50 rounded-lg">
          <button
            onClick={() => setMode({ granularity: 'year' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode.granularity === 'year' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Ano
          </button>
          <button
            onClick={() => setMode({ granularity: 'month', submode: 'yoy' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode.granularity === 'month' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Mês
          </button>
          <button
            onClick={() => setMode({ granularity: 'week', submode: 'wow' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${mode.granularity === 'week' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Semana
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-4 px-2 sm:px-6">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorAtual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                minTickGap={20}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Previous Period - Subtle Area */}
              <Area
                name={previousLabel}
                type="monotone"
                dataKey="anterior"
                stroke="#cbd5e1"
                strokeWidth={1}
                strokeDasharray="4 4"
                fill="transparent"
                dot={false}
                activeDot={false}
              />

              {/* Current Period - Main Gradient Area */}
              <Area
                name={currentLabel}
                type="monotone"
                dataKey="atual"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#colorAtual)"
                dot={renderCustomDot}
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
