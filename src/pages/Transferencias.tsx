import { useState, useMemo } from 'react';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useDisponivelCentral, useLocais } from '@/hooks/useEstoqueLocais';
import { useTransferencias, useCriarTransferencia } from '@/hooks/useTransferencias';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowRight, Plus, Loader2, Minus, X, Check, ArrowLeftRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ItemTransferencia {
  itemId: string;
  nome: string;
  quantidade: number;
  disponivelOrigem: number;
}

export default function Transferencias() {
  const isMobile = useIsMobile();
  const { getProdutosAcabados } = useEstoque();
  const { locais, estoquePorLocal, isLoading: isLoadingLocais } = useDisponivelCentral();
  const { data: transferencias, isLoading: isLoadingTransferencias } = useTransferencias('transferencia');
  const criarTransferencia = useCriarTransferencia();

  const [showNovaTransferencia, setShowNovaTransferencia] = useState(false);
  const [origemId, setOrigemId] = useState<string>('');
  const [destinoId, setDestinoId] = useState<string>('');
  const [itensTransferencia, setItensTransferencia] = useState<ItemTransferencia[]>([]);

  const produtosAcabados = getProdutosAcabados();

  // Locais disponíveis (apenas Central e Loja para transferências)
  const locaisDisponiveis = useMemo(() => 
    locais.filter(l => l.tipo === 'central' || l.tipo === 'loja'),
    [locais]
  );

  const getDisponivelNoLocal = (itemId: string, localId: string): number => {
    const estoque = estoquePorLocal.find(e => e.itemId === itemId && e.localId === localId);
    if (!estoque) return 0;
    return Math.max(0, estoque.quantidade - estoque.quantidadeReservada);
  };

  const handleAddItemTransferencia = (produto: { id: string; nome: string }) => {
    if (!origemId) {
      toast.error('Selecione o local de origem primeiro');
      return;
    }

    const disponivel = getDisponivelNoLocal(produto.id, origemId);
    if (disponivel <= 0) {
      toast.error('Produto sem estoque disponível no local de origem');
      return;
    }

    const existing = itensTransferencia.find(i => i.itemId === produto.id);
    if (existing) {
      toast.error('Produto já adicionado');
      return;
    }

    setItensTransferencia(prev => [...prev, {
      itemId: produto.id,
      nome: produto.nome,
      quantidade: 1,
      disponivelOrigem: disponivel,
    }]);
  };

  const handleUpdateQuantidade = (itemId: string, delta: number) => {
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        const novaQtd = Math.max(1, Math.min(item.disponivelOrigem, item.quantidade + delta));
        return { ...item, quantidade: novaQtd };
      }
      return item;
    }));
  };

  const handleRemoveItem = (itemId: string) => {
    setItensTransferencia(prev => prev.filter(i => i.itemId !== itemId));
  };

  const handleCriarTransferencia = async () => {
    if (!origemId || !destinoId) {
      toast.error('Selecione origem e destino');
      return;
    }

    if (origemId === destinoId) {
      toast.error('Origem e destino devem ser diferentes');
      return;
    }

    if (itensTransferencia.length === 0) {
      toast.error('Adicione ao menos um item');
      return;
    }

    try {
      await criarTransferencia.mutateAsync({
        origemId,
        destinoId,
        itens: itensTransferencia.map(i => ({
          itemId: i.itemId,
          quantidade: i.quantidade,
        })),
      });
      toast.success('Transferência realizada com sucesso!');
      setShowNovaTransferencia(false);
      setItensTransferencia([]);
      setOrigemId('');
      setDestinoId('');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar transferência');
    }
  };

  const handleOpenModal = () => {
    setOrigemId('');
    setDestinoId('');
    setItensTransferencia([]);
    setShowNovaTransferencia(true);
  };

  // Atualizar disponível quando mudar origem
  const handleOrigemChange = (newOrigemId: string) => {
    setOrigemId(newOrigemId);
    // Atualizar disponível dos itens já adicionados
    setItensTransferencia(prev => prev.map(item => ({
      ...item,
      disponivelOrigem: getDisponivelNoLocal(item.itemId, newOrigemId),
      quantidade: Math.min(item.quantidade, getDisponivelNoLocal(item.itemId, newOrigemId)),
    })).filter(item => item.disponivelOrigem > 0));
  };

  const totalPecas = itensTransferencia.reduce((sum, i) => sum + i.quantidade, 0);

  const getLocalNome = (localId: string) => {
    return locais.find(l => l.id === localId)?.nome || 'Desconhecido';
  };

  if (isLoadingLocais || isLoadingTransferencias) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex overflow-hidden">
      {isMobile && <MobileHeader title="Transferências" />}
      {!isMobile && <AppSidebar />}

      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-hidden",
        isMobile && "pt-14 pb-20"
      )}>
        {/* Header - Desktop */}
        {!isMobile && (
          <header className="px-6 py-4 border-b border-border bg-card/50">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Transferências</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Movimentação entre locais de estoque
                </p>
              </div>
              <Button onClick={handleOpenModal} className="gap-2">
                <Plus size={18} />
                Nova Transferência
              </Button>
            </div>
          </header>
        )}

        {/* Mobile Action Button */}
        {isMobile && (
          <div className="px-4 py-3">
            <Button onClick={handleOpenModal} className="w-full gap-2">
              <Plus size={18} />
              Nova Transferência
            </Button>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className={cn("p-4 space-y-4", !isMobile && "p-6 space-y-6")}>
            {/* Resumo por Local */}
            <div className={cn("grid gap-3", isMobile ? "grid-cols-2" : "grid-cols-3")}>
              {locaisDisponiveis.map(local => {
                const total = estoquePorLocal
                  .filter(e => e.localId === local.id)
                  .reduce((sum, e) => sum + e.quantidade, 0);
                const reservado = estoquePorLocal
                  .filter(e => e.localId === local.id)
                  .reduce((sum, e) => sum + e.quantidadeReservada, 0);

                return (
                  <Card key={local.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg",
                          local.tipo === 'central' ? "bg-blue-500/10" : "bg-emerald-500/10"
                        )}>
                          <Package className={cn(
                            "h-5 w-5",
                            local.tipo === 'central' ? "text-blue-600" : "text-emerald-600"
                          )} />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground truncate">{local.nome}</p>
                          <p className="text-xl font-bold">{total}</p>
                          {reservado > 0 && (
                            <p className="text-xs text-amber-600">({reservado} reservado)</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Histórico */}
            <div>
              <h2 className="text-lg font-semibold mb-3">Histórico de Transferências</h2>
              {(!transferencias || transferencias.length === 0) ? (
                <Card className="p-8 text-center">
                  <ArrowLeftRight className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">Nenhuma transferência</h3>
                  <p className="text-sm text-muted-foreground">
                    Transferências entre locais aparecerão aqui
                  </p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {transferencias.map(t => (
                    <Card key={t.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn(
                              t.status === 'concluida' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                              t.status === 'cancelada' && "bg-red-50 text-red-700 border-red-200"
                            )}>
                              {t.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(t.dataSaida), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2 text-sm">
                          <span className="font-medium">{getLocalNome(t.localOrigemId)}</span>
                          <ArrowRight size={14} className="text-muted-foreground" />
                          <span className="font-medium">{getLocalNome(t.localDestinoId)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </main>

      {isMobile && <BottomNavigation />}

      {/* Modal Nova Transferência */}
      <Dialog open={showNovaTransferencia} onOpenChange={setShowNovaTransferencia}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Nova Transferência</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4">
            {/* Seleção de Origem e Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">De:</Label>
                <Select value={origemId} onValueChange={handleOrigemChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {locaisDisponiveis.map(local => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Para:</Label>
                <Select value={destinoId} onValueChange={setDestinoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {locaisDisponiveis
                      .filter(l => l.id !== origemId)
                      .map(local => (
                        <SelectItem key={local.id} value={local.id}>
                          {local.nome}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Produtos Disponíveis */}
            {origemId && (
              <div>
                <Label className="text-sm font-medium mb-2 block">Adicionar Produtos</Label>
                <ScrollArea className="h-40 border rounded-lg p-2">
                  <div className="space-y-2">
                    {produtosAcabados.map(produto => {
                      const disponivel = getDisponivelNoLocal(produto.id, origemId);
                      const jaAdicionado = itensTransferencia.some(i => i.itemId === produto.id);
                      
                      return (
                        <div 
                          key={produto.id}
                          className={cn(
                            "flex items-center justify-between p-2 rounded-lg border transition-colors",
                            jaAdicionado 
                              ? "bg-muted/50 opacity-50" 
                              : disponivel > 0 
                                ? "hover:bg-muted/30 cursor-pointer"
                                : "opacity-40"
                          )}
                          onClick={() => !jaAdicionado && disponivel > 0 && handleAddItemTransferencia(produto)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Disponível: {disponivel}
                            </p>
                          </div>
                          {!jaAdicionado && disponivel > 0 && (
                            <Plus size={16} className="text-primary shrink-0" />
                          )}
                          {jaAdicionado && (
                            <Check size={16} className="text-emerald-600 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Itens Selecionados */}
            {itensTransferencia.length > 0 && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Itens para Transferir ({totalPecas} peças)
                </Label>
                <div className="space-y-2">
                  {itensTransferencia.map(item => (
                    <div 
                      key={item.itemId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Disponível: {item.disponivelOrigem}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantidade(item.itemId, -1)}
                          disabled={item.quantidade <= 1}
                        >
                          <Minus size={14} />
                        </Button>
                        <span className="w-8 text-center font-medium">{item.quantidade}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantidade(item.itemId, 1)}
                          disabled={item.quantidade >= item.disponivelOrigem}
                        >
                          <Plus size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleRemoveItem(item.itemId)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm">
                <span className="text-muted-foreground">Total: </span>
                <span className="font-bold">{totalPecas} peças</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowNovaTransferencia(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCriarTransferencia}
                  disabled={!origemId || !destinoId || itensTransferencia.length === 0 || criarTransferencia.isPending}
                >
                  {criarTransferencia.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-4 w-4 mr-2" />
                  )}
                  Transferir
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
