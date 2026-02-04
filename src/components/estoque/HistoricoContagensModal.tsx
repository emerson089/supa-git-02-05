import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  useContagensEstoque,
  useContagemDetalhes,
  useExcluirContagem,
  calcularVariacoes,
  ContagemComVariacao,
} from '@/hooks/useContagensEstoque';
import {
  Loader2,
  ClipboardList,
  Package,
  DollarSign,
  Calendar,
  FileText,
  Plus,
  Trash2,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  BarChart3,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface HistoricoContagensModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  localId: string;
  localNome: string;
  onNovaContagem?: () => void;
}

// Componente para exibir detalhes expandidos de uma contagem
function ContagemDetalhes({ contagemId }: { contagemId: string }) {
  const { data: itens, isLoading } = useContagemDetalhes(contagemId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!itens || itens.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Nenhum item registrado nesta contagem.
      </p>
    );
  }

  return (
    <div className="space-y-1.5 pt-2">
      {itens.slice(0, 10).map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between text-sm py-1 px-2 rounded bg-background/50"
        >
          <span className="truncate flex-1 mr-2">{item.itemNome}</span>
          <div className="flex items-center gap-3 shrink-0 text-xs">
            <span className="text-muted-foreground">
              {item.quantidadeContada} pç
            </span>
            <span className="font-medium">
              R$ {(item.quantidadeContada * item.precoAplicado).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
      {itens.length > 10 && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          +{itens.length - 10} itens...
        </p>
      )}
    </div>
  );
}

// Card individual de contagem com variação e expansão
function ContagemCard({
  contagem,
  isUltima,
  onDelete,
}: {
  contagem: ContagemComVariacao;
  isUltima: boolean;
  onDelete: (id: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={`p-3 rounded-lg border ${
          isUltima ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">
              {format(new Date(contagem.dataContagem), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(contagem.dataContagem), "HH:mm", { locale: ptBR })}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isUltima && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full font-medium">
                Última
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(contagem.id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Métricas principais */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="flex items-center gap-2 text-sm">
            <Package className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Peças:</span>
            <span className="font-semibold">{contagem.totalPecas}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-primary" />
            <span className="text-muted-foreground">Valor:</span>
            <span className="font-semibold">
              R$ {contagem.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Variação desde anterior */}
        {contagem.variacao && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm">
              {contagem.variacao.pecas > 0 ? (
                <TrendingDown className="h-4 w-4 text-destructive" />
              ) : (
                <TrendingUp className="h-4 w-4 text-primary" />
              )}
              <span className="text-muted-foreground">
                {contagem.variacao.pecas > 0 ? 'Vendido' : 'Adicionado'} desde anterior:
              </span>
              <span className={`font-medium ${contagem.variacao.pecas > 0 ? 'text-destructive' : 'text-primary'}`}>
                {Math.abs(contagem.variacao.pecas)} pç
              </span>
              <span className={`text-xs ${contagem.variacao.valor > 0 ? 'text-destructive' : 'text-primary'}`}>
                ({contagem.variacao.valor > 0 ? '-' : '+'}R$ {Math.abs(contagem.variacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})
              </span>
            </div>
            <span className="text-xs text-muted-foreground ml-6">
              em {contagem.variacao.diasEntre} dia{contagem.variacao.diasEntre !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        {/* Observações */}
        {contagem.observacoes && (
          <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 mt-0.5 shrink-0" />
            <p className="text-xs">{contagem.observacoes}</p>
          </div>
        )}

        {/* Botão expandir */}
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-7 text-xs"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
            {isOpen ? 'Ocultar itens' : 'Ver itens desta contagem'}
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ContagemDetalhes contagemId={contagem.id} />
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function HistoricoContagensModal({
  open,
  onOpenChange,
  localId,
  localNome,
  onNovaContagem,
}: HistoricoContagensModalProps) {
  const { data: contagens, isLoading } = useContagensEstoque(localId);
  const excluirMutation = useExcluirContagem();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Calcular variações entre contagens
  const contagensComVariacao = useMemo(() => {
    if (!contagens || contagens.length === 0) return [];
    return calcularVariacoes(contagens);
  }, [contagens]);

  // Calcular métricas resumidas
  const metricas = useMemo(() => {
    if (!contagensComVariacao || contagensComVariacao.length < 2) {
      return null;
    }

    const totalVendidoPecas = contagensComVariacao.reduce(
      (sum, c) => sum + (c.variacao?.pecas || 0),
      0
    );
    const totalVendidoValor = contagensComVariacao.reduce(
      (sum, c) => sum + (c.variacao?.valor || 0),
      0
    );

    const primeira = contagens![contagens!.length - 1];
    const ultima = contagens![0];
    const diasTotais = differenceInDays(
      new Date(ultima.dataContagem),
      new Date(primeira.dataContagem)
    );

    const mediaPorDia = diasTotais > 0 ? totalVendidoPecas / diasTotais : 0;
    const ticketMedio = totalVendidoPecas > 0 ? totalVendidoValor / totalVendidoPecas : 0;

    return {
      totalVendidoPecas,
      totalVendidoValor,
      mediaPorDia,
      ticketMedio,
      diasTotais,
    };
  }, [contagensComVariacao, contagens]);

  // Dados para o gráfico (invertidos para ordem cronológica)
  const chartData = useMemo(() => {
    if (!contagens || contagens.length === 0) return [];
    return [...contagens].reverse().map((c) => ({
      data: format(new Date(c.dataContagem), 'dd/MM', { locale: ptBR }),
      valor: c.valorTotal,
      pecas: c.totalPecas,
    }));
  }, [contagens]);

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = () => {
    if (deleteConfirmId) {
      excluirMutation.mutate(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[96vw] max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-4 pt-4 pb-3 border-b shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-5 w-5 text-primary" />
                  Histórico de Contagens
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-0.5">{localNome}</p>
              </div>
              {onNovaContagem && (
                <Button size="sm" className="h-8" onClick={onNovaContagem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Nova
                </Button>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !contagens || contagens.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma contagem registrada</p>
                <p className="text-xs mt-1">
                  Registre uma contagem para começar a acompanhar vendas
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumo e Gráfico */}
                {metricas && chartData.length >= 2 && (
                  <div className="p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Resumo do Período</span>
                      <span className="text-xs text-muted-foreground">
                        ({metricas.diasTotais} dias)
                      </span>
                    </div>

                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Média/dia</p>
                        <p className="font-semibold text-sm">
                          {metricas.mediaPorDia.toFixed(1)} pç
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Total vendido</p>
                        <p className="font-semibold text-sm text-destructive">
                          R$ {metricas.totalVendidoValor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase">Ticket médio</p>
                        <p className="font-semibold text-sm">
                          R$ {metricas.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    {/* Mini gráfico */}
                    <div className="h-[80px] -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis
                            dataKey="data"
                            tick={{ fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                          <Tooltip
                            formatter={(value: number) => [
                              `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                              'Valor',
                            ]}
                            contentStyle={{
                              fontSize: 12,
                              borderRadius: 8,
                              border: '1px solid hsl(var(--border))',
                              backgroundColor: 'hsl(var(--popover))',
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="valor"
                            stroke="hsl(var(--primary))"
                            strokeWidth={2}
                            dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {/* Lista de contagens */}
                <div className="space-y-2">
                  {contagensComVariacao.map((contagem, index) => (
                    <ContagemCard
                      key={contagem.id}
                      contagem={contagem}
                      isUltima={index === 0}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contagem?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A contagem e todos os seus itens serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
