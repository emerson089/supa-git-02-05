import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LotImage } from '@/components/production/LotImage';
import { useZerarProdutoLocal, EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ZerarEstoqueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EstoqueLocalDetalhado | null;
}

export function ZerarEstoqueModal({ open, onOpenChange, item }: ZerarEstoqueModalProps) {
  const [motivo, setMotivo] = useState('');
  const zerarEstoque = useZerarProdutoLocal();

  useEffect(() => {
    if (open) {
      setMotivo('');
    }
  }, [open]);

  if (!item) return null;

  const isValid = motivo.trim().length >= 3;

  const handleZerar = async () => {
    if (!isValid || !item) return;

    try {
      await zerarEstoque.mutateAsync({
        estoqueLocalId: item.id,
        itemId: item.itemId,
        localId: item.localId,
        motivo: motivo.trim(),
      });
      onOpenChange(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Zerar Estoque
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted border shrink-0">
                  <LotImage
                    src={item.itemImagemUrl}
                    alt={item.itemNome}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="font-medium text-foreground">{item.itemNome}</p>
                  <p className="text-sm">
                    Estoque atual: <strong className="text-destructive">{item.quantidade} peças</strong>
                  </p>
                </div>
              </div>

              <p className="text-sm">
                Esta ação irá zerar completamente o estoque deste produto neste local.
                Uma movimentação de saída será registrada.
              </p>

              <div className="space-y-2">
                <Label htmlFor="motivo-zerar">
                  Motivo <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="motivo-zerar"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ex: Produto danificado, Inventário..."
                />
                {motivo.length > 0 && motivo.length < 3 && (
                  <p className="text-xs text-destructive">Mínimo 3 caracteres</p>
                )}
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleZerar}
            disabled={!isValid || zerarEstoque.isPending}
          >
            {zerarEstoque.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Zerar Estoque
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
