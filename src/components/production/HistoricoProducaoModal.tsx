import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProducaoData } from '@/entities/Producao';
import { useProducaoLogsComTempo, LogComTempoNaEtapa } from '@/hooks/useProducaoLog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Clock, 
  ArrowRight, 
  User, 
  MessageSquare, 
  RefreshCw,
  Calendar,
  Flag,
  Package,
  Scissors,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoricoProducaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: ProducaoData | null;
}

/** Parse structured data from observacao field */
function parseObservacao(obs: string | null | undefined) {
  if (!obs) return { extras: [], textoLivre: '' };

  const extras: { label: string; value: string; icon: 'package' | 'scissors' | 'hash' }[] = [];
  const parts = obs.split('|').map(p => p.trim());
  const restParts: string[] = [];

  for (const part of parts) {
    const rolosMatch = part.match(/^Rolos:\s*(.+)$/i);
    const pecasMatch = part.match(/^Peças cortadas:\s*(.+)$/i);
    const numMatch = part.match(/^Numeração:\s*(.+)$/i);

    if (rolosMatch) {
      extras.push({ label: 'Rolos', value: rolosMatch[1], icon: 'package' });
    } else if (pecasMatch) {
      extras.push({ label: 'Peças cortadas', value: pecasMatch[1], icon: 'scissors' });
    } else if (numMatch) {
      extras.push({ label: 'Numeração', value: numMatch[1], icon: 'hash' });
    } else if (part) {
      restParts.push(part);
    }
  }

  return { extras, textoLivre: restParts.join(' | ') };
}

const ICON_MAP = {
  package: Package,
  scissors: Scissors,
  hash: Hash,
};

const STAGE_LABELS: Record<string, string> = {
  'Corte': 'Cortador',
  'Costura/Facção': 'Facção / Costureira',
  'Travete': 'Travete',
  'Destroyed': 'Destroyed',
  'Lavanderia': 'Lavanderia',
  'Limpado': 'Limpado',
  'Aprontamento': 'Aprontamento',
  'Vendas': 'Vendas',
};

export function HistoricoProducaoModal({ open, onOpenChange, lot }: HistoricoProducaoModalProps) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useProducaoLogsComTempo(lot?.id || null, lot?.created_date, lot?.responsavel ?? undefined);

  const content = (
    <div className="flex flex-col h-full">
      {/* Header Info */}
      {lot && (
        <div className="px-1 pb-4 border-b space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">{lot.id_producao}</span>
            <span>•</span>
            <span className="truncate">{lot.modelo_nome_cache || 'Sem modelo'}</span>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Tempo Total</p>
                <p className="text-sm font-bold">
                  {isLoading ? <Skeleton className="h-4 w-12" /> : data?.estatisticas.tempoTotalProducao.label}
                </p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <RefreshCw className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[10px] uppercase text-muted-foreground font-medium">Movimentações</p>
                <p className="text-sm font-bold">
                  {isLoading ? <Skeleton className="h-4 w-8" /> : data?.estatisticas.totalMovimentacoes || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Responsáveis por Etapa */}
          {!isLoading && data?.estatisticas.responsaveisPorEtapa && 
            Object.keys(data.estatisticas.responsaveisPorEtapa).length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
              <p className="text-[10px] uppercase text-muted-foreground font-medium flex items-center gap-1.5">
                <User className="h-3 w-3" />
                Responsáveis por Etapa
              </p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.estatisticas.responsaveisPorEtapa).map(([etapa, resp]) => (
                  <Badge key={etapa} variant="secondary" className="text-xs font-normal gap-1">
                    <span className="font-medium">{STAGE_LABELS[etapa] || etapa}:</span> {resp}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline */}
      <ScrollArea className="flex-1 mt-4">
        <div className="pr-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-3 w-3 rounded-full mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                </div>
              ))}
            </div>
          ) : !data?.logs.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <RefreshCw className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhuma movimentação registrada</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-border" />

              <div className="space-y-4">
                {data.logs.map((log, index) => (
                  <TimelineEntry key={log.id} log={log} index={index} />
                ))}

                {/* Creation event */}
                {lot && (
                  <div className="relative flex gap-3">
                    <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary shrink-0 mt-1.5 z-10" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <Flag className="h-3 w-3 text-primary" />
                        <span>
                          {format(new Date(lot.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <span className="font-semibold text-sm text-primary">
                        Lote Criado
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Etapa inicial: {data.logs.length > 0 
                          ? data.logs[data.logs.length - 1].processo_anterior || 'Corte'
                          : lot.processo_atual
                        }
                      </p>
                      {(() => {
                        const logInicial = data?.logs.find(
                          l => !l.processo_anterior && l.processo_novo === 'Corte'
                        );
                        const cortador = logInicial?.responsavel;
                        return cortador ? (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="font-medium">Cortador:</span> {cortador}
                          </p>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[85vh]">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Histórico de Movimentações
            </DrawerTitle>
          </DrawerHeader>
          <div className="flex-1 overflow-hidden px-4 pb-4">
            {content}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de Movimentações
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Individual timeline entry component */
function TimelineEntry({ log, index }: { log: LogComTempoNaEtapa; index: number }) {
  const { extras, textoLivre } = parseObservacao(log.observacao);
  const stageLabel = STAGE_LABELS[log.processo_novo] || 'Responsável';

  return (
    <div className="relative flex gap-3">
      <div className={cn(
        "h-3 w-3 rounded-full border-2 bg-background shrink-0 mt-1.5 z-10",
        index === 0 ? "border-primary" : "border-muted-foreground/30"
      )} />

      <div className="flex-1 pb-4">
        {/* Date/Time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Calendar className="h-3 w-3" />
          <span>
            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {index === 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-1">
              Última
            </Badge>
          )}
        </div>

        {/* Stage Change */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">
            {log.processo_anterior || 'Início'}
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-semibold text-sm text-primary">
            {log.processo_novo}
          </span>
        </div>

        {/* Meta info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          {log.responsavel && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span className="font-medium">{stageLabel}:</span> {log.responsavel}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {log.tempoNaEtapa.label} nesta etapa
          </span>
        </div>

        {/* Structured extras */}
        {extras.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {extras.map((extra, i) => {
              const Icon = ICON_MAP[extra.icon];
              return (
                <Badge key={i} variant="secondary" className="text-xs font-normal gap-1">
                  <Icon className="h-3 w-3" />
                  {extra.label}: {extra.value}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Free-text observation */}
        {textoLivre && (
          <div className="mt-2 p-2 bg-muted/50 rounded-md text-xs text-muted-foreground flex items-start gap-2">
            <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
            <span className="italic">"{textoLivre}"</span>
          </div>
        )}
      </div>
    </div>
  );
}
