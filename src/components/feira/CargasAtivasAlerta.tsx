import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, FileText, Loader2, Pencil, PackageCheck, Truck, X } from 'lucide-react';
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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export function CargasAtivasAlerta({
  cargasAtivas,
  onRegistrarRetorno,
  onRegistrarRetornoEmMassa,
  onEditarCarga,
  onGerarPDF,
  isGeneratingPDF,
}: CargasAtivasAlertaProps) {
  const [filtroLocal, setFiltroLocal] = useState<string | null>(null);

  const locaisUnicos = useMemo(() => {
    const nomes = new Set<string>();
    cargasAtivas.forEach(c => { if (c.observacoes) nomes.add(c.observacoes); });
    return Array.from(nomes).filter(Boolean);
  }, [cargasAtivas]);

  const cargasFiltradas = useMemo(() => {
    if (!filtroLocal) return cargasAtivas;
    return cargasAtivas.filter(c => c.observacoes === filtroLocal);
  }, [cargasAtivas, filtroLocal]);

  const totalEmAberto = cargasAtivas.reduce(
    (sum, c) => sum + c.itens.reduce((s, i) => s + i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0), 0),
    0
  );

  if (cargasAtivas.length === 0) return null;

  return (
    <div className="w-full rounded-2xl border-l-4 border-l-amber-500 border border-amber-100 bg-amber-50/40 dark:bg-amber-950/10">
      {/* Cabeçalho */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/40 shrink-0">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="font-bold text-base text-foreground leading-tight">Cargas em Andamento</p>
              <p className="text-xs text-muted-foreground mt-0.5">Registre o retorno das mercadorias</p>
            </div>
          </div>
          {cargasAtivas.length >= 2 && onRegistrarRetornoEmMassa && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRegistrarRetornoEmMassa}
              className="h-8 px-3 text-xs font-bold border-amber-200 bg-white text-amber-700 hover:bg-amber-50 shrink-0"
            >
              <PackageCheck size={12} className="mr-1" />
              Em Massa
            </Button>
          )}
        </div>

        {/* Badges de resumo */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-background border border-amber-200 text-amber-700 px-2.5 py-1 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            {cargasAtivas.length} em trânsito
          </span>
          <span className="inline-flex items-center text-xs font-semibold bg-white dark:bg-background border border-slate-200 text-slate-600 px-2.5 py-1 rounded-lg">
            {formatCurrency(totalEmAberto)}
          </span>
        </div>
      </div>

      {/* Filtros por local — scroll horizontal */}
      {locaisUnicos.length > 1 && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFiltroLocal(null)}
              className={cn(
                "flex-none text-xs px-3 py-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors",
                !filtroLocal
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white dark:bg-background border-slate-200 text-slate-600"
              )}
            >
              Todas ({cargasAtivas.length})
            </button>
            {locaisUnicos.map(local => (
              <button
                key={local}
                onClick={() => setFiltroLocal(filtroLocal === local ? null : local)}
                className={cn(
                  "flex-none text-xs px-3 py-1.5 rounded-lg border font-semibold whitespace-nowrap transition-colors",
                  filtroLocal === local
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white dark:bg-background border-slate-200 text-slate-600"
                )}
              >
                {local} ({cargasAtivas.filter(c => c.observacoes === local).length})
              </button>
            ))}
            {filtroLocal && (
              <button
                onClick={() => setFiltroLocal(null)}
                className="flex-none flex items-center gap-1 text-xs text-indigo-600 font-bold px-2 whitespace-nowrap"
              >
                <X size={11} /> limpar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Lista de cargas */}
      <div className="px-4 pb-4 space-y-3">
        {cargasFiltradas.map((carga) => {
          const totalPecas = carga.itens.reduce((s, i) => s + i.quantidadeEnviada, 0);
          const valorTotal = carga.itens.reduce(
            (s, i) => s + i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0),
            0
          );
          const modelosCount = groupItensByModel(carga.itens, {
            getItemId: i => i.itemId,
            getItemNome: i => i.produtoNome || '',
            getItemPreco: i => i.precoUnitario || 0,
            getItemQtd: i => i.quantidadeEnviada,
            getItemImagem: i => i.produtoImagem,
            getItemReferencia: i => i.produtoNome || '',
            getItemModeloId: i => i.modeloId,
          }).length;

          return (
            <div
              key={carga.id}
              className="rounded-xl bg-white dark:bg-card border border-slate-200 dark:border-border shadow-sm overflow-hidden"
            >
              {/* Topo: status + hora + título */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 dark:bg-indigo-950/30 px-2 py-0.5 rounded-md">
                    <Truck size={9} />
                    Em Trânsito
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(carga.dataSaida), 'HH:mm')}
                  </span>
                </div>
                <p className="font-bold text-[15px] text-foreground leading-snug">
                  {carga.observacoes || 'Carga Sem Título'}
                </p>
              </div>

              {/* Estatísticas */}
              <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-slate-50 dark:bg-muted border border-slate-100 dark:border-border text-slate-700 dark:text-foreground px-2.5 py-1 rounded-lg">
                  <PackageCheck size={12} className="text-indigo-500" />
                  {modelosCount} modelos
                </span>
                <span className="inline-flex items-center text-xs font-semibold bg-slate-50 dark:bg-muted border border-slate-100 dark:border-border text-slate-700 dark:text-foreground px-2.5 py-1 rounded-lg">
                  {totalPecas} peças
                </span>
              </div>

              {/* Rodapé: valor + ações */}
              <div className="px-4 py-3 bg-slate-50/60 dark:bg-muted/30 border-t border-slate-100 dark:border-border">
                {/* Valor */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                    Total em carga
                  </span>
                  <span className="text-base font-black text-amber-600">
                    {formatCurrency(valorTotal)}
                  </span>
                </div>

                {/* Botões — linha única, largura total */}
                <div className="flex items-center gap-2">
                  {onEditarCarga && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onEditarCarga(carga)}
                      className="h-10 w-10 rounded-xl shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
                    >
                      <Pencil size={15} />
                    </Button>
                  )}
                  {onGerarPDF && (
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => onGerarPDF(carga)}
                      disabled={isGeneratingPDF}
                      className="h-10 w-10 rounded-xl shrink-0 border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200"
                    >
                      {isGeneratingPDF ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />}
                    </Button>
                  )}
                  <Button
                    onClick={() => onRegistrarRetorno(carga)}
                    className="h-10 flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 min-w-0"
                  >
                    <RotateCcw size={15} />
                    Registrar Retorno
                  </Button>
                </div>
              </div>
            </div>
          );
        })}

        {cargasFiltradas.length === 0 && filtroLocal && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma carga para "{filtroLocal}"
          </p>
        )}
      </div>
    </div>
  );
}
