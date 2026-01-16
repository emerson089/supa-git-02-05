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
import { Undo2, Loader2, Package, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Undo2 className="h-5 w-5" />
            Estornar Carga
          </DialogTitle>
          <DialogDescription>
            O estorno irá reverter a venda, devolvendo os produtos vendidos ao estoque Central.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Alerta informativo */}
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              Esta carga está <strong>concluída</strong> e não pode ser excluída. 
              O estorno reverte a operação mantendo o histórico.
            </AlertDescription>
          </Alert>

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
            <h4 className="font-medium text-sm">O que será estornado:</h4>
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
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
            <h4 className="font-medium text-sm text-emerald-800 dark:text-emerald-200 mb-2">
              Após o estorno:
            </h4>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              <strong>+{totais.vendido} peças</strong> voltarão ao estoque Central
            </p>
          </div>

          {/* Campo de Motivo (obrigatório) */}
          <div className="space-y-2">
            <Label htmlFor="motivo" className="flex items-center gap-1">
              Motivo do estorno
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
            variant="default"
            className="bg-amber-600 hover:bg-amber-700"
            onClick={handleConfirm}
            disabled={isLoading || !motivo.trim()}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Estornando...
              </>
            ) : (
              <>
                <Undo2 className="mr-2 h-4 w-4" />
                Confirmar Estorno
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
