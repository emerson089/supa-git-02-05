import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { LotImage } from '@/components/production/LotImage';
import { useSetPrecoPorLocal, useRemovePrecoPorLocal } from '@/hooks/usePrecoPorLocal';
import { Loader2, Tag, DollarSign } from 'lucide-react';

interface EditarPrecoLocalModalProps {
  open: boolean;
  onClose: () => void;
  item: {
    itemId: string;
    itemNome: string;
    itemImagemUrl: string | null;
    itemPrecoUnitario: number | null; // Preço base
  };
  localId: string;
  localNome: string;
  precoLocal: number | null; // Preço atual do local (se existir)
}

export function EditarPrecoLocalModal({
  open,
  onClose,
  item,
  localId,
  localNome,
  precoLocal,
}: EditarPrecoLocalModalProps) {
  const [novoPreco, setNovoPreco] = useState('');
  const [usarPrecoBase, setUsarPrecoBase] = useState(false);

  const setPreco = useSetPrecoPorLocal();
  const removePreco = useRemovePrecoPorLocal();

  const precoBase = item.itemPrecoUnitario || 0;
  const temPrecoLocal = precoLocal !== null;

  useEffect(() => {
    if (open) {
      // Inicializar com preço local se existir, senão preço base
      const precoInicial = precoLocal ?? precoBase;
      setNovoPreco(precoInicial > 0 ? precoInicial.toFixed(2) : '');
      setUsarPrecoBase(false);
    }
  }, [open, precoLocal, precoBase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (usarPrecoBase) {
      // Remover preço local (volta ao preço base)
      await removePreco.mutateAsync({
        itemId: item.itemId,
        localId,
      });
    } else {
      const precoNumerico = parseFloat(novoPreco.replace(',', '.'));
      if (isNaN(precoNumerico) || precoNumerico <= 0) {
        return;
      }
      await setPreco.mutateAsync({
        itemId: item.itemId,
        localId,
        precoVenda: precoNumerico,
      });
    }

    onClose();
  };

  const isSubmitting = setPreco.isPending || removePreco.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Editar Preço - {localNome}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Info do produto */}
          <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border shrink-0">
              <LotImage
                src={item.itemImagemUrl}
                alt={item.itemNome}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.itemNome}</p>
              <p className="text-sm text-muted-foreground">
                Preço base: {precoBase > 0 ? `R$ ${precoBase.toFixed(2)}` : 'Não definido'}
              </p>
            </div>
          </div>

          {/* Status atual */}
          {temPrecoLocal && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
              <DollarSign className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-700">
                Este local possui preço diferenciado: R$ {precoLocal?.toFixed(2)}
              </span>
            </div>
          )}

          {/* Campo de preço */}
          <div className="space-y-2">
            <Label htmlFor="preco">Preço neste local</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                R$
              </span>
              <Input
                id="preco"
                type="text"
                inputMode="decimal"
                value={novoPreco}
                onChange={(e) => setNovoPreco(e.target.value)}
                disabled={usarPrecoBase}
                className="pl-10"
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Checkbox para usar preço base */}
          {temPrecoLocal && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="usarPrecoBase"
                checked={usarPrecoBase}
                onCheckedChange={(checked) => setUsarPrecoBase(!!checked)}
              />
              <Label htmlFor="usarPrecoBase" className="text-sm cursor-pointer">
                Usar preço base (remover preço diferenciado)
              </Label>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
