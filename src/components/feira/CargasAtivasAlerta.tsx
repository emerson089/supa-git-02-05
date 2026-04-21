import { useState, useMemo } from 'react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, FileText, Loader2, Pencil, X, PackageCheck, Truck } from 'lucide-react';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { groupItensByModel } from '@/utils/productNameUtils';

interface CargasAtivasAlertaProps {
  cargasAtivas: TransferenciaComItensHistorico[];
  onRegistrarRetorno: (carga: TransferenciaComItensHistorico) => void;
  onRegistrarRetornoEmMassa?: () => void;
  onEditarCarga?: (carga: TransferenciaComItensHistorico) => void;
  onGerarPDF?: (carga: TransferenciaComItensHistorico) => void;
  periodoEhHoje: boolean;
  isGeneratingPDF?: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export function CargasAtivasAlerta({
  cargasAtivas,
  onRegistrarRetorno,
  onRegistrarRetornoEmMassa,
  onEditarCarga,
  onGerarPDF,
  isGeneratingPDF
}: CargasAtivasAlertaProps) {
  const [filtroLocal, setFiltroLocal] = useState<string | null>(null);

  // Extract unique local names from cargas (using only observacoes/titulo)
  const locaisUnicos = useMemo(() => {
    const nomes = new Set<string>();
    cargasAtivas.forEach(c => {
      if (c.observacoes) nomes.add(c.observacoes);
    });
    return Array.from(nomes).filter(Boolean);
  }, [cargasAtivas]);

  // Filter cargas by local (titulo)
  const cargasFiltradas = useMemo(() => {
    if (!filtroLocal) return cargasAtivas;
    return cargasAtivas.filter(c => c.observacoes === filtroLocal);
  }, [cargasAtivas, filtroLocal]);

  // Total value in transit
  const totalEmAberto = cargasAtivas.reduce((sum, c) =>
    sum + c.itens.reduce((s, i) => s + i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0), 0), 0);

  if (cargasAtivas.length === 0) return null;

  return (
    <Alert className="w-full max-w-full border-slate-200 bg-slate-50 shadow-sm border-l-4 border-l-amber-500 rounded-2xl overflow-hidden p-0">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-4 gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <AlertTitle className="text-slate-800 font-bold text-lg mb-1 leading-none">
                Cargas em Andamento
              </AlertTitle>
              <p className="text-xs text-slate-500 font-medium">
                Gerencie o retorno de mercadorias enviadas hoje.
              </p>
            </div>
          </div>

          {/* Bulk return button — only when ≥ 2 cargas */}
          {cargasAtivas.length >= 2 && onRegistrarRetornoEmMassa && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 gap-1.5 text-[10px] font-bold shadow-sm transition-all active:scale-95 px-2.5 h-8 shrink-0"
              onClick={onRegistrarRetornoEmMassa}
            >
              <PackageCheck size={12} />
              Em Massa
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5 px-1">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {cargasAtivas.length} Agendadas
          </span>
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-lg whitespace-nowrap">
            {formatCurrency(totalEmAberto)} em trânsito
          </span>
        </div>

        {/* Filter by local/banca — only when there are multiple locais */}
        {locaisUnicos.length > 1 && (
          <div className="relative mb-6">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 -mb-2 px-1 w-full">
              <button
                onClick={() => setFiltroLocal(null)}
                className={cn(
                  "text-[11px] px-4 py-2 rounded-xl border transition-all whitespace-nowrap shadow-sm active:scale-95",
                  filtroLocal === null
                    ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-indigo-100"
                    : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 font-medium"
                )}
              >
                Todas ({cargasAtivas.length})
              </button>
              {locaisUnicos.map(local => {
                const count = cargasAtivas.filter(c => c.observacoes === local).length;
                return (
                  <button
                    key={local}
                    onClick={() => setFiltroLocal(filtroLocal === local ? null : local)}
                    className={cn(
                      "text-[11px] px-4 py-2 rounded-xl border transition-all whitespace-nowrap shadow-sm active:scale-95",
                      filtroLocal === local
                        ? "bg-indigo-600 text-white border-indigo-600 font-bold shadow-indigo-100"
                        : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 font-medium"
                    )}
                  >
                    {local} ({count})
                  </button>
                );
              })}
              {filtroLocal && (
                <button
                  onClick={() => setFiltroLocal(null)}
                  className="text-[11px] text-indigo-600 font-bold flex items-center gap-1 hover:underline whitespace-nowrap px-2"
                >
                  <X size={12} /> limpar
                </button>
              )}
            </div>
            {/* Scroll Indicator Gradient */}
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Cargas list */}
        <div className="space-y-4">
          {cargasFiltradas.map((carga) => {
            const totalPecas = carga.itens.reduce((s, i) => s + i.quantidadeEnviada, 0);
            const valorTotal = carga.itens.reduce((s, i) => s + (i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0)), 0);
            
            const modelosCount = groupItensByModel(carga.itens, {
              getItemId: (i) => i.itemId,
              getItemNome: (i) => i.produtoNome || '',
              getItemPreco: (i) => i.precoUnitario || 0,
              getItemQtd: (i) => i.quantidadeEnviada,
              getItemImagem: (i) => i.produtoImagem,
              getItemReferencia: (i) => i.produtoNome || '',
              getItemModeloId: (i) => i.modeloId
            }).length;

            return (
              <div
                key={carga.id}
                className="group relative flex flex-col p-0 overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all active:scale-[0.99] touch-manipulation"
              >
                {/* Header: Title & Time */}
                <div className="flex flex-wrap items-start justify-between p-4 pb-3 gap-2">
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-600 font-bold text-[9px] uppercase tracking-wider">
                        <Truck size={10} />
                        Em Trânsito
                      </div>
                      <span className="text-slate-400 text-[11px] font-medium">
                        {format(new Date(carga.dataSaida), "HH:mm")}
                      </span>
                    </div>
                    <h3 className="text-[15px] font-bold text-slate-800 leading-tight line-clamp-2">
                      {carga.observacoes || "Carga Sem Título"}
                    </h3>
                  </div>
                </div>

                {/* Body: Stats Summary */}
                <div className="flex flex-wrap items-center gap-2 px-4 pb-4">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                    <PackageCheck size={14} className="text-indigo-500" />
                    <span className="text-xs font-semibold">{modelosCount} modelos</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
                    <span className="text-xs font-semibold">{totalPecas} peças</span>
                  </div>
                </div>

                {/* Footer: Price & Actions (2 Rows for Mobile usability) */}
                <div className="flex flex-col px-4 py-3 bg-slate-50/80 border-t border-slate-100 mt-auto text-card-foreground">
                  <div className="flex flex-wrap items-center justify-between w-full mb-3 gap-2">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total em carga</p>
                    <p className="text-lg font-black text-amber-600 leading-none">
                      {formatCurrency(valorTotal)}
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 w-full pt-1">
                    <div className="flex items-center gap-2">
                      {onEditarCarga && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onEditarCarga(carga)}
                          className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm active:scale-95"
                        >
                          <Pencil size={16} />
                        </Button>
                      )}
                      {onGerarPDF && (
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => onGerarPDF(carga)}
                          disabled={isGeneratingPDF}
                          className="h-10 w-10 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition-colors shadow-sm active:scale-95"
                        >
                          {isGeneratingPDF ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <FileText size={16} />
                          )}
                        </Button>
                      )}
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => onRegistrarRetorno(carga)}
                      className="h-10 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg shadow-indigo-200/50 px-5 gap-2 transition-all active:scale-95 flex-1"
                    >
                      <RotateCcw size={15} />
                      Retorno
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {cargasFiltradas.length === 0 && filtroLocal && (
            <p className="text-sm text-muted-foreground text-center py-3">
              Nenhuma carga para "{filtroLocal}"
            </p>
          )}
        </div>
      </div>
    </Alert>
  );
}