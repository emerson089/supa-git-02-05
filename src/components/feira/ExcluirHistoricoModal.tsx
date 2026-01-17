import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2, Package, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

interface ExcluirHistoricoModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ExcluirHistoricoModal({ carga, onClose, onConfirm, isLoading }: ExcluirHistoricoModalProps) {
  if (!carga) return null;

  // Apenas cargas estornadas ou canceladas podem ser excluídas do histórico
  const statusPermitidos = ['estornada', 'cancelada'];
  if (!statusPermitidos.includes(carga.status)) {
    console.warn('[ExcluirHistoricoModal] Tentativa de excluir carga com status:', carga.status);
    return null;
  }

  const totais = calcularTotaisCargaPublic(carga.itens);
  const dataSaida = format(new Date(carga.dataSaida), 'dd/MM/yyyy HH:mm');
  const statusLabel = carga.status === 'estornada' ? 'estornada' : 'cancelada';

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
    }
  };

  return (
    <Dialog open={!!carga} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir do Histórico
          </DialogTitle>
          <DialogDescription>
            Esta carga será removida permanentemente do histórico. Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data da Carga */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Carga de {dataSaida} ({statusLabel})</span>
          </div>

          {/* Resumo da Carga */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h4 className="font-medium text-sm">Resumo da carga:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Enviado:</span>
                <span className="font-medium">{totais.enviado} pç</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Retornado:</span>
                <span className="font-medium">{totais.retornado} pç</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Vendido:</span>
                <span className="font-medium text-emerald-600">{totais.vendido} pç</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valor:</span>
                <span className="font-medium text-emerald-600">{formatCurrency(totais.valor)}</span>
              </div>
            </div>
          </div>

          {/* Aviso */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Atenção:</p>
                <p className="text-muted-foreground">
                  Como esta carga já foi {statusLabel}, o estoque <strong>não será afetado</strong>. 
                  Apenas o registro histórico será removido permanentemente.
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Excluir Permanentemente'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
