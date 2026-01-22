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
import { ChevronDown, ChevronRight, Eye, Check, Clock, Package, MoreVertical, Trash2, RotateCcw, Ban, FileText, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { CargaDiaAgrupada, TransferenciaComItensHistorico, calcularTotaisCargaPublic } from '@/hooks/useFeiraHistorico';

interface HistoricoAgrupadoProps {
  historico: CargaDiaAgrupada[];
  onVerDetalhes: (carga: TransferenciaComItensHistorico) => void;
  onExcluirCarga: (carga: TransferenciaComItensHistorico) => void;
  onEstornarCarga?: (carga: TransferenciaComItensHistorico) => void;
  onExcluirHistorico?: (carga: TransferenciaComItensHistorico) => void;
  onGerarPDF?: (carga: TransferenciaComItensHistorico) => void;
  onEditarRetorno?: (carga: TransferenciaComItensHistorico) => void;
  isLoading: boolean;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

// Helper para obter configurações visuais baseadas no status
function getStatusConfig(status: string) {
  switch (status) {
    case 'em_andamento':
      return {
        label: 'Em andamento',
        variant: 'default' as const,
        icon: Clock,
        iconClass: 'text-primary animate-pulse',
        badgeClass: 'bg-primary',
        rowClass: 'border-primary/30 bg-primary/5',
      };
    case 'concluida':
      return {
        label: 'Concluída',
        variant: 'secondary' as const,
        icon: Check,
        iconClass: 'text-emerald-600',
        badgeClass: '',
        rowClass: 'bg-muted/30',
      };
    case 'estornada':
      return {
        label: 'Estornada',
        variant: 'outline' as const,
        icon: RotateCcw,
        iconClass: 'text-amber-600',
        badgeClass: 'border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30',
        rowClass: 'bg-amber-50/30 border-amber-200 dark:bg-amber-950/10 dark:border-amber-900',
      };
    case 'cancelada':
      return {
        label: 'Cancelada',
        variant: 'outline' as const,
        icon: Ban,
        iconClass: 'text-muted-foreground',
        badgeClass: 'border-muted text-muted-foreground',
        rowClass: 'bg-muted/20 opacity-60',
      };
    default:
      return {
        label: status,
        variant: 'secondary' as const,
        icon: Package,
        iconClass: 'text-muted-foreground',
        badgeClass: '',
        rowClass: 'bg-muted/30',
      };
  }
}

export function HistoricoAgrupado({ historico, onVerDetalhes, onExcluirCarga, onEstornarCarga, onExcluirHistorico, onGerarPDF, onEditarRetorno, isLoading }: HistoricoAgrupadoProps) {
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
                <div className="p-3 sm:p-4 cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {openDays.has(dia.data) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="min-w-0">
                        <span className="font-semibold text-sm sm:text-base">{dia.dataFormatada}</span>
                        <span className="text-muted-foreground ml-1 sm:ml-2 capitalize text-xs sm:text-sm">({dia.diaSemana})</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 sm:gap-4 text-xs sm:text-sm pl-6 sm:pl-0 mt-1 sm:mt-0">
                      <span className="text-muted-foreground">
                        {dia.totalCargas} carga{dia.totalCargas !== 1 ? 's' : ''}
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">
                        {dia.totalEnviado} env
                      </span>
                      <span className="text-muted-foreground hidden sm:inline">
                        {dia.totalRetornado} ret
                      </span>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 text-xs">
                        {dia.totalVendido} vend
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
                    const statusConfig = getStatusConfig(carga.status);
                    const StatusIcon = statusConfig.icon;

                    // Determinar quais ações mostrar baseado no status
                    const canExcluir = carga.status === 'em_andamento';
                    const canEstornar = carga.status === 'concluida' && onEstornarCarga;
                    const isFinalized = carga.status === 'estornada' || carga.status === 'cancelada';

                      return (
                      <div
                        key={carga.id}
                        className={cn(
                          'flex flex-col gap-2 p-3 rounded-lg border transition-colors sm:flex-row sm:items-center sm:justify-between',
                          statusConfig.rowClass
                        )}
                      >
                        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                          <StatusIcon size={16} className={cn(statusConfig.iconClass, 'flex-shrink-0')} />
                          <span className="text-sm font-medium">{horario}</span>
                          <Badge
                            variant={statusConfig.variant}
                            className={cn('text-xs flex-shrink-0', statusConfig.badgeClass)}
                          >
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 sm:gap-4 text-sm pl-6 sm:pl-0">
                          <span className="text-muted-foreground text-xs sm:text-sm">
                            {totais.enviado}→{totais.retornado}={totais.vendido}
                          </span>
                          <div className="flex items-center gap-2 sm:gap-4">
                            <span className="font-semibold text-emerald-600">
                              {formatCurrency(totais.valor)}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                                  <MoreVertical size={16} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => onVerDetalhes(carga)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Ver detalhes
                                </DropdownMenuItem>
                                
                                {onGerarPDF && (
                                  <DropdownMenuItem onClick={() => onGerarPDF(carga)}>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Gerar PDF
                                  </DropdownMenuItem>
                                )}
                                
                                {/* Corrigir retorno: apenas concluída */}
                                {carga.status === 'concluida' && onEditarRetorno && (
                                  <DropdownMenuItem onClick={() => onEditarRetorno(carga)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Corrigir retorno
                                  </DropdownMenuItem>
                                )}
                                
                                {/* Ações disponíveis apenas para cargas não finalizadas */}
                                {!isFinalized && (canExcluir || canEstornar) && (
                                  <DropdownMenuSeparator />
                                )}
                                
                                {/* Excluir: apenas em_andamento */}
                                {canExcluir && (
                                  <DropdownMenuItem
                                    onClick={() => onExcluirCarga(carga)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir carga
                                  </DropdownMenuItem>
                                )}
                                
                                {/* Excluir: apenas concluida */}
                                {canEstornar && (
                                  <DropdownMenuItem
                                    onClick={() => onEstornarCarga!(carga)}
                                    className="text-destructive focus:text-destructive"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                )}
                                
                                {/* Excluir do histórico: apenas estornada/cancelada */}
                                {isFinalized && onExcluirHistorico && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => onExcluirHistorico(carga)}
                                      className="text-destructive focus:text-destructive"
                                    >
                                      <Trash2 className="mr-2 h-4 w-4" />
                                      Excluir do histórico
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
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
