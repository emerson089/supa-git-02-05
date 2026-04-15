import { useState, useMemo } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, RotateCcw, FileText, Loader2, Pencil, Filter, X, PackageCheck } from 'lucide-react';
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
  periodoEhHoje,
  isGeneratingPDF
}: CargasAtivasAlertaProps) {
  const [filtroLocal, setFiltroLocal] = useState<string | null>(null);

  // Extract unique local names from cargas (using only observacoes/titulo)
  const locaisUnicos = useMemo(() => {
    const nomes = new Set<string>();
    cargasAtivas.forEach(c => {
      // Ignorar localDestinoNome pois para Feira será sempre o mesmo (ex: Banca da Feira)
      // Usar a observação (título da carga) que é o verdadeiro identificador
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
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="flex items-center gap-2 text-amber-600 flex-wrap">
        <span>Cargas em Andamento</span>
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
          {cargasAtivas.length}
        </Badge>
        {/* Value at risk */}
        <span className="text-xs font-normal text-amber-700/80 ml-1">
          • {formatCurrency(totalEmAberto)} em aberto
        </span>

        {/* Bulk return button — only when ≥ 2 cargas */}
        {cargasAtivas.length >= 2 && onRegistrarRetornoEmMassa && (
          <Button
            size="sm"
            variant="outline"
            className="ml-auto border-amber-500/50 text-amber-700 hover:bg-amber-100 hover:text-amber-800 gap-1.5 text-xs"
            onClick={onRegistrarRetornoEmMassa}
          >
            <PackageCheck size={13} />
            Retorno em Massa
          </Button>
        )}
      </AlertTitle>

      <AlertDescription className="mt-3">
        <p className="text-sm text-muted-foreground mb-3">
          {cargasAtivas.length === 1
            ? 'Há 1 carga aguardando registro de retorno.'
            : `Há ${cargasAtivas.length} cargas aguardando registro de retorno.`}
        </p>

        {/* Filter by local/banca — only when there are multiple locais */}
        {locaisUnicos.length > 1 && (
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Filter size={12} className="text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Filtrar:</span>
            <button
              onClick={() => setFiltroLocal(null)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-full border transition-colors",
                filtroLocal === null
                  ? "bg-amber-500 text-white border-amber-500"
                  : "bg-background border-border hover:border-amber-400 text-muted-foreground"
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
                    "text-xs px-2.5 py-1 rounded-full border transition-colors truncate max-w-[140px]",
                    filtroLocal === local
                      ? "bg-amber-500 text-white border-amber-500"
                      : "bg-background border-border hover:border-amber-400 text-muted-foreground"
                  )}
                >
                  {local} ({count})
                </button>
              );
            })}
            {filtroLocal && (
              <button
                onClick={() => setFiltroLocal(null)}
                className="text-xs text-amber-600 flex items-center gap-0.5 hover:underline"
              >
                <X size={11} /> limpar
              </button>
            )}
          </div>
        )}

        {/* Cargas list */}
        <div className="space-y-2">
          {cargasFiltradas.map((carga) => {
            const totalPecas = carga.itens.reduce((s, i) => s + i.quantidadeEnviada, 0);
            const valorTotal = carga.itens.reduce((s, i) => s + (i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0)), 0);
            
            // Calcular quantidade de modelos únicos
            const modelosCount = groupItensByModel(carga.itens, {
              getItemId: (i) => i.itemId,
              getItemNome: (i) => i.produtoNome || '',
              getItemPreco: (i) => i.precoUnitario || 0,
              getItemQtd: (i) => i.quantidadeEnviada,
              getItemImagem: (i) => i.produtoImagem,
              getItemReferencia: (i) => i.itemId, // Usar itemId como fallback de ref se necessário
            }).length;

            return (
              <div
                key={carga.id}
                className="flex items-center justify-between p-3 rounded-lg bg-background border gap-2"
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-primary shrink-0" />
                    {carga.observacoes ? (
                      <span className="text-sm font-semibold text-primary truncate max-w-[120px] sm:max-w-none">
                        "{carga.observacoes}"
                      </span>
                    ) : null}
                    <span className="text-sm font-medium">
                      {format(new Date(carga.dataSaida), "HH:mm")}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {modelosCount} mod • {totalPecas} pç
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(valorTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  {onEditarCarga && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onEditarCarga(carga)}
                      className="gap-1 shrink-0"
                      title="Editar carga"
                    >
                      <span className="sr-only">Editar</span>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  )}
                  {onGerarPDF && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onGerarPDF(carga)}
                      disabled={isGeneratingPDF}
                      className="gap-1 shrink-0"
                      title="Gerar PDF"
                    >
                      {isGeneratingPDF ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <FileText size={14} />
                      )}
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => onRegistrarRetorno(carga)}
                    className="gap-1 shrink-0"
                  >
                    <RotateCcw size={14} />
                    <span className="hidden sm:inline">Retorno</span>
                  </Button>
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
      </AlertDescription>
    </Alert>
  );
}