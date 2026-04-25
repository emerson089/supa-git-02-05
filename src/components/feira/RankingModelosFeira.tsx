import { useState } from 'react';
import { ModeloRankingFeira } from '@/hooks/useFeiraHistorico';
import { LotImage } from '@/components/production/LotImage';
import { cn } from '@/lib/utils';
import { Trophy, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  topVendidos: ModeloRankingFeira[];
  topRetorno: ModeloRankingFeira[];
  isLoading?: boolean;
  isMobile?: boolean;
}

const formatCurrency = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0, maximumFractionDigits: 0 });

function ModeloRow({ modelo, rank, showValor }: { modelo: ModeloRankingFeira; rank: number; showValor: boolean }) {
  const maxBar = 100; // taxaVenda is already 0-100
  const barColor =
    modelo.taxaVenda >= 70 ? 'bg-emerald-500' :
    modelo.taxaVenda >= 40 ? 'bg-amber-500' :
    'bg-red-500';
  const taxaColor =
    modelo.taxaVenda >= 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    modelo.taxaVenda >= 40 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-500 bg-red-50 border-red-200';
  const retornoColor =
    modelo.taxaRetorno >= 50 ? 'text-red-500 bg-red-50 border-red-200' :
    modelo.taxaRetorno >= 25 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-slate-500 bg-slate-50 border-slate-200';

  const medalColors = ['text-yellow-500', 'text-slate-400', 'text-amber-600'];
  const rankEl = rank <= 3
    ? <span className={cn("text-base font-black w-5 text-center shrink-0", medalColors[rank - 1])}>
        {['🥇','🥈','🥉'][rank - 1]}
      </span>
    : <span className="text-[11px] font-black text-muted-foreground/50 w-5 text-center shrink-0">
        {rank}
      </span>;

  return (
    <div className="flex items-center gap-2.5 py-2.5 border-b border-border/40 last:border-0">
      {rankEl}

      {/* Imagem */}
      <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted shrink-0 border border-border/30">
        <LotImage src={modelo.imagemUrl} alt={modelo.nome} className="w-full h-full object-cover" />
      </div>

      {/* Info principal */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-foreground truncate leading-none mb-0.5">{modelo.nome}</p>

        {/* Barra de venda */}
        <div className="flex items-center gap-1.5 mb-1">
          <div className="flex-1 h-1 rounded-full bg-muted/50 overflow-hidden">
            <div className={cn("h-full rounded-full", barColor)} style={{ width: `${modelo.taxaVenda}%` }} />
          </div>
        </div>

        {/* Métricas compactas */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-muted-foreground">
            {modelo.enviado} env → <span className="font-bold text-foreground">{modelo.vendido} vend</span>
          </span>
          {modelo.retornado > 0 && (
            <span className="text-[10px] text-muted-foreground">· {modelo.retornado} ret</span>
          )}
        </div>
      </div>

      {/* Badges direita */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border", taxaColor)}>
          {modelo.taxaVenda}%
        </span>
        {showValor && modelo.valor > 0 && (
          <span className="text-[10px] font-bold text-emerald-600">
            {formatCurrency(modelo.valor)}
          </span>
        )}
        {!showValor && modelo.retornado > 0 && (
          <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border", retornoColor)}>
            {modelo.taxaRetorno}% ret
          </span>
        )}
      </div>
    </div>
  );
}

function RankingPanel({
  title,
  icon: Icon,
  iconColor,
  headerBg,
  items,
  showValor,
  emptyText,
}: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  headerBg: string;
  items: ModeloRankingFeira[];
  showValor: boolean;
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 5);

  return (
    <div className="rounded-2xl border border-border/60 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
      {/* Header */}
      <div className={cn("px-4 py-3 flex items-center gap-2 border-b border-border/40", headerBg)}>
        <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
        <span className="text-sm font-black text-foreground uppercase tracking-wide">{title}</span>
        {items.length > 0 && (
          <span className="ml-auto text-[10px] font-bold text-muted-foreground">{items.length} modelos</span>
        )}
      </div>

      {/* Lista */}
      <div className="px-4">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">{emptyText}</p>
        ) : (
          <>
            {visible.map((m, i) => (
              <ModeloRow key={m.id} modelo={m} rank={i + 1} showValor={showValor} />
            ))}
            {items.length > 5 && (
              <button
                onClick={() => setExpanded(v => !v)}
                className="w-full flex items-center justify-center gap-1 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {expanded ? <><ChevronUp size={13} /> Mostrar menos</> : <><ChevronDown size={13} /> Ver mais {items.length - 5} modelos</>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function RankingModelosFeira({ topVendidos, topRetorno, isLoading, isMobile }: Props) {
  if (isLoading) {
    return (
      <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
        {[0, 1].map(i => (
          <div key={i} className="rounded-2xl border border-border/40 bg-white dark:bg-slate-900 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-border/40 bg-muted/30 h-10 animate-pulse" />
            <div className="px-4 py-3 space-y-3">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="h-10 bg-muted/30 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (topVendidos.length === 0 && topRetorno.length === 0) return null;

  return (
    <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
      <RankingPanel
        title="Top Modelos Vendidos"
        icon={Trophy}
        iconColor="text-yellow-500"
        headerBg="bg-yellow-50/60 dark:bg-yellow-950/20"
        items={topVendidos}
        showValor={true}
        emptyText="Nenhuma venda registrada no período."
      />
      <RankingPanel
        title="Maior Devolução"
        icon={RotateCcw}
        iconColor="text-red-500"
        headerBg="bg-red-50/60 dark:bg-red-950/20"
        items={topRetorno}
        showValor={false}
        emptyText="Nenhum retorno registrado no período."
      />
    </div>
  );
}
