import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RotateCcw, FileText, Loader2, Pencil, Truck, X } from 'lucide-react';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { groupItensByModel } from '@/utils/productNameUtils';

interface CargasAtivasAlertaProps {
  cargasAtivas: TransferenciaComItensHistorico[];
  onRegistrarRetorno: (carga: TransferenciaComItensHistorico) => void;
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
    <div className="w-full space-y-4">
      {/* Header Compacto */}
      <div className="px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/40">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
          </div>
          <h2 className="font-bold text-base">Cargas em Andamento</h2>
        </div>
      </div>

      {/* Badges de Resumo - Barra Minimalista */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <Badge variant="outline" className="bg-white/50 dark:bg-card/50 border-amber-200 text-amber-700 px-2.5 py-1 rounded-full whitespace-nowrap">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2 animate-pulse" />
          {cargasAtivas.length} em trânsito
        </Badge>
        <Badge variant="outline" className="bg-white/50 dark:bg-card/50 border-slate-200 text-slate-600 px-2.5 py-1 rounded-full whitespace-nowrap">
          {formatCurrency(totalEmAberto)}
        </Badge>
        {locaisUnicos.map(local => (
          <button
            key={local}
            onClick={() => setFiltroLocal(filtroLocal === local ? null : local)}
            className={cn(
              "flex-none text-[11px] px-3 py-1 rounded-full border font-semibold whitespace-nowrap transition-all",
              filtroLocal === local
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/50 dark:bg-card/50 border-slate-200 text-slate-600 hover:border-primary/50"
            )}
          >
            {local}
          </button>
        ))}
      </div>

      {/* Lista de Cargas - Design em Cards Premium */}
      <div className="space-y-3">
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
            <Card
              key={carga.id}
              className="group overflow-hidden border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-none dark:bg-card/60"
            >
              <div className="relative p-4">
                {/* Indicador lateral de status */}
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/40 rounded-full" />
                
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase tracking-wider">
                      {format(new Date(carga.dataSaida), 'HH:mm')}
                    </span>
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">
                      {carga.observacoes || 'Carga Sem Título'}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    {onEditarCarga && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onEditarCarga(carga)}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5"
                      >
                        <Pencil size={14} />
                      </Button>
                    )}
                    {onGerarPDF && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => onGerarPDF(carga)}
                        disabled={isGeneratingPDF}
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/5"
                      >
                        {isGeneratingPDF ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-4">
                  {/* Grid de Estatísticas Moderno e Compacto */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                      <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-tighter">Modelos</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none mt-1">{modelosCount}</span>
                    </div>
                    
                    <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center">
                      <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-tighter">Peças</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 leading-none mt-1">{totalPecas}</span>
                    </div>

                    <div className="flex-[1.2] bg-amber-50/50 dark:bg-amber-900/10 rounded-xl p-2 border border-amber-100/50 dark:border-amber-900/30 flex flex-col items-center justify-center">
                      <span className="text-[8px] text-amber-700 dark:text-amber-500 font-bold uppercase tracking-tighter">Total</span>
                      <span className="text-sm font-black text-amber-600 leading-none mt-1 truncate w-full text-center">
                        {formatCurrency(valorTotal).replace('R$', '').trim()}
                      </span>
                    </div>
                  </div>

                  {/* Botão de Ação Otimizado */}
                  <Button
                    onClick={() => onRegistrarRetorno(carga)}
                    className="h-12 w-full rounded-2xl bg-primary text-primary-foreground font-bold text-sm shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 border-none group"
                  >
                    <div className="bg-white/20 p-1.5 rounded-lg group-active:rotate-180 transition-transform duration-300">
                      <RotateCcw size={16} strokeWidth={2.5} />
                    </div>
                    <span className="tracking-tight">Registrar Retorno</span>
                  </Button>
                </div>
              </div>
            </Card>
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
