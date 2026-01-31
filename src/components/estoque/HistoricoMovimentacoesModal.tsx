import React, { useState } from 'react';
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
import { Loader2, ArrowUp, ArrowDown, ArrowLeftRight, Package, RefreshCw, Clock, MapPin, FileText, Tag, Calendar } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

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
    color: 'bg-emerald-500/10 text-emerald-700 border-emerald-700/30',
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
  const [semLimite, setSemLimite] = useState(false);
  const queryClient = useQueryClient();
  
  const { data: historico = [], isLoading, refetch } = useHistoricoMovimentacoesItem(
    item?.itemId || null,
    item?.localId || null,
    semLimite
  );

  if (!item) return null;

  // Calcular período consultado
  const periodoConsultado = semLimite 
    ? 'Todo o histórico' 
    : 'Últimas 50 movimentações';

  const handleBuscarDesdeInicio = () => {
    setSemLimite(true);
  };

  const handleAtualizar = () => {
    refetch();
  };

  const isEntrada = (tipo: string) => 
    tipo.includes('ENTRADA') || tipo === 'entrada' || tipo === 'RETORNO_FEIRA';
  
  const isSaida = (tipo: string) => 
    tipo.includes('SAIDA') || tipo === 'saida' || tipo === 'VENDA_FEIRA' || tipo === 'ENVIO_FEIRA';

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
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.itemNome}</p>
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
            // Estado vazio melhorado
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Package className="h-8 w-8 text-muted-foreground/50" />
              </div>
              
              <h3 className="font-medium text-lg mb-1">
                Nenhuma movimentação encontrada
              </h3>
              
              <p className="text-sm text-muted-foreground mb-4">
                {periodoConsultado}
              </p>

              <div className="bg-muted/30 rounded-lg p-4 mb-6 text-left max-w-sm">
                <p className="text-sm font-medium mb-2">Possíveis causas:</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/50">•</span>
                    Este item não teve movimentação neste período
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/50">•</span>
                    O local selecionado não tem histórico para este item
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-muted-foreground/50">•</span>
                    O item foi adicionado recentemente ao sistema
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {!semLimite && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleBuscarDesdeInicio}
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Buscar desde o início
                  </Button>
                )}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleAtualizar}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Info do período */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b">
                <span>{historico.length} movimentação(ões) • {periodoConsultado}</span>
                <div className="flex gap-2">
                  {!semLimite && historico.length >= 50 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 text-xs"
                      onClick={handleBuscarDesdeInicio}
                    >
                      Ver todo histórico
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 text-xs"
                    onClick={handleAtualizar}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                </div>
              </div>

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
                    {/* Cabeçalho: Data + Tipo */}
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(mov.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                        <span className="text-muted-foreground">
                          {format(new Date(mov.createdAt), "HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-xs flex items-center gap-1 shrink-0", config.color)}
                      >
                        {config.icon}
                        {config.label}
                      </Badge>
                    </div>

                    {/* Quantidade e Saldo */}
                    <div className="flex items-center gap-4 mb-3">
                      <div className={cn(
                        "flex items-center gap-1 text-base font-semibold",
                        isEntrada(mov.tipo) ? 'text-green-600' : '',
                        isSaida(mov.tipo) ? 'text-red-600' : ''
                      )}>
                        {isEntrada(mov.tipo) && <ArrowUp className="h-4 w-4" />}
                        {isSaida(mov.tipo) && <ArrowDown className="h-4 w-4" />}
                        {isEntrada(mov.tipo) ? '+' : '-'}
                        {mov.quantidade} peças
                      </div>

                      {(mov.estoqueAntes !== null || mov.estoqueDepois !== null) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>Saldo:</span>
                          <span className="font-medium text-foreground">
                            {mov.estoqueAntes ?? '—'}
                          </span>
                          <span>→</span>
                          <span className="font-medium text-foreground">
                            {mov.estoqueDepois ?? '—'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Detalhes adicionais */}
                    <div className="space-y-1.5 text-sm">
                      {/* Local */}
                      {mov.localNome && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{mov.localNome}</span>
                        </div>
                      )}

                      {/* Tipo de Ajuste */}
                      {mov.tipoAjusteNome && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Tag className="h-3.5 w-3.5" />
                          <span>Tipo: {mov.tipoAjusteNome}</span>
                        </div>
                      )}

                      {/* Motivo/Observação */}
                      {mov.motivo && (
                        <div className="flex items-start gap-2 text-muted-foreground">
                          <FileText className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>{mov.motivo}</span>
                        </div>
                      )}

                      {/* Referência de transferência */}
                      {mov.transferenciaId && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <ArrowLeftRight className="h-3.5 w-3.5" />
                          <span className="text-xs">
                            Ref: {mov.transferenciaId.slice(0, 8)}...
                          </span>
                        </div>
                      )}
                    </div>
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
