import React from "react";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Area } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { TrendMode } from "@/hooks/useSalesTrendChart";

interface RecebimentosTrendChartProps {
  mode: TrendMode;
  recebimentosTrend: any;
}

export function RecebimentosTrendChart({ mode, recebimentosTrend }: RecebimentosTrendChartProps) {
  const { 
    chartData = [], 
    isLoading = false, 
    currentLabel = "", 
    previousLabel = "", 
    totals = { atual: 0, anterior: 0, deltaPct: null } 
  } = recebimentosTrend;

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
          {payload[0]?.payload.qtdAtual > 0 && (
            <div className="mt-1 pt-1 border-t text-[10px] text-muted-foreground flex justify-between">
              <span>Recibos:</span>
              <span>{payload[0].payload.qtdAtual} confirmados</span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  if (isLoading && chartData.length === 0) {
    return (
      <Card className="mt-6">
        <CardContent className="pt-6">
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-slate-50/50">
      <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100 mb-4 bg-white/50 backdrop-blur-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold text-slate-800">Recebimentos Confirmados</CardTitle>
            {totals.deltaPct !== null && (
              <Badge variant={totals.deltaPct >= 0 ? "outline" : "outline"} className={`h-5 px-1.5 text-[10px] font-bold ${totals.deltaPct >= 0 ? 'text-emerald-600 border-emerald-100 bg-emerald-50' : 'text-rose-600 border-rose-100 bg-rose-50'}`}>
                {totals.deltaPct >= 0 ? "+" : ""}{totals.deltaPct.toFixed(1)}%
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2 px-2 sm:px-6">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorReceb" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={(val) => `R$${val >= 1000 ? (val/1000).toFixed(0)+'k' : val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              
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

              <Area
                name={currentLabel}
                type="monotone"
                dataKey="atual"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorReceb)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
