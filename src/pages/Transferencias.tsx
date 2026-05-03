import { useState } from 'react';
import { ArrowLeftRight, Plus, Loader2, ArrowRight, Package, Search } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { FiltrosTransferencias, FiltrosTransferenciasState } from '@/components/transferencias/FiltrosTransferencias';
import { DetalhesTransferenciaModal } from '@/components/transferencias/DetalhesTransferenciaModal';
import { useLocais } from '@/hooks/useEstoqueLocais';
import { useEstoqueDetalhadoPorLocal } from '@/hooks/useEstoquePorLocalGerenciamento';
import {
  useTransferenciasFiltradas,
  useCriarTransferencia,
  type Transferencia,
  type FiltrosTransferencias as FiltrosType,
} from '@/hooks/useTransferencias';
import { useTiposAjuste } from '@/hooks/useTiposAjuste';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { StatusTransferencia } from '@/components/transferencias/FiltrosTransferencias';

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  em_andamento: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
  concluida: { label: 'Concluída', className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
  cancelada: { label: 'Cancelada', className: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400' },
};

interface ItemSelecionado {
  itemId: string;
  itemNome: string;
  quantidade: number;
  disponivel: number;
}

const FILTROS_INICIAIS: FiltrosTransferenciasState = {
  dataInicio: undefined,
  dataFim: undefined,
  origemId: '',
  destinoId: '',
  status: '',
  motivo: '',
};

export default function Transferencias() {
  const { user } = useAuth();
  const [filtros, setFiltros] = useState<FiltrosTransferenciasState>(FILTROS_INICIAIS);
  const [novaSheetOpen, setNovaSheetOpen] = useState(false);
  const [detalhesOpen, setDetalhesOpen] = useState(false);
  const [transferenciaAtual, setTransferenciaAtual] = useState<Transferencia | null>(null);

  // Nova transferência form state
  const [origemId, setOrigemId] = useState('');
  const [destinoId, setDestinoId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [itensSelecionados, setItensSelecionados] = useState<ItemSelecionado[]>([]);
  const [buscaItem, setBuscaItem] = useState('');

  const { data: locais = [] } = useLocais();
  const { data: tiposAtivos = [] } = useTiposAjuste();

  const filtrosHook: FiltrosType = {
    dataInicio: filtros.dataInicio,
    dataFim: filtros.dataFim,
    origemId: filtros.origemId || undefined,
    destinoId: filtros.destinoId || undefined,
    status: (filtros.status as StatusTransferencia) || undefined,
    motivo: filtros.motivo || undefined,
  };

  const { data: transferencias = [], isLoading } = useTransferenciasFiltradas('transferencia', filtrosHook);
  const { data: itensOrigem = [], isLoading: loadingItens } = useEstoqueDetalhadoPorLocal(origemId || null);
  const criarTransferencia = useCriarTransferencia();

  // Fetch items for detalhes modal
  const { data: itensModal = [] } = useQuery({
    queryKey: ['transferencia-itens-modal', transferenciaAtual?.id],
    queryFn: async () => {
      if (!transferenciaAtual?.id) return [];
      const { data, error } = await supabase
        .from('transferencia_itens')
        .select('id, item_id, quantidade_enviada, nome_produto, imagem_url_produto')
        .eq('transferencia_id', transferenciaAtual.id);
      if (error) throw error;
      return (data || []).map(i => ({
        id: i.id,
        itemId: i.item_id || '',
        itemNome: i.nome_produto || 'Produto',
        itemImagemUrl: i.imagem_url_produto,
        quantidadeEnviada: i.quantidade_enviada,
      }));
    },
    enabled: !!transferenciaAtual?.id && detalhesOpen,
  });

  const itensFiltrados = itensOrigem.filter(item =>
    item.itemNome.toLowerCase().includes(buscaItem.toLowerCase())
  );

  const handleAbrirDetalhes = (t: Transferencia) => {
    setTransferenciaAtual(t);
    setDetalhesOpen(true);
  };

  const handleAbrirNova = () => {
    setOrigemId('');
    setDestinoId('');
    setMotivo('');
    setObservacoes('');
    setItensSelecionados([]);
    setBuscaItem('');
    setNovaSheetOpen(true);
  };

  const handleToggleItem = (item: typeof itensOrigem[0]) => {
    const disponivel = item.quantidade - item.quantidadeReservada;
    if (disponivel <= 0) {
      toast.error(`${item.itemNome} sem estoque disponível`);
      return;
    }
    const existe = itensSelecionados.find(i => i.itemId === item.itemId);
    if (existe) {
      setItensSelecionados(prev => prev.filter(i => i.itemId !== item.itemId));
    } else {
      setItensSelecionados(prev => [...prev, {
        itemId: item.itemId,
        itemNome: item.itemNome,
        quantidade: 1,
        disponivel,
      }]);
    }
  };

  const handleQuantidade = (itemId: string, valor: string) => {
    const num = parseInt(valor, 10);
    if (isNaN(num) || num < 1) return;
    setItensSelecionados(prev =>
      prev.map(i => i.itemId === itemId
        ? { ...i, quantidade: Math.min(num, i.disponivel) }
        : i
      )
    );
  };

  const handleCriar = async () => {
    if (!origemId) { toast.error('Selecione a origem'); return; }
    if (!destinoId) { toast.error('Selecione o destino'); return; }
    if (origemId === destinoId) { toast.error('Origem e destino devem ser diferentes'); return; }
    if (itensSelecionados.length === 0) { toast.error('Adicione pelo menos um item'); return; }
    if (!motivo) { toast.error('Selecione o motivo'); return; }

    try {
      await criarTransferencia.mutateAsync({
        origemId,
        destinoId,
        itens: itensSelecionados.map(i => ({ itemId: i.itemId, quantidade: i.quantidade })),
        motivo,
        observacoes: observacoes || undefined,
      });
      toast.success('Transferência criada com sucesso!');
      setNovaSheetOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar transferência');
    }
  };

  const transferenciaParaModal = transferenciaAtual ? {
    id: transferenciaAtual.id,
    localOrigemId: transferenciaAtual.localOrigemId,
    localOrigemNome: transferenciaAtual.localOrigemNome || 'Local',
    localDestinoId: transferenciaAtual.localDestinoId,
    localDestinoNome: transferenciaAtual.localDestinoNome || 'Local',
    status: transferenciaAtual.status,
    motivo: transferenciaAtual.motivo,
    observacoes: transferenciaAtual.observacoes,
    createdAt: transferenciaAtual.createdAt,
    dataConclusao: transferenciaAtual.dataConclusao,
    concluidoPor: transferenciaAtual.concluidoPor,
    concluidoPorNome: null,
    concluidoPorRole: null,
    criadorNome: null,
    criadorRole: null,
  } : null;

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <MobileHeader title="Transferências" />

      <main className="md:pl-64 pb-20 md:pb-0">
        <div className="p-4 md:p-6 max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 pt-14 md:pt-0">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-6 w-6 text-primary" />
              <h1 className="text-xl md:text-2xl font-bold">Transferências</h1>
            </div>
            <Button size="sm" onClick={handleAbrirNova} className="gap-2 hidden md:flex">
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          </div>

          {/* Filtros */}
          <div className="mb-4">
            <FiltrosTransferencias
              filtros={filtros}
              onFiltrosChange={setFiltros}
              locais={locais}
              onNovaClick={handleAbrirNova}
            />
          </div>

          {/* Lista */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : transferencias.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">Nenhuma transferência encontrada</p>
              <p className="text-sm text-muted-foreground mt-1">Crie uma nova transferência para começar</p>
              <Button className="mt-4 gap-2" onClick={handleAbrirNova}>
                <Plus className="h-4 w-4" />
                Nova Transferência
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {transferencias.map(t => {
                const status = STATUS_CONFIG[t.status] || STATUS_CONFIG.em_andamento;
                return (
                  <Card
                    key={t.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handleAbrirDetalhes(t)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-mono text-muted-foreground">
                              #{t.id.slice(0, 8)}
                            </span>
                            <Badge className={cn('text-xs', status.className)}>
                              {status.label}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium truncate">{t.localOrigemNome || 'Origem'}</span>
                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium truncate">{t.localDestinoNome || 'Destino'}</span>
                          </div>
                          {t.motivo && (
                            <p className="text-xs text-muted-foreground mt-1">{t.motivo}</p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.createdAt), "dd/MM/yy", { locale: ptBR })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(t.createdAt), "HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <BottomNavigation />

      {/* Modal de Detalhes */}
      <DetalhesTransferenciaModal
        open={detalhesOpen}
        onOpenChange={setDetalhesOpen}
        transferencia={transferenciaParaModal}
        itensDetalhados={itensModal}
      />

      {/* Sheet Nova Transferência */}
      <Sheet open={novaSheetOpen} onOpenChange={setNovaSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          <SheetHeader className="p-4 pb-2 border-b">
            <SheetTitle className="flex items-center gap-2">
              <ArrowLeftRight className="h-5 w-5 text-primary" />
              Nova Transferência
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Origem e Destino */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Origem</Label>
                  <Select value={origemId} onValueChange={(v) => { setOrigemId(v); setItensSelecionados([]); setBuscaItem(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {locais.map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Destino</Label>
                  <Select value={destinoId} onValueChange={setDestinoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {locais.filter(l => l.id !== origemId).map(l => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Motivo */}
              <div className="space-y-1.5">
                <Label>Motivo</Label>
                <Select value={motivo} onValueChange={setMotivo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposAtivos.map(tipo => (
                      <SelectItem key={tipo.id} value={tipo.nome}>{tipo.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Observações */}
              <div className="space-y-1.5">
                <Label>Observações</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Opcional..."
                  className="resize-none min-h-[60px]"
                />
              </div>

              {/* Itens */}
              {origemId && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Itens</Label>
                    {itensSelecionados.length > 0 && (
                      <Badge variant="secondary">{itensSelecionados.length} selecionado(s)</Badge>
                    )}
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar produto..."
                      value={buscaItem}
                      onChange={(e) => setBuscaItem(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {loadingItens ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                    </div>
                  ) : itensFiltrados.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {buscaItem ? 'Nenhum produto encontrado' : 'Nenhum produto neste local'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {itensFiltrados.map(item => {
                        const disponivel = item.quantidade - item.quantidadeReservada;
                        const selecionado = itensSelecionados.find(i => i.itemId === item.itemId);
                        return (
                          <div
                            key={item.itemId}
                            className={cn(
                              'rounded-lg border p-3 cursor-pointer transition-colors',
                              selecionado
                                ? 'border-primary bg-primary/5'
                                : disponivel > 0
                                  ? 'hover:bg-muted/50'
                                  : 'opacity-50 cursor-not-allowed'
                            )}
                            onClick={() => handleToggleItem(item)}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.itemNome}</p>
                                <p className="text-xs text-muted-foreground">
                                  Disponível: {disponivel}
                                </p>
                              </div>
                              {selecionado && (
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={selecionado.disponivel}
                                    value={selecionado.quantidade}
                                    onChange={(e) => handleQuantidade(item.itemId, e.target.value)}
                                    className="w-16 h-8 text-center text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          <div className="p-4 border-t">
            <Button
              className="w-full"
              onClick={handleCriar}
              disabled={criarTransferencia.isPending}
            >
              {criarTransferencia.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar Transferência
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
