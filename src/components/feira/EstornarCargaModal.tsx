import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Trash2, Loader2, Package, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

interface EstornarCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function EstornarCargaModal({ carga, onClose, onConfirm, isLoading }: EstornarCargaModalProps) {
  const [motivo, setMotivo] = useState('');

  if (!carga) return null;

  const totais = calcularTotaisCargaPublic(carga.itens);
  const dataSaida = format(new Date(carga.dataSaida), 'dd/MM/yyyy HH:mm');
  const dataRetorno = carga.dataRetorno 
    ? format(new Date(carga.dataRetorno), 'dd/MM/yyyy HH:mm')
    : null;

  const handleConfirm = async () => {
    if (!motivo.trim()) return;
    await onConfirm(motivo.trim());
    setMotivo('');
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && !isLoading) {
      onClose();
      setMotivo('');
    }
  };

  return (
    <Dialog open={!!carga} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Excluir Carga
          </DialogTitle>
          <DialogDescription>
            A exclusão reverterá a venda e devolverá os produtos ao estoque Central.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data da Carga */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Carga de {dataSaida}</span>
            {dataRetorno && (
              <span className="text-xs">• Retorno: {dataRetorno}</span>
            )}
          </div>

          {/* Resumo da Carga */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <h4 className="font-medium text-sm">O que será excluído:</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
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

          {/* Impacto no Estoque */}
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-sm text-destructive mb-1">
                  Após a exclusão:
                </h4>
                <p className="text-sm text-muted-foreground">
                  <strong>+{totais.vendido} peças</strong> voltarão ao estoque Central
                </p>
              </div>
            </div>
          </div>

          {/* Campo de Motivo (obrigatório) */}
          <div className="space-y-2">
            <Label htmlFor="motivo" className="flex items-center gap-1">
              Motivo da exclusão
              <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Cliente devolveu, erro no lançamento, produto com defeito..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
              rows={3}
              disabled={isLoading}
            />
            {!motivo.trim() && (
              <p className="text-xs text-muted-foreground">
                O motivo é obrigatório para rastreabilidade
              </p>
            )}
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
            onClick={handleConfirm}
            disabled={isLoading || !motivo.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
