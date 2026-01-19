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
import { AlertTriangle, Loader2, Package, ArrowRight, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

interface ExcluirCargaModalProps {
  carga: TransferenciaComItensHistorico | null;
  onClose: () => void;
  onConfirm: (motivo?: string) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function ExcluirCargaModal({ carga, onClose, onConfirm, isLoading }: ExcluirCargaModalProps) {
  const [motivo, setMotivo] = useState('');

  // Não renderizar se não há carga ou se não é em_andamento
  if (!carga) return null;
  
  // Proteção extra: este modal só deve aparecer para cargas em_andamento
  if (carga.status !== 'em_andamento') {
    console.warn('[ExcluirCargaModal] Tentativa de excluir carga com status:', carga.status);
    return null;
  }

  const totais = calcularTotaisCargaPublic(carga.itens);
  const delta = totais.enviado - totais.retornado; // Quantidade que precisa voltar da Banca para Central
  const dataSaida = format(new Date(carga.dataSaida), 'dd/MM/yyyy HH:mm');

  const handleConfirm = () => {
    onConfirm(motivo.trim() || undefined);
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
            <AlertTriangle className="h-5 w-5" />
            Excluir Carga
          </DialogTitle>
          <DialogDescription>
            Esta carga será removida do histórico e o estoque será ajustado para desfazer os movimentos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data da Carga */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>Carga de {dataSaida}</span>
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

          {/* Impacto no Estoque */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 dark:border-amber-900 dark:bg-amber-950/30">
            <h4 className="font-medium text-sm text-amber-800 dark:text-amber-200">
              Impacto no estoque:
            </h4>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4 text-emerald-600" />
                <span>Central: </span>
                <span className="font-medium text-emerald-600">+{delta} peças</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4 text-rose-600" />
                <span>Banca: </span>
                <span className="font-medium text-rose-600">-{delta} peças</span>
              </div>
            </div>
          </div>

          {/* Campo de Motivo */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Ex: Carga de teste, erro no lançamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
              rows={2}
              disabled={isLoading}
            />
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
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              'Confirmar Exclusão'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
