import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, RotateCcw, FileText, Loader2 } from 'lucide-react';
import { TransferenciaComItensHistorico } from '@/hooks/useFeiraHistorico';
import { format } from 'date-fns';

interface CargasAtivasAlertaProps {
  cargasAtivas: TransferenciaComItensHistorico[];
  onRegistrarRetorno: (carga: TransferenciaComItensHistorico) => void;
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
  onGerarPDF,
  periodoEhHoje,
  isGeneratingPDF 
}: CargasAtivasAlertaProps) {
  // Não mostrar se não houver cargas ativas
  if (cargasAtivas.length === 0) {
    return null;
  }

  return (
    <Alert className="border-amber-500/50 bg-amber-500/10">
      <AlertTriangle className="h-4 w-4 text-amber-600" />
      <AlertTitle className="flex items-center gap-2 text-amber-600">
        Cargas em Andamento
        <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
          {cargasAtivas.length}
        </Badge>
      </AlertTitle>
      <AlertDescription className="mt-3">
        <p className="text-sm text-muted-foreground mb-3">
          {cargasAtivas.length === 1
            ? 'Há 1 carga aguardando registro de retorno.'
            : `Há ${cargasAtivas.length} cargas aguardando registro de retorno.`}
        </p>
        
        {/* Lista compacta das cargas */}
        <div className="space-y-2">
          {cargasAtivas.map((carga) => {
            const totalPecas = carga.itens.reduce((s, i) => s + i.quantidadeEnviada, 0);
            const valorTotal = carga.itens.reduce((s, i) => s + (i.quantidadeEnviada * (i.precoUnitario || i.produtoPreco || 0)), 0);
            
            return (
              <div 
                key={carga.id} 
                className="flex items-center justify-between p-3 rounded-lg bg-background border gap-2"
              >
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-primary shrink-0" />
                    <span className="text-sm font-medium">
                      {format(new Date(carga.dataSaida), "HH:mm")}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {totalPecas} peças
                  </span>
                  <span className="text-sm font-semibold">
                    {formatCurrency(valorTotal)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {onGerarPDF && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onGerarPDF(carga)}
                      disabled={isGeneratingPDF}
                      className="gap-1 shrink-0"
                      title="Gerar PDF para compartilhar"
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
        </div>
      </AlertDescription>
    </Alert>
  );
}
