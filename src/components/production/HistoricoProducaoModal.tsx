import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ProducaoData } from '@/entities/Producao';
import { useProducaoLogsComTempo, LogComTempoNaEtapa } from '@/hooks/useProducaoLog';
import { useIsMobile } from '@/hooks/use-mobile';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';

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
  Hash,
  UserCheck,
  Palette,
  Link2,
  CheckCircle2,
  Droplets,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoricoProducaoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lot: ProducaoData | null;
}

/** Parse structured data from observacao field */
function parseObservacao(obs: string | null | undefined) {
  if (!obs) return { extras: [], gradeItens: [], textoLivre: '' };

  const extras: { label: string; value: string; icon: 'package' | 'scissors' | 'hash' | 'usercheck' | 'palette' | 'link2' | 'checkcircle2' | 'droplets' }[] = [];
  const gradeItens: { tamanho: string; quantidade: number; prioridade: boolean }[] = [];
  const parts = obs.split('|').map(p => p.trim());
  const restParts: string[] = [];

  for (const part of parts) {
    const rolosMatch = part.match(/^Rolos:\s*(.+)$/i);
    const pecasMatch = part.match(/^Peças cortadas:\s*(.+)$/i);
    const numMatch = part.match(/^Numeração:\s*(.+)$/i);
    const gradeMatch      = part.match(/^Grade:\s*(.+)$/i);
    const cortadorMatch   = part.match(/^Cortador:\s*(.+)$/i);
    const corLinhaMatch   = part.match(/^Cor da linha:\s*(.+)$/i);
    const qtdZiperMatch   = part.match(/^Zíper \(qtd\):\s*(.+)$/i);
    const tipoZiperMatch  = part.match(/^Zíper \(tipo\/(cor|tamanho)\):\s*(.+)$/i);
    const booleanMatch      = part.match(/^(Abanhado|Etiquetas|Forro|Processo especial|Bolsa transparente|Cordão|Placa da marca|Tag):\s*(.+)$/i);
    const botaoMatch        = part.match(/^Botão:\s*(\d+)/i);
    const tipoLavadoMatch   = part.match(/^Tipo de lavado:\s*(.+)$/i);
    const corResultadoMatch = part.match(/^Cor do resultado:\s*(.+)$/i);
    const qtdPecasMatch     = part.match(/^Peças:\s*(\d+)$/i);

    if (gradeMatch) {
      // Parse "Grade: 36:50, 38:80★, 40:50"
      gradeMatch[1].split(',').forEach(item => {
        const g = item.trim().match(/^([^\s:]+):(\d+)(★)?$/);
        if (g) gradeItens.push({ tamanho: g[1], quantidade: Number(g[2]), prioridade: !!g[3] });
      });
    } else if (cortadorMatch) {
      extras.push({ label: 'Cortador', value: cortadorMatch[1], icon: 'usercheck' });
    } else if (corLinhaMatch) {
      extras.push({ label: 'Cor da linha', value: corLinhaMatch[1], icon: 'palette' });
    } else if (qtdZiperMatch) {
      extras.push({ label: 'Zíper (qtd)', value: qtdZiperMatch[1], icon: 'link2' });
    } else if (tipoZiperMatch) {
      extras.push({ label: 'Zíper', value: tipoZiperMatch[2], icon: 'link2' });
    } else if (booleanMatch) {
      extras.push({ label: booleanMatch[1], value: booleanMatch[2], icon: 'checkcircle2' });
    } else if (tipoLavadoMatch) {
      extras.push({ label: 'Tipo de lavado', value: tipoLavadoMatch[1], icon: 'droplets' });
    } else if (corResultadoMatch) {
      extras.push({ label: 'Cor do resultado', value: corResultadoMatch[1], icon: 'palette' });
    } else if (qtdPecasMatch) {
      extras.push({ label: 'Peças', value: qtdPecasMatch[1], icon: 'package' });
    } else if (botaoMatch) {
      extras.push({ label: 'Botão', value: botaoMatch[1] + 'x', icon: 'hash' });
    } else if (rolosMatch) {
      extras.push({ label: 'Rolos', value: rolosMatch[1], icon: 'package' });
    } else if (pecasMatch) {
      extras.push({ label: 'Peças cortadas', value: pecasMatch[1], icon: 'scissors' });
    } else if (numMatch) {
      extras.push({ label: 'Numeração', value: numMatch[1], icon: 'hash' });
    } else if (part) {
      restParts.push(part);
    }
  }

  return { extras, gradeItens, textoLivre: restParts.join(' | ') };
}

const ICON_MAP = {
  package: Package,
  scissors: Scissors,
  hash: Hash,
  usercheck: UserCheck,
  palette: Palette,
  link2: Link2,
  checkcircle2: CheckCircle2,
  droplets: Droplets,
};

const STAGE_LABELS: Record<string, string> = {
  'Corte': 'Cortador',
  'Costura/Facção': 'Facção / Costureira',
  'Travete': 'Travete',
  'Destroyed': 'Destroyed',
  'Lavanderia': 'Lavanderia',
  'Acabamento': 'Limpado',
  'Aprontamento': 'Aprontamento',
  'Vendas': 'Vendas',
};

export function HistoricoProducaoModal({ open, onOpenChange, lot }: HistoricoProducaoModalProps) {
  const isMobile = useIsMobile();
  const { data, isLoading } = useProducaoLogsComTempo(lot?.id || null, lot?.created_date, lot?.responsavel ?? undefined);

  const headerContent = lot ? (
    <div className="px-1 pb-4 border-b space-y-3 flex-shrink-0">
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
  ) : null;

  const timelineContent = (
    <div className="flex-1 overflow-y-auto overscroll-contain min-h-0 mt-4 pr-2">
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
                {data.logs
                  .filter(log => !(log.processo_anterior === null && log.processo_novo === 'Corte'))
                  .map((log, index) => (
                    <TimelineEntry key={log.id} log={log} index={index} />
                  ))}

                {/* Creation event */}
                {lot && (() => {
                  const logInicial = data.logs.find(l => !l.processo_anterior && l.processo_novo === 'Corte');
                  const criacaoDate = logInicial ? new Date(logInicial.created_at) : new Date(lot.created_date);
                  const { extras: criExtras, gradeItens: criGrade } = parseObservacao(logInicial?.observacao);

                  // Cortador: from initial log, or extracted from the outgoing transition observacoes
                  let cortador = logInicial?.responsavel || null;
                  if (!cortador) {
                    const outgoing = data.logs.find(l => l.processo_anterior === 'Corte' && l.observacao);
                    if (outgoing?.observacao) {
                      const m = outgoing.observacao.match(/Cortador:\s*([^|]+)/i);
                      if (m) cortador = m[1].trim();
                    }
                  }

                  return (
                    <div className="relative flex gap-3">
                      <div className="h-3 w-3 rounded-full border-2 border-primary bg-primary shrink-0 mt-1.5 z-10" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                          <Flag className="h-3 w-3 text-primary" />
                          <span>{format(criacaoDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                        </div>
                        <span className="font-semibold text-sm text-primary">Lote Criado</span>
                        <p className="text-xs text-muted-foreground mt-0.5">Etapa inicial: Corte</p>
                        {cortador && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <UserCheck className="h-3 w-3" />
                            <span className="font-medium">Cortador:</span> {cortador}
                          </p>
                        )}
                        {/* Grade de Corte da criação */}
                        {criGrade.length > 0 && (
                          <div className="mt-2 border border-border rounded-md overflow-hidden">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1 bg-muted/50 border-b border-border text-[10px] uppercase font-medium text-muted-foreground">
                              <span>Tamanho</span><span>Qtd</span><span>Prior.</span>
                            </div>
                            {criGrade.map(g => (
                              <div key={g.tamanho} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-2 py-1 border-b border-border last:border-0 text-xs">
                                <span className="font-medium">{g.tamanho}</span>
                                <span>{g.quantidade}</span>
                                <span>{g.prioridade ? '⭐' : '—'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Extras (rolos, etc.) da criação */}
                        {criExtras.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {criExtras.map((extra, i) => {
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
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
      </div>
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
          <div className="flex-1 flex flex-col overflow-hidden min-h-0 px-4 pb-4">
            {headerContent}
            {timelineContent}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden" style={{ display: 'flex' }}>
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            Histórico de Movimentações
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {headerContent}
          {timelineContent}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Individual timeline entry component */
function TimelineEntry({ log, index }: { log: LogComTempoNaEtapa; index: number }) {
  const { extras, gradeItens, textoLivre } = parseObservacao(log.observacao);
  const stageLabel = STAGE_LABELS[log.processo_novo] || 'Responsável';
  const isCurrent = index === 0;

  return (
    <div className="relative flex gap-3">
      <div className={cn(
        "h-3 w-3 rounded-full border-2 bg-background shrink-0 mt-1.5 z-10",
        isCurrent ? "border-primary" : "border-muted-foreground/30"
      )} />

      <div className="flex-1 pb-4">
        {/* Date/Time */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <Calendar className="h-3 w-3" />
          <span>
            {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          {isCurrent && (
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
            {isCurrent
              ? `${log.tempoNaEtapa.label} nesta etapa`
              : `ficou ${log.tempoNaEtapa.label}`}
          </span>
        </div>

        {/* Grade de Corte table */}
        {gradeItens.length > 0 && (
          <div className="mt-2 border border-border rounded-md overflow-hidden">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-2 py-1 bg-muted/50 border-b border-border text-[10px] uppercase font-medium text-muted-foreground">
              <span>Tamanho</span><span>Qtd</span><span>Prior.</span>
            </div>
            {gradeItens.map(g => (
              <div key={g.tamanho} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center px-2 py-1 border-b border-border last:border-0 text-xs">
                <span className="font-medium">{g.tamanho}</span>
                <span>{g.quantidade}</span>
                <span>{g.prioridade ? '⭐' : '—'}</span>
              </div>
            ))}
          </div>
        )}

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
