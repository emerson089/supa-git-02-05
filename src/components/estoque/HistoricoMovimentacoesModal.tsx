import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { LotImage } from '@/components/production/LotImage';
import { useHistoricoMovimentacoesItem, EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { Loader2, ArrowUp, ArrowDown, ArrowLeftRight, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface HistoricoMovimentacoesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: EstoqueLocalDetalhado | null;
}

const tipoConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'AJUSTE_ENTRADA': { 
    label: 'Ajuste Entrada', 
    color: 'bg-green-500/10 text-green-700 border-green-500/30',
    icon: <ArrowUp className="h-3 w-3" />
  },
  'AJUSTE_SAIDA': { 
    label: 'Ajuste Saída', 
    color: 'bg-red-500/10 text-red-700 border-red-500/30',
    icon: <ArrowDown className="h-3 w-3" />
  },
  'TRANSFERENCIA': { 
    label: 'Transferência', 
    color: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    icon: <ArrowLeftRight className="h-3 w-3" />
  },
  'ENVIO_FEIRA': { 
    label: 'Envio Feira', 
    color: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
    icon: <ArrowUp className="h-3 w-3" />
  },
  'RETORNO_FEIRA': { 
    label: 'Retorno Feira', 
    color: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
    icon: <ArrowDown className="h-3 w-3" />
  },
  'VENDA_FEIRA': { 
    label: 'Venda Feira', 
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    icon: <Package className="h-3 w-3" />
  },
  'ESTORNO_FEIRA': { 
    label: 'Estorno Feira', 
    color: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
    icon: <ArrowLeftRight className="h-3 w-3" />
  },
  'entrada': { 
    label: 'Entrada', 
    color: 'bg-green-500/10 text-green-700 border-green-500/30',
    icon: <ArrowUp className="h-3 w-3" />
  },
  'saida': { 
    label: 'Saída', 
    color: 'bg-red-500/10 text-red-700 border-red-500/30',
    icon: <ArrowDown className="h-3 w-3" />
  },
};

export function HistoricoMovimentacoesModal({ open, onOpenChange, item }: HistoricoMovimentacoesModalProps) {
  const { data: historico = [], isLoading } = useHistoricoMovimentacoesItem(
    item?.itemId || null,
    item?.localId || null
  );

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>Histórico de Movimentações</DialogTitle>
          <div className="flex items-center gap-3 mt-2">
            <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted border shrink-0">
              <LotImage
                src={item.itemImagemUrl}
                alt={item.itemNome}
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <p className="font-medium">{item.itemNome}</p>
              <p className="text-xs text-muted-foreground">Cód: {item.itemCodigo}</p>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : historico.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-10 w-10 mb-2 opacity-50" />
              <p>Nenhuma movimentação encontrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historico.map((mov) => {
                const config = tipoConfig[mov.tipo] || {
                  label: mov.tipo,
                  color: 'bg-muted text-muted-foreground',
                  icon: <Package className="h-3 w-3" />
                };

                return (
                  <div
                    key={mov.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={cn("text-xs flex items-center gap-1", config.color)}
                        >
                          {config.icon}
                          {config.label}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {format(new Date(mov.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className={cn(
                        "font-semibold",
                        mov.tipo.includes('ENTRADA') || mov.tipo === 'entrada' ? 'text-green-600' : '',
                        mov.tipo.includes('SAIDA') || mov.tipo === 'saida' ? 'text-red-600' : ''
                      )}>
                        {mov.tipo.includes('ENTRADA') || mov.tipo === 'entrada' ? '+' : '-'}
                        {mov.quantidade} peças
                      </span>

                      {(mov.estoqueAntes !== null || mov.estoqueDepois !== null) && (
                        <span className="text-muted-foreground text-xs">
                          Antes: {mov.estoqueAntes ?? '-'} → Depois: {mov.estoqueDepois ?? '-'}
                        </span>
                      )}
                    </div>

                    {mov.motivo && (
                      <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                        {mov.motivo}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 bg-background">
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
