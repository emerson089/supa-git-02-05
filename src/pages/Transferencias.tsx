import { useState, useMemo, useRef, useEffect } from 'react';
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
import { ArrowRight, Plus, Loader2, Minus, X, Check, ArrowLeftRight, Package, Search } from 'lucide-react';
import { LotImage } from '@/components/production/LotImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ItemTransferencia {
  itemId: string;
  nome: string;
  imagemUrl: string | null;
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
  const [searchProdutos, setSearchProdutos] = useState('');
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const quantidadeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

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

  // Produtos filtrados e ordenados
  const produtosFiltrados = useMemo(() => {
    let filtered = produtosAcabados.filter(p => {
      // Filtrar por busca
      if (searchProdutos.trim()) {
        const search = searchProdutos.toLowerCase();
        if (!p.nome.toLowerCase().includes(search)) return false;
      }
      return true;
    });
    
    // Ordenar: maior estoque primeiro
    return filtered.sort((a, b) => {
      const dispA = origemId ? getDisponivelNoLocal(a.id, origemId) : 0;
      const dispB = origemId ? getDisponivelNoLocal(b.id, origemId) : 0;
      return dispB - dispA;
    });
  }, [produtosAcabados, origemId, searchProdutos, estoquePorLocal]);

  // Auto-focus no input de quantidade do item recém adicionado
  useEffect(() => {
    if (lastAddedItemId) {
      // Pequeno delay para garantir que o DOM atualizou
      setTimeout(() => {
        const input = quantidadeInputRefs.current.get(lastAddedItemId);
        if (input) {
          input.focus();
          input.select();
        }
        setLastAddedItemId(null);
      }, 50);
    }
  }, [lastAddedItemId, itensTransferencia]);

  const handleAddItemTransferencia = (produto: { id: string; nome: string; imagemUrl?: string | null }) => {
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
      imagemUrl: produto.imagemUrl || null,
      quantidade: 1,
      disponivelOrigem: disponivel,
    }]);

    // Marcar para auto-focus
    setLastAddedItemId(produto.id);
  };

  const handleQuantidadeChange = (itemId: string, value: string) => {
    const numValue = parseInt(value, 10);
    
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        // Se vazio ou NaN, deixar como está para permitir digitação
        if (value === '' || isNaN(numValue)) {
          return { ...item, quantidade: 0 };
        }
        // Validar: mínimo 1, máximo disponível
        const novaQtd = Math.max(1, Math.min(item.disponivelOrigem, numValue));
        return { ...item, quantidade: novaQtd };
      }
      return item;
    }));
  };

  const handleQuantidadeBlur = (itemId: string) => {
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        // Garantir valor válido no blur
        const qtd = Math.max(1, Math.min(item.disponivelOrigem, item.quantidade || 1));
        return { ...item, quantidade: qtd };
      }
      return item;
    }));
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
    setSearchProdutos('');
    setLastAddedItemId(null);
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle>Nova Transferência</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
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

            {/* Seção: Produtos Disponíveis */}
            {origemId && (
              <div className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Produtos Disponíveis</span>
                  <Badge variant="secondary" className="ml-auto">
                    {produtosFiltrados.length} produtos
                  </Badge>
                </div>

                {/* Campo de busca */}
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto..."
                    value={searchProdutos}
                    onChange={(e) => setSearchProdutos(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                <ScrollArea className="h-48">
                  <div className="space-y-2 pr-2">
                    {produtosFiltrados.map(produto => {
                      const disponivel = getDisponivelNoLocal(produto.id, origemId);
                      const jaAdicionado = itensTransferencia.some(i => i.itemId === produto.id);
                      
                      return (
                        <div 
                          key={produto.id}
                          className={cn(
                            "flex items-center gap-3 p-2 rounded-lg border bg-background transition-colors",
                            jaAdicionado 
                              ? "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20" 
                              : disponivel > 0 
                                ? "hover:bg-muted/50 cursor-pointer hover:border-primary/30"
                                : "opacity-40"
                          )}
                          onClick={() => !jaAdicionado && disponivel > 0 && handleAddItemTransferencia(produto)}
                        >
                          {/* Foto do produto */}
                          <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 border">
                            <LotImage 
                              src={produto.imagemUrl} 
                              alt={produto.nome}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{produto.nome}</p>
                            <p className="text-xs text-muted-foreground">
                              Disp: <span className="font-medium">{disponivel}</span>
                            </p>
                          </div>

                          {!jaAdicionado && disponivel > 0 && (
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddItemTransferencia(produto);
                              }}
                            >
                              <Plus size={16} />
                            </Button>
                          )}
                          {jaAdicionado && (
                            <div className="h-8 w-8 shrink-0 flex items-center justify-center">
                              <Check size={16} className="text-emerald-600" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {produtosFiltrados.length === 0 && (
                      <div className="py-8 text-center text-muted-foreground text-sm">
                        {searchProdutos ? 'Nenhum produto encontrado' : 'Nenhum produto disponível'}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Seção: Itens para Transferir */}
            <div className={cn(
              "rounded-xl border p-4 transition-colors",
              itensTransferencia.length > 0 
                ? "border-primary/30 bg-primary/5" 
                : "bg-muted/20"
            )}>
              <div className="flex items-center gap-2 mb-3">
                <ArrowRight className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Itens para Transferir</span>
                {itensTransferencia.length > 0 && (
                  <Badge className="ml-auto">
                    {totalPecas} peças
                  </Badge>
                )}
              </div>

              {itensTransferencia.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhum item selecionado</p>
                  <p className="text-xs mt-1">Selecione produtos da lista acima</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {itensTransferencia.map(item => (
                    <div 
                      key={item.itemId}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-background"
                    >
                      {/* Foto do produto */}
                      <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 border">
                        <LotImage 
                          src={item.imagemUrl} 
                          alt={item.nome}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Máx: {item.disponivelOrigem}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => handleUpdateQuantidade(item.itemId, -1)}
                          disabled={item.quantidade <= 1}
                        >
                          <Minus size={14} />
                        </Button>
                        
                        <Input
                          ref={el => {
                            if (el) {
                              quantidadeInputRefs.current.set(item.itemId, el);
                            } else {
                              quantidadeInputRefs.current.delete(item.itemId);
                            }
                          }}
                          type="number"
                          min={1}
                          max={item.disponivelOrigem}
                          value={item.quantidade || ''}
                          onChange={e => handleQuantidadeChange(item.itemId, e.target.value)}
                          onBlur={() => handleQuantidadeBlur(item.itemId)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-14 h-8 text-center font-medium [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        
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
                          className="h-8 w-8 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveItem(item.itemId)}
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Rodapé Fixo */}
          <div className="sticky bottom-0 px-6 py-4 border-t bg-background flex items-center justify-between">
            <div className="text-sm">
              <span className="text-muted-foreground">Total: </span>
              <span className="font-bold">{itensTransferencia.length} itens</span>
              <span className="text-muted-foreground"> ({totalPecas} peças)</span>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
