import { useState } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePecasEmConserto, StatusDefeitos } from '@/hooks/usePecasEmConserto';
import { ProducaoData } from '@/entities/Producao';
import { FinalizarConsertoModal } from '@/components/production/FinalizarConsertoModal';
import { Wrench, RotateCcw, CheckCircle2, Hammer, AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const STATUS_CONFIG: Record<StatusDefeitos, {
  label: string;
  badgeClass: string;
  icon: React.ElementType;
}> = {
  pendente_conserto: {
    label: 'Pendente',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700',
    icon: AlertTriangle,
  },
  em_conserto: {
    label: 'Em Conserto',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700',
    icon: Hammer,
  },
  conserto_concluido: {
    label: 'Concluído',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700',
    icon: CheckCircle2,
  },
};

function LoteConserto({ lot, onAtualizarStatus, onDevolver, onFinalizarConserto, isLoading }: {
  lot: ProducaoData;
  onAtualizarStatus: (id: string, status: StatusDefeitos) => void;
  onDevolver: (lot: ProducaoData) => void;
  onFinalizarConserto: (lot: ProducaoData) => void;
  isLoading: boolean;
}) {
  const status = (lot.status_defeitos as StatusDefeitos) || 'pendente_conserto';
  const statusInfo = STATUS_CONFIG[status];
  const StatusIcon = statusInfo.icon;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
          {/* Left — lot info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold text-primary bg-secondary px-2 py-1 rounded-md">
                #{lot.id_producao}
              </span>
              <Badge variant="outline" className={cn("text-[10px] px-2", statusInfo.badgeClass)}>
                <StatusIcon size={10} className="mr-1" />
                {statusInfo.label}
              </Badge>
            </div>

            <p className="font-semibold text-sm mt-1.5 truncate">
              {lot.modelo_nome_cache || 'Sem modelo'}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Wrench size={11} className="text-red-500" />
                <strong className="text-red-600">{lot.pecas_com_defeito}</strong> com defeito
              </span>
              <span>
                <strong>{lot.quantidade_aprovada ?? lot.quantidade}</strong> aprovadas
              </span>
              {lot.quantidade_final && (
                <span>{lot.quantidade_final} total conferido</span>
              )}
              <span>Etapa atual: <strong>{lot.processo_atual}</strong></span>
              <span>{format(new Date(lot.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
            </div>
          </div>

          {/* Right — actions */}
          <div className="flex flex-wrap gap-2 shrink-0">
            {status === 'pendente_conserto' && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading}
                  onClick={() => onDevolver(lot)}
                  className="gap-1.5 text-xs"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                  Devolver ao Aprontamento
                </Button>
                <Button
                  size="sm"
                  disabled={isLoading}
                  onClick={() => onAtualizarStatus(lot.id, 'em_conserto')}
                  className="gap-1.5 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {isLoading ? <Loader2 size={12} className="animate-spin" /> : <Hammer size={12} />}
                  Iniciar Conserto
                </Button>
              </>
            )}

            {status === 'em_conserto' && (
              <Button
                size="sm"
                disabled={isLoading}
                onClick={() => onFinalizarConserto(lot)}
                className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isLoading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                Finalizar Conserto
              </Button>
            )}

            {status === 'conserto_concluido' && (
              <span className="text-xs text-emerald-600 flex items-center gap-1 py-1.5 px-3 rounded-md bg-emerald-50 border border-emerald-200">
                <CheckCircle2 size={12} />
                Conserto finalizado
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function PecasEmConserto() {
  const isMobile = useIsMobile();
  const {
    lotes,
    isLoading,
    atualizarStatus,
    devolverAprontamento,
    finalizarConserto,
    isUpdating,
    isDevolvendo,
    isFinalizando,
  } = usePecasEmConserto();

  const [activeTab, setActiveTab] = useState<'pendente' | 'em_conserto' | 'concluido' | 'todos'>('pendente');
  const [lotParaFinalizar, setLotParaFinalizar] = useState<ProducaoData | null>(null);

  const filtered = lotes.filter(l => {
    if (activeTab === 'todos') return true;
    if (activeTab === 'pendente') return l.status_defeitos === 'pendente_conserto';
    if (activeTab === 'em_conserto') return l.status_defeitos === 'em_conserto';
    if (activeTab === 'concluido') return l.status_defeitos === 'conserto_concluido';
    return true;
  });

  const counts = {
    pendente: lotes.filter(l => l.status_defeitos === 'pendente_conserto').length,
    em_conserto: lotes.filter(l => l.status_defeitos === 'em_conserto').length,
    concluido: lotes.filter(l => l.status_defeitos === 'conserto_concluido').length,
  };

  const tabs: Array<{ key: typeof activeTab; label: string; count: number; color: string }> = [
    { key: 'pendente', label: 'Pendente', count: counts.pendente, color: 'text-red-600' },
    { key: 'em_conserto', label: 'Em Conserto', count: counts.em_conserto, color: 'text-amber-600' },
    { key: 'concluido', label: 'Concluído', count: counts.concluido, color: 'text-emerald-600' },
    { key: 'todos', label: 'Todos', count: lotes.length, color: 'text-foreground' },
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden pb-24 md:pb-0">
        <MobileHeader title="Peças em Conserto" />

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="max-w-4xl mx-auto space-y-6">

            {/* Header */}
            <div className="space-y-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Wrench className="text-amber-500" />
                Peças em Conserto
              </h1>
              <p className="text-muted-foreground text-sm">
                Lotes com peças defeituosas identificadas na conferência de qualidade.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                    activeTab === tab.key
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn("ml-1.5 text-xs font-bold", tab.color)}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* List */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList size={48} className="text-muted-foreground/30 mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  Nenhum lote {activeTab !== 'todos' ? `com status "${tabs.find(t => t.key === activeTab)?.label}"` : 'com defeitos registrados'}
                </p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Os lotes com peças defeituosas aparecem aqui após a conferência de qualidade.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(lot => (
                  <LoteConserto
                    key={lot.id}
                    lot={lot}
                    onAtualizarStatus={(id, status) => atualizarStatus({ id, status })}
                    onDevolver={devolverAprontamento}
                    onFinalizarConserto={setLotParaFinalizar}
                    isLoading={isUpdating || isDevolvendo || isFinalizando}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Finalizar Conserto Modal */}
      <FinalizarConsertoModal
        open={!!lotParaFinalizar}
        onOpenChange={(open) => { if (!open) setLotParaFinalizar(null); }}
        lot={lotParaFinalizar}
        loading={isFinalizando}
        onConfirm={async (data) => {
          if (!lotParaFinalizar) return;
          await finalizarConserto({ lot: lotParaFinalizar, data });
          setLotParaFinalizar(null);
        }}
      />

      {isMobile && <BottomNavigation />}
    </div>
  );
}
