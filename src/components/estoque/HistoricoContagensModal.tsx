import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useContagensEstoque } from '@/hooks/useContagensEstoque';
import { Loader2, ClipboardList, Package, DollarSign, Calendar, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoricoContagensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string;
  localNome: string;
}

export function HistoricoContagensModal({
  open,
  onOpenChange,
  localId,
  localNome,
}: HistoricoContagensModalProps) {
  const { data: contagens, isLoading } = useContagensEstoque(localId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-lg max-h-[80vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Histórico de Contagens
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{localNome}</p>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !contagens || contagens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma contagem registrada</p>
              <p className="text-xs mt-1">Registre uma contagem para começar a acompanhar vendas</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contagens.map((contagem, index) => (
                <div
                  key={contagem.id}
                  className={`p-4 rounded-lg border ${
                    index === 0 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {format(new Date(contagem.dataContagem), "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(contagem.dataContagem), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {index === 0 && (
                      <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                        Última
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Package className="h-4 w-4 text-blue-500" />
                      <span className="text-muted-foreground">Peças:</span>
                      <span className="font-semibold">{contagem.totalPecas}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="h-4 w-4 text-green-500" />
                      <span className="text-muted-foreground">Valor:</span>
                      <span className="font-semibold">
                        R$ {contagem.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {contagem.observacoes && (
                    <div className="mt-3 pt-3 border-t flex items-start gap-2 text-sm text-muted-foreground">
                      <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                      <p>{contagem.observacoes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
