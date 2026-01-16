import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ChevronRight, Eye, Check, Clock, Package, MoreVertical, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CargaDiaAgrupada, TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

interface HistoricoAgrupadoProps {
  historico: CargaDiaAgrupada[];
  onVerDetalhes: (carga: TransferenciaComItensHistorico) => void;
  onExcluirCarga: (carga: TransferenciaComItensHistorico) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export function HistoricoAgrupado({ historico, onVerDetalhes, onExcluirCarga, isLoading }: HistoricoAgrupadoProps) {
  const [openDays, setOpenDays] = useState<Set<string>>(new Set([historico[0]?.data]));

  const toggleDay = (data: string) => {
    const newOpen = new Set(openDays);
    if (newOpen.has(data)) {
      newOpen.delete(data);
    } else {
      newOpen.add(data);
    }
    setOpenDays(newOpen);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (historico.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium mb-2">Nenhuma carga no período</h3>
        <p className="text-sm text-muted-foreground">
          Não há cargas registradas para o período selecionado.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        Histórico de Cargas
      </h2>

      <div className="space-y-2">
        {historico.map((dia) => (
          <Collapsible
            key={dia.data}
            open={openDays.has(dia.data)}
            onOpenChange={() => toggleDay(dia.data)}
          >
            <Card>
              <CollapsibleTrigger asChild>
                <div className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {openDays.has(dia.data) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <span className="font-semibold">{dia.dataFormatada}</span>
                        <span className="text-muted-foreground ml-2 capitalize">({dia.diaSemana})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        {dia.totalCargas} carga{dia.totalCargas !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground">
                        {dia.totalEnviado} env
                      </span>
                      <span className="text-muted-foreground">
                        {dia.totalRetornado} ret
                      </span>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600">
                        {dia.totalVendido} vendido{dia.totalVendido !== 1 ? 's' : ''}
                      </Badge>
                      <span className="font-semibold text-primary">
                        {formatCurrency(dia.valorVendido)}
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <div className="px-4 pb-4 space-y-2">
                  {dia.cargas.map((carga) => {
                    const totais = calcularTotaisCargaPublic(carga.itens);
                    const horario = format(new Date(carga.dataSaida), 'HH:mm');

                    return (
                      <div
                        key={carga.id}
                        className={cn(
                          'flex items-center justify-between p-3 rounded-lg border transition-colors',
                          carga.status === 'em_andamento'
                            ? 'border-primary/30 bg-primary/5'
                            : 'bg-muted/30'
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {carga.status === 'concluida' ? (
                            <Check size={16} className="text-emerald-600" />
                          ) : (
                            <Clock size={16} className="text-primary animate-pulse" />
                          )}
                          <span className="text-sm font-medium">{horario}</span>
                          <Badge
                            variant={carga.status === 'em_andamento' ? 'default' : 'secondary'}
                            className={cn(
                              'text-xs',
                              carga.status === 'em_andamento' && 'bg-primary'
                            )}
                          >
                            {carga.status === 'em_andamento' ? 'Em andamento' : 'Concluída'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">
                            {totais.enviado}→{totais.retornado}={totais.vendido}
                          </span>
                          <span className="font-semibold text-emerald-600">
                            {formatCurrency(totais.valor)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onVerDetalhes(carga)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => onExcluirCarga(carga)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir carga
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
