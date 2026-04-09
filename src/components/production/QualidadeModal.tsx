import { useState, useEffect } from 'react';
import { ProducaoData } from '@/entities/Producao';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CheckCircle2, AlertTriangle, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface QualidadeData {
  quantidade_final: number;
  pecas_com_defeito: number;
  quantidade_aprovada: number;
  observacao?: string;
}

interface QualidadeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: ProducaoData | null;
  onConfirm: (data: QualidadeData) => void;
  loading?: boolean;
}

export function QualidadeModal({
  open,
  onOpenChange,
  lot,
  onConfirm,
  loading,
}: QualidadeModalProps) {
  const [quantidadeFinal, setQuantidadeFinal] = useState('');
  const [pecasComDefeito, setPecasComDefeito] = useState('0');
  const [observacao, setObservacao] = useState('');

  // Reset when modal opens
  useEffect(() => {
    if (open && lot) {
      setQuantidadeFinal(String(lot.quantidade || ''));
      setPecasComDefeito('0');
      setObservacao('');
    }
  }, [open, lot]);

  const finalNum = parseInt(quantidadeFinal) || 0;
  const defeitoNum = parseInt(pecasComDefeito) || 0;
  const aprovadas = Math.max(0, finalNum - defeitoNum);

  const isValid = finalNum > 0 && defeitoNum >= 0 && defeitoNum <= finalNum;
  const temDefeitos = defeitoNum > 0;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      quantidade_final: finalNum,
      pecas_com_defeito: defeitoNum,
      quantidade_aprovada: aprovadas,
      observacao: observacao.trim() || undefined,
    });
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  if (!lot) return null;

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Conferência Final — Lote #{lot.id_producao}
          </DialogTitle>
          <DialogDescription>
            {lot.modelo_nome_cache && (
              <span className="font-medium text-foreground">{lot.modelo_nome_cache} · </span>
            )}
            Preencha os dados de qualidade antes de enviar para Vendas/Estoque.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Quantidade final */}
          <div className="space-y-2">
            <Label htmlFor="qtd-final">
              Quantidade final conferida <span className="text-destructive">*</span>
            </Label>
            <Input
              id="qtd-final"
              type="number"
              min={1}
              value={quantidadeFinal}
              onChange={(e) => setQuantidadeFinal(e.target.value)}
              placeholder={`Original: ${lot.quantidade} peças`}
              className={cn(!quantidadeFinal && 'border-destructive/50')}
            />
            <p className="text-xs text-muted-foreground">
              Quantidade real após a conferência (pode diferir do original).
            </p>
          </div>

          {/* Peças com defeito */}
          <div className="space-y-2">
            <Label htmlFor="qtd-defeito" className="flex items-center gap-1.5">
              <Wrench className="h-3.5 w-3.5 text-amber-500" />
              Peças com defeito
            </Label>
            <Input
              id="qtd-defeito"
              type="number"
              min={0}
              max={finalNum || undefined}
              value={pecasComDefeito}
              onChange={(e) => setPecasComDefeito(e.target.value)}
              placeholder="0"
            />
            {defeitoNum > finalNum && finalNum > 0 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Defeitos não pode ser maior que a quantidade final.
              </p>
            )}
          </div>

          {/* Quantidade aprovada — calculada */}
          {finalNum > 0 && (
            <div className={cn(
              "rounded-xl p-4 border-2 transition-colors",
              temDefeitos
                ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-700"
                : "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-700"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={cn(
                    "text-sm font-semibold",
                    temDefeitos ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                  )}>
                    Quantidade aprovada
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Calculado automaticamente · base de custo
                  </p>
                </div>
                <span className={cn(
                  "text-3xl font-bold",
                  temDefeitos ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400"
                )}>
                  {aprovadas}
                  <span className="text-sm font-normal ml-1">peças</span>
                </span>
              </div>

              {temDefeitos && (
                <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    As <strong>{defeitoNum} peças</strong> com defeito serão registradas como 
                    "Pendente de Conserto" e poderão ser acompanhadas na seção{' '}
                    <strong>Peças em Conserto</strong>.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Observação */}
          <div className="space-y-2">
            <Label htmlFor="obs-qualidade">
              Observação <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Textarea
              id="obs-qualidade"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: 2 peças com costura aberta, 1 com defeito no zíper..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !isValid}
            className="gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Movendo...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Confirmar e Mover
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
