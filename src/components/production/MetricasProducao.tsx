import { useMetricasProducao } from '@/hooks/useMetricasProducao';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, TrendingUp, Clock, Users, CheckCircle2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)}min`;
  if (horas < 24) return `${horas.toFixed(1)}h`;
  const dias = horas / 24;
  if (dias < 1.5) return '1 dia';
  return `${dias.toFixed(1)} dias`;
}

function tempoColor(horas: number): string {
  const dias = horas / 24;
  if (dias <= 1) return 'text-emerald-600 dark:text-emerald-400';
  if (dias <= 3) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function MetricasProducao() {
  const { data, isLoading, error } = useMetricasProducao();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Calculando métricas...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Não foi possível carregar as métricas.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Métricas dos últimos 30 dias</h2>
        <span className="text-xs text-muted-foreground">
          Atualizado às {data.ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="neu-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs text-muted-foreground font-medium">Finalizados 30d</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{data.totalFinalizados30d}</p>
            <p className="text-xs text-muted-foreground mt-0.5">lotes para Vendas</p>
          </CardContent>
        </Card>

        <Card className="neu-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground font-medium">Transições 30d</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{data.totalTransicoes30d}</p>
            <p className="text-xs text-muted-foreground mt-0.5">movimentações</p>
          </CardContent>
        </Card>

        <Card className="neu-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-violet-500" />
              <span className="text-xs text-muted-foreground font-medium">Responsáveis</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{data.porResponsavel.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ativos no período</p>
          </CardContent>
        </Card>

        <Card className="neu-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground font-medium">Etapas medidas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{data.porEtapa.length}</p>
            <p className="text-xs text-muted-foreground mt-0.5">com tempo médio</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Por responsável */}
        <Card className="neu-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-violet-500" />
              Throughput por Responsável
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.porResponsavel.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Nenhuma movimentação registrada nos últimos 30 dias.
              </p>
            ) : (
              <div className="space-y-3">
                {data.porResponsavel.map((r) => (
                  <div key={r.responsavel} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">
                          {r.responsavel.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{r.responsavel}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {r.transicoes7d} mov. esta semana
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">7d</p>
                        <Badge variant="outline" className={cn(
                          "text-xs font-bold",
                          r.finalizados7d > 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {r.finalizados7d} lotes
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">30d</p>
                        <Badge variant="outline" className={cn(
                          "text-xs font-bold",
                          r.finalizados30d > 0
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {r.finalizados30d} lotes
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tempo médio por etapa */}
        <Card className="neu-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              Tempo Médio por Etapa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {data.porEtapa.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Dados insuficientes para calcular tempos por etapa.
              </p>
            ) : (
              <div className="space-y-2">
                {data.porEtapa.map((e, idx) => {
                  const maxHoras = Math.max(...data.porEtapa.map(x => x.tempoMedioHoras));
                  const pct = maxHoras > 0 ? (e.tempoMedioHoras / maxHoras) * 100 : 0;
                  return (
                    <div key={e.etapa} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          {idx > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground/40" />}
                          <span className="font-medium text-foreground">{e.etapa}</span>
                          <span className="text-muted-foreground">({e.amostras} amostras)</span>
                        </div>
                        <span className={cn("font-bold", tempoColor(e.tempoMedioHoras))}>
                          {formatHoras(e.tempoMedioHoras)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            e.tempoMedioHoras / 24 <= 1
                              ? "bg-emerald-500"
                              : e.tempoMedioHoras / 24 <= 3
                              ? "bg-amber-500"
                              : "bg-red-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground pt-2">
                  Verde ≤ 1 dia · Âmbar ≤ 3 dias · Vermelho &gt; 3 dias
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
