import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useCriarContagem } from '@/hooks/useContagensEstoque';
import { EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Loader2, ClipboardCheck, Package, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface NovaContagemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string;
  localNome: string;
  itensEstoque: EstoqueLocalDetalhado[];
}

export function NovaContagemModal({
  open,
  onOpenChange,
  localId,
  localNome,
  itensEstoque,
}: NovaContagemModalProps) {
  const [observacoes, setObservacoes] = useState('');
  const criarContagem = useCriarContagem();

  const totalPecas = itensEstoque.reduce((sum, i) => sum + i.quantidade, 0);
  const valorTotal = itensEstoque.reduce((sum, i) => sum + (i.quantidade * (i.precoExibido || 0)), 0);

  const handleConfirmar = async () => {
    const itens = itensEstoque.map(item => ({
      itemId: item.itemId,
      quantidade: item.quantidade,
      preco: item.precoExibido || 0,
    }));

    await criarContagem.mutateAsync({
      localId,
      itens,
      observacoes: observacoes.trim() || undefined,
    });

    setObservacoes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Nova Contagem
          </DialogTitle>
          <DialogDescription>
            Registrar contagem de estoque para {localNome}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Data/hora atual */}
          <div className="text-center p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">Data da contagem</p>
            <p className="text-lg font-semibold">
              {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>

          {/* Resumo do snapshot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs">Peças</span>
              </div>
              <p className="text-xl font-bold">{totalPecas}</p>
            </div>

            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
              <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                <DollarSign className="h-4 w-4" />
                <span className="text-xs">Valor</span>
              </div>
              <p className="text-xl font-bold">
                R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {itensEstoque.filter(i => i.quantidade > 0).length} modelos em estoque
          </p>

          {/* Observações opcionais */}
          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações (opcional)</Label>
            <Textarea
              id="observacoes"
              placeholder="Ex: Contagem realizada após inventário..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              className="min-h-[60px] resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            disabled={criarContagem.isPending || totalPecas === 0}
          >
            {criarContagem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar Contagem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
