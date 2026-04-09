import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProducaoData } from '@/entities/Producao';
import { CheckCircle2, Loader2, Wrench, AlertTriangle, Package } from 'lucide-react';

export interface FinalizarConsertoData {
  pecasSalvas: number;
  custoConsertoPorPeca: number;
  observacao?: string;
}

interface FinalizarConsertoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: ProducaoData | null;
  onConfirm: (data: FinalizarConsertoData) => void;
  loading?: boolean;
}

export function FinalizarConsertoModal({
  open,
  onOpenChange,
  lot,
  onConfirm,
  loading,
}: FinalizarConsertoModalProps) {
  const [pecasSalvas, setPecasSalvas] = useState('');
  const [custoConserto, setCustoConserto] = useState('');
  const [observacao, setObservacao] = useState('');

  if (!lot) return null;

  const maxPecas = lot.pecas_com_defeito || 0;
  const qtdAprovadaAtual = lot.quantidade_aprovada ?? lot.quantidade;
  const pecasSalvasNum = parseInt(pecasSalvas) || 0;
  const custoNum = parseFloat(custoConserto) || 0;
  const pecasRefugo = maxPecas - pecasSalvasNum;

  const novaQtdAprovada = qtdAprovadaAtual + pecasSalvasNum;
  const custoTotalConserto = pecasSalvasNum * custoNum;

  const isValid = pecasSalvasNum >= 0 && pecasSalvasNum <= maxPecas;

  const handleConfirm = () => {
    if (!isValid) return;
    onConfirm({
      pecasSalvas: pecasSalvasNum,
      custoConsertoPorPeca: custoNum,
      observacao: observacao.trim() || undefined,
    });
  };

  const handleClose = () => {
    if (!loading) {
      setPecasSalvas('');
      setCustoConserto('');
      setObservacao('');
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="text-emerald-600" size={20} />
            Finalizar Conserto
          </DialogTitle>
          <DialogDescription>
            Lote <strong>#{lot.id_producao}</strong> · {lot.modelo_nome_cache}
          </DialogDescription>
        </DialogHeader>

        {/* Info banner */}
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 flex items-start gap-2">
          <Wrench size={14} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            <strong>{maxPecas} peças</strong> foram enviadas para conserto.
            Informe quantas foram recuperadas e o custo da operação.
          </p>
        </div>

        {/* Fields */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pecas-salvas">
              Peças recuperadas <span className="text-muted-foreground">(de {maxPecas})</span>
            </Label>
            <Input
              id="pecas-salvas"
              type="number"
              min={0}
              max={maxPecas}
              placeholder={`0 a ${maxPecas}`}
              value={pecasSalvas}
              onChange={(e) => setPecasSalvas(e.target.value)}
            />
            {pecasSalvas && !isValid && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle size={12} />
                O valor deve ser entre 0 e {maxPecas}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="custo-conserto">
              Custo por peça consertada <span className="text-muted-foreground">(R$)</span>
            </Label>
            <Input
              id="custo-conserto"
              type="number"
              step="0.01"
              min={0}
              placeholder="Ex: 8.00"
              value={custoConserto}
              onChange={(e) => setCustoConserto(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs-conserto">
              Observação <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input
              id="obs-conserto"
              placeholder="Ex: Costura lateral refeita"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>
        </div>

        {/* Preview */}
        {pecasSalvas !== '' && (
          <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm border">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Resumo do Resultado</p>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-emerald-600">
                <Package size={13} />
                Peças recuperadas
              </span>
              <span className="font-semibold">{pecasSalvasNum}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Refugo (perdas definitivas)</span>
              <span className={pecasRefugo > 0 ? 'text-red-600 font-medium' : ''}>{pecasRefugo}</span>
            </div>
            <div className="border-t pt-2 flex justify-between font-semibold">
              <span>Nova qtd aprovada</span>
              <span className="text-emerald-600">{novaQtdAprovada} peças</span>
            </div>
            {custoNum > 0 && (
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>Custo do conserto</span>
                <span>+R$ {custoTotalConserto.toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !isValid || pecasSalvas === ''}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? (
              <><Loader2 size={14} className="mr-2 animate-spin" />Salvando...</>
            ) : (
              <><CheckCircle2 size={14} className="mr-2" />Confirmar Finalização</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
