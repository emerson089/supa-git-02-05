import { DiaSemanaStats } from '@/hooks/useFeiraHistorico';
import { cn } from '@/lib/utils';
import { Star, CalendarDays } from 'lucide-react';

interface Props {
  analise: DiaSemanaStats[];
  isLoading?: boolean;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export function AnaliseDiaSemanaFeira({ analise, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-border/40 bg-muted/20 h-11 animate-pulse" />
        <div className="p-4 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (analise.length === 0) return null;

  const maxMedia = Math.max(...analise.map(d => d.mediaPorFeira), 1);

  return (
    <div className="rounded-2xl border border-border/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border/40 bg-indigo-50/60 dark:bg-indigo-950/20">
        <CalendarDays className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="text-sm font-black text-foreground uppercase tracking-wide">Desempenho por Dia da Semana</span>
        <span className="ml-auto text-[10px] font-bold text-muted-foreground">
          Média de peças vendidas por feira
        </span>
      </div>

      {/* Barras por dia */}
      <div className="p-4 space-y-2.5">
        {analise.map(dia => {
          const pct = maxMedia > 0 ? (dia.mediaPorFeira / maxMedia) * 100 : 0;
          const taxaColor =
            dia.taxaVendaMedia >= 70 ? 'text-emerald-600' :
            dia.taxaVendaMedia >= 40 ? 'text-amber-600' :
            'text-red-500';
          const barColor =
            dia.isMelhorDia ? 'bg-indigo-500' :
            pct >= 60 ? 'bg-indigo-400/70' :
            'bg-slate-300 dark:bg-slate-700';

          return (
            <div key={dia.diaSemanaIndex} className={cn(
              "rounded-xl p-3 transition-colors",
              dia.isMelhorDia
                ? "bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-200/60 dark:border-indigo-900/50"
                : "bg-muted/20 border border-transparent"
            )}>
              <div className="flex items-center gap-3 mb-1.5">
                {/* Dia + badge melhor */}
                <div className="flex items-center gap-1.5 w-24 shrink-0">
                  <span className={cn(
                    "text-xs font-black",
                    dia.isMelhorDia ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"
                  )}>
                    {dia.diaSemana}
                  </span>
                  {dia.isMelhorDia && (
                    <Star size={11} className="text-yellow-500 fill-yellow-400 shrink-0" />
                  )}
                </div>

                {/* Barra */}
                <div className="flex-1 h-2 rounded-full bg-muted/40 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Média por feira */}
                <span className={cn(
                  "text-sm font-black w-14 text-right shrink-0",
                  dia.isMelhorDia ? "text-indigo-700 dark:text-indigo-300" : "text-foreground"
                )}>
                  {dia.mediaPorFeira} pçs
                </span>
              </div>

              {/* Sub-métricas */}
              <div className="flex items-center gap-3 pl-[6.5rem] flex-wrap">
                <span className="text-[10px] text-muted-foreground">
                  {dia.quantidadeFeiras} feira{dia.quantidadeFeiras !== 1 ? 's' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  Total: <span className="font-bold text-foreground">{dia.totalVendido} pçs</span>
                </span>
                <span className={cn("text-[10px] font-bold", taxaColor)}>
                  {dia.taxaVendaMedia}% vendido
                </span>
                {dia.mediaValorPorFeira > 0 && (
                  <span className="text-[10px] text-emerald-600 font-bold">
                    ~{formatCurrency(dia.mediaValorPorFeira)}/feira
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer informativo */}
      <div className="px-4 pb-3">
        <p className="text-[10px] text-muted-foreground/70 italic">
          A barra representa a média de peças vendidas por feira. ⭐ = melhor desempenho no período selecionado.
        </p>
      </div>
    </div>
  );
}
