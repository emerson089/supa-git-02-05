import { useState, useMemo, useRef, useEffect } from 'react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { useEstoque } from '@/contexts/EstoqueContext';
import { useRole } from '@/contexts/RoleContext';
import { useDisponivelCentral, useLocais } from '@/hooks/useEstoqueLocais';
import { useTransferencias, useCriarTransferencia } from '@/hooks/useTransferencias';
import { useEstoqueDetalhadoPorLocal, EstoqueLocalDetalhado } from '@/hooks/useEstoquePorLocalGerenciamento';
import { useVendasDesdeContagem } from '@/hooks/useContagensEstoque';
import { useUserLocations, useHasLocationAccess } from '@/hooks/useUserLocations';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowRight, Plus, Loader2, Minus, X, Check, ArrowLeftRight, Package, Search, Store, Box, Info, FileDown, DollarSign, TrendingUp, ClipboardCheck, History, BarChart3, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PrintEstoqueLocal } from '@/components/estoque/PrintEstoqueLocal';
import { LotImage } from '@/components/production/LotImage';
import { ProdutoEstoqueLocalCard } from '@/components/estoque/ProdutoEstoqueLocalCard';
import { AjusteEstoqueModal } from '@/components/estoque/AjusteEstoqueModal';
import { AdicionarProdutoLocalModal } from '@/components/estoque/AdicionarProdutoLocalModal';
import { HistoricoMovimentacoesModal } from '@/components/estoque/HistoricoMovimentacoesModal';
import { ZerarEstoqueModal } from '@/components/estoque/ZerarEstoqueModal';
import { EditarPrecoLocalModal } from '@/components/estoque/EditarPrecoLocalModal';
import { NovaContagemModal } from '@/components/estoque/NovaContagemModal';
import { HistoricoContagensModal } from '@/components/estoque/HistoricoContagensModal';
import { RelatorioSaidasModal } from '@/components/estoque/RelatorioSaidasModal';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  const { isAdmin, isGerente, isVendedor } = useRole();
  const { getProdutosAcabados } = useEstoque();
  const { locais, estoquePorLocal, isLoading: isLoadingLocais } = useDisponivelCentral();
  const { data: transferencias, isLoading: isLoadingTransferencias } = useTransferencias('transferencia');
  const criarTransferencia = useCriarTransferencia();
  
  // Hook para obter locais permitidos do usuário
  const { data: userLocations = [], isLoading: isLoadingUserLocations } = useUserLocations();

  // Estados para gestão de estoque local
  const [activeTab, setActiveTab] = useState('estoque');
  const [searchEstoque, setSearchEstoque] = useState('');
  const debouncedSearchEstoque = useDebouncedValue(searchEstoque, 300);
  const [showAjusteModal, setShowAjusteModal] = useState(false);
  const [showAdicionarModal, setShowAdicionarModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showZerarModal, setShowZerarModal] = useState(false);
  const [showEditarPrecoModal, setShowEditarPrecoModal] = useState(false);
  const [showNovaContagemModal, setShowNovaContagemModal] = useState(false);
  const [showHistoricoContagensModal, setShowHistoricoContagensModal] = useState(false);
  const [showRelatorioSaidasModal, setShowRelatorioSaidasModal] = useState(false);
  const [itemSelecionado, setItemSelecionado] = useState<EstoqueLocalDetalhado | null>(null);
  const [showPDFPreview, setShowPDFPreview] = useState(false);

  // Estados para modal de nova transferência
  const [showNovaTransferencia, setShowNovaTransferencia] = useState(false);
  const [origemId, setOrigemId] = useState<string>('');
  const [destinoId, setDestinoId] = useState<string>('');
  const [itensTransferencia, setItensTransferencia] = useState<ItemTransferencia[]>([]);
  const [searchProdutos, setSearchProdutos] = useState('');
  const [lastAddedItemId, setLastAddedItemId] = useState<string | null>(null);

  const quantidadeInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const produtosAcabados = getProdutosAcabados();

  // Encontrar local - para vendedor, usar o primeiro local permitido
  // Prioridade: loja > banca > central
  const selectedLocal = useMemo(() => {
    if (isVendedor) {
      // Vendedor: buscar primeiro local permitido (priorizar loja, depois banca)
      const allowedLocations = userLocations.filter(ul => ul.canView);
      
      // Tentar primeiro uma 'loja', depois 'banca', depois qualquer outro
      const priorityOrder: Array<'loja' | 'banca' | 'central'> = ['loja', 'banca', 'central'];
      for (const tipo of priorityOrder) {
        const found = allowedLocations.find(ul => ul.localTipo === tipo);
        if (found) {
          return locais.find(l => l.id === found.localId) || null;
        }
      }
      
      // Fallback: usar primeiro local permitido
      if (allowedLocations.length > 0) {
        return locais.find(l => l.id === allowedLocations[0].localId) || null;
      }
      
      return null;
    }
    
    // Admin/Gerente: usar qualquer loja ou banca
    return locais.find(l => l.tipo === 'loja' || l.tipo === 'banca') || null;
  }, [locais, isVendedor, userLocations]);
  
  const lojaId = selectedLocal?.id || null;
  const lojaNome = selectedLocal?.nome || 'Local';
  
  // Verificar permissões para o local atual
  const locationAccess = useHasLocationAccess(lojaId);
  const canAdjustStock = isAdmin || isGerente || locationAccess.canAdjustStock;
  const canEditPrice = isAdmin || isGerente || locationAccess.canEditPrice;
  
  // Verificar se vendedor tem acesso configurado
  const vendedorSemAcesso = isVendedor && userLocations.length === 0 && !isLoadingUserLocations;

  // Buscar estoque detalhado da loja
  const { data: estoqueDetalhado = [], isLoading: isLoadingEstoqueDetalhado } = useEstoqueDetalhadoPorLocal(lojaId);
  
  // Buscar vendas desde última contagem
  const { data: vendasData } = useVendasDesdeContagem(lojaId);

  // Filtrar produtos do estoque local
  const estoqueFiltrado = useMemo(() => {
    if (!debouncedSearchEstoque.trim()) return estoqueDetalhado;
    const termo = debouncedSearchEstoque.toLowerCase();
    return estoqueDetalhado.filter(item =>
      item.itemNome.toLowerCase().includes(termo) ||
      item.itemCodigo.toLowerCase().includes(termo)
    );
  }, [estoqueDetalhado, debouncedSearchEstoque]);

  // Totais do estoque local
  const totalPecasLocal = useMemo(() => 
    estoqueDetalhado.reduce((sum, item) => sum + item.quantidade, 0),
    [estoqueDetalhado]
  );
  const totalModelosLocal = estoqueDetalhado.length;

  // MVP: Valor do estoque (venda) - usando precoExibido (local > base)
  const { valorEstoqueVenda, itensComPreco, itensSemPreco, itensComPrecoLocal } = useMemo(() => {
    let total = 0;
    let comPreco = 0;
    let semPreco = 0;
    let comPrecoLocal = 0;
    
    estoqueDetalhado.forEach(item => {
      if (item.precoExibido && item.precoExibido > 0) {
        total += item.quantidade * item.precoExibido;
        comPreco++;
        if (item.precoLocal !== null) {
          comPrecoLocal++;
        }
      } else {
        semPreco++;
      }
    });
    
    return { 
      valorEstoqueVenda: total, 
      itensComPreco: comPreco, 
      itensSemPreco: semPreco,
      itensComPrecoLocal: comPrecoLocal 
    };
  }, [estoqueDetalhado]);

  // Locais disponíveis para transferência
  const locaisOrigem = useMemo(() => {
    return locais.filter(l => l.tipo === 'central' || l.tipo === 'loja');
  }, [locais]);

  const locaisDestino = useMemo(() => {
    const filtered = locais.filter(l => l.tipo === 'central' || l.tipo === 'loja');
    return filtered.filter(l => l.id !== origemId);
  }, [locais, origemId]);

  // Locais disponíveis para exibição de resumo
  const locaisDisponiveis = useMemo(() => 
    locais.filter(l => l.tipo === 'central' || l.tipo === 'loja'),
    [locais]
  );

  const getDisponivelNoLocal = (itemId: string, localId: string): number => {
    const estoque = estoquePorLocal.find(e => e.itemId === itemId && e.localId === localId);
    if (!estoque) return 0;
    return Math.max(0, estoque.quantidade - estoque.quantidadeReservada);
  };

  // Produtos filtrados e ordenados para modal de transferência
  const produtosFiltrados = useMemo(() => {
    let filtered = produtosAcabados.filter(p => {
      if (searchProdutos.trim()) {
        const search = searchProdutos.toLowerCase();
        if (!p.nome.toLowerCase().includes(search)) return false;
      }
      return true;
    });
    return filtered.sort((a, b) => {
      const dispA = origemId ? getDisponivelNoLocal(a.id, origemId) : 0;
      const dispB = origemId ? getDisponivelNoLocal(b.id, origemId) : 0;
      return dispB - dispA;
    });
  }, [produtosAcabados, origemId, searchProdutos, estoquePorLocal]);

  useEffect(() => {
    if (lastAddedItemId) {
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

  // Handlers de estoque local
  const handleAjustar = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowAjusteModal(true);
  };

  const handleHistorico = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowHistoricoModal(true);
  };

  const handleZerar = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowZerarModal(true);
  };

  const handleEditarPreco = (item: EstoqueLocalDetalhado) => {
    setItemSelecionado(item);
    setShowEditarPrecoModal(true);
  };

  // Handler para abrir preview do PDF
  const handleExportarPDF = () => {
    if (!lojaId || estoqueDetalhado.length === 0) {
      toast.error('Nenhum produto para exportar');
      return;
    }
    setShowPDFPreview(true);
  };

  // Handler para imprimir (chamado do preview)
  const handlePrint = () => {
    window.print();
  };

  // Handler para fechar preview
  const handleClosePreview = () => {
    setShowPDFPreview(false);
  };

  // Handlers de transferência
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
    setLastAddedItemId(produto.id);
  };

  const handleQuantidadeChange = (itemId: string, value: string) => {
    const numValue = parseInt(value, 10);
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
        if (value === '' || isNaN(numValue)) {
          return { ...item, quantidade: 0 };
        }
        const novaQtd = Math.max(1, Math.min(item.disponivelOrigem, numValue));
        return { ...item, quantidade: novaQtd };
      }
      return item;
    }));
  };

  const handleQuantidadeBlur = (itemId: string) => {
    setItensTransferencia(prev => prev.map(item => {
      if (item.itemId === itemId) {
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
    setSearchProdutos('');
    setLastAddedItemId(null);
    setItensTransferencia([]);
    setOrigemId('');
    setDestinoId('');
    setShowNovaTransferencia(true);
  };

  const handleOrigemChange = (newOrigemId: string) => {
    setOrigemId(newOrigemId);
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

  // Seção: Estoque do Local
  const renderEstoqueLocalSection = () => (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      {/* Header do Estoque */}
      <div className={cn("shrink-0", isMobile ? "px-3 pt-2 pb-3" : "pb-4")}>
        {/* Alerta para vendedor sem acesso configurado */}
        {vendedorSemAcesso && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Acesso não configurado</AlertTitle>
            <AlertDescription>
              Seu usuário ainda não possui acesso a nenhum local. Entre em contato com um administrador para configurar suas permissões.
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <Store className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-semibold truncate">{lojaNome}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setShowRelatorioSaidasModal(true)}
              disabled={!lojaId}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Saídas</span>
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={handleExportarPDF}
              disabled={!lojaId || estoqueDetalhado.length === 0}
            >
              <FileDown className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">PDF</span>
            </Button>
            <Button 
              size="sm" 
              onClick={() => setShowAdicionarModal(true)}
              disabled={!lojaId}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">Adicionar</span>
            </Button>
          </div>
        </div>

        {/* Cards de totais - MVP com valor do estoque */}
        <TooltipProvider>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {/* Total Peças */}
            <Card>
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1">
                  <Package className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Peças</p>
                </div>
                <p className="text-lg sm:text-xl font-bold">{totalPecasLocal}</p>
              </CardContent>
            </Card>

            {/* Total Modelos */}
            <Card>
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1">
                  <Box className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Total Modelos</p>
                </div>
                <p className="text-lg sm:text-xl font-bold">{totalModelosLocal}</p>
              </CardContent>
            </Card>

            {/* Valor Estoque (Venda) - MVP */}
            <Card>
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3 text-emerald-600" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Valor (Venda)</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className={cn("h-3 w-3 cursor-help", itensSemPreco > 0 ? "text-amber-500" : "text-muted-foreground")} />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px]">
                      <div className="text-xs space-y-1">
                        {itensSemPreco > 0 && (
                          <p className="text-amber-600">{itensSemPreco} modelo(s) sem preço.</p>
                        )}
                        {itensComPrecoLocal > 0 && (
                          <p className="text-amber-600">{itensComPrecoLocal} modelo(s) com preço local diferenciado.</p>
                        )}
                        <p className="text-muted-foreground">Calculado usando preço local quando disponível, senão preço base.</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-600">
                  {valorEstoqueVenda > 0 
                    ? `R$ ${valorEstoqueVenda.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                    : '—'
                  }
                </p>
              </CardContent>
            </Card>

            {/* Valor Estoque (Custo) - Placeholder */}
            <Card className="opacity-60">
              <CardContent className="p-2 sm:p-3">
                <div className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3 text-muted-foreground" />
                  <p className="text-[10px] sm:text-xs text-muted-foreground">Valor (Custo)</p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[220px]">
                      <p className="text-xs">Custo unitário por produto ainda não implementado. Será calculado quando campo de custo estiver disponível.</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-lg sm:text-xl font-bold text-muted-foreground">—</p>
              </CardContent>
            </Card>
          </div>

          {/* Card de Contagem/Vendas - Funcional */}
          <Card className={cn("mb-3", !vendasData?.dataContagem && "opacity-70")}>
            <CardContent className="p-2 sm:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    {vendasData?.dataContagem ? (
                      <>
                        <p className="text-xs font-medium">Desde última contagem</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(vendasData.dataContagem), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-medium text-muted-foreground">Nenhuma contagem</p>
                        <p className="text-[10px] text-muted-foreground">Registre para acompanhar vendas</p>
                      </>
                    )}
                  </div>
                </div>
                
                {vendasData?.dataContagem ? (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-bold">{vendasData.pecasVendidas} peças</p>
                      {vendasData.valorVendido > 0 && (
                        <p className="text-xs text-emerald-600">
                          R$ {vendasData.valorVendido.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="h-7 text-xs px-2"
                        onClick={() => setShowNovaContagemModal(true)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Nova
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-7 text-xs px-2"
                        onClick={() => setShowHistoricoContagensModal(true)}
                      >
                        <History className="h-3 w-3 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setShowNovaContagemModal(true)}
                    disabled={estoqueDetalhado.length === 0}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Nova Contagem
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou código..."
            value={searchEstoque}
            onChange={(e) => setSearchEstoque(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Lista de produtos */}
      <ScrollArea className="flex-1 w-full">
        <div className={cn("space-y-2 w-full", isMobile ? "px-3 pb-4" : "pb-4")}>
          {isLoadingEstoqueDetalhado ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : estoqueFiltrado.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">Nenhum produto no estoque</p>
              <p className="text-sm mt-1">
                {searchEstoque ? 'Tente outra busca' : 'Adicione produtos para começar'}
              </p>
            </div>
          ) : (
            estoqueFiltrado.map((item) => (
              <ProdutoEstoqueLocalCard
                key={item.id}
                item={item}
                onAjustar={canAdjustStock ? handleAjustar : undefined}
                onHistorico={handleHistorico}
                onZerar={canAdjustStock ? handleZerar : undefined}
                onEditarPreco={canEditPrice ? handleEditarPreco : undefined}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Seção: Histórico de Transferências
  const renderHistoricoTransferenciasSection = () => (
    <div className="flex flex-col h-full w-full max-w-full overflow-hidden">
      {/* Header do Histórico */}
      <div className={cn("shrink-0", isMobile ? "px-3 pt-2 pb-3" : "pb-4")}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <ArrowLeftRight className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-semibold truncate text-sm sm:text-base">Transferências</h2>
          </div>
          <Button size="sm" onClick={handleOpenModal} className="shrink-0">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline ml-1">Nova</span>
          </Button>
        </div>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 gap-2">
          {locaisDisponiveis.map(local => {
            const total = estoquePorLocal
              .filter(e => e.localId === local.id)
              .reduce((sum, e) => sum + e.quantidade, 0);
            return (
              <Card key={local.id}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 rounded-md",
                      local.tipo === 'central' ? "bg-blue-500/10" : "bg-emerald-500/10"
                    )}>
                      {local.tipo === 'central' ? (
                        <Box className="h-4 w-4 text-blue-600" />
                      ) : (
                        <Store className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted-foreground truncate">{local.nome}</p>
                      <p className="text-lg font-bold">{total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Lista de transferências */}
      <ScrollArea className="flex-1 w-full">
        <div className={cn("space-y-2 w-full", isMobile ? "px-3 pb-4" : "pb-4")}>
          {(!transferencias || transferencias.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <ArrowLeftRight className="h-12 w-12 mb-3 opacity-50" />
              <p className="font-medium">Nenhuma transferência</p>
              <p className="text-sm mt-1">Transferências entre locais aparecerão aqui</p>
            </div>
          ) : (
            transferencias.map(t => (
              <Card key={t.id}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={cn(
                      "text-xs",
                      t.status === 'concluida' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                      t.status === 'cancelada' && "bg-red-50 text-red-700 border-red-200"
                    )}>
                      {t.status === 'concluida' ? 'Concluída' : 'Cancelada'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(t.dataSaida), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium truncate">{getLocalNome(t.localOrigemId)}</span>
                    <ArrowRight size={14} className="text-muted-foreground shrink-0" />
                    <span className="font-medium truncate">{getLocalNome(t.localDestinoId)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // Early return for loading state - placed after render functions are defined
  if (isLoadingLocais || isLoadingTransferencias || isLoadingUserLocations) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex max-w-full overflow-x-hidden">
      {isMobile && <MobileHeader title="Estoque por Local" />}
      {!isMobile && <AppSidebar />}

      <main className={cn(
        "flex-1 flex flex-col h-screen overflow-y-auto overflow-x-hidden w-full max-w-full",
        isMobile && "pt-14 pb-20"
      )}>
        {/* Header - Desktop */}
        {!isMobile && (
          <header className="px-6 py-4 border-b border-border bg-card/50 shrink-0">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Estoque por Local</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestão de estoque por local de armazenamento
              </p>
            </div>
          </header>
        )}

        {/* Conteúdo - Mobile: Tabs, Desktop: Layout dividido */}
        {isMobile ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-4 mt-2 grid w-auto grid-cols-2 shrink-0">
              <TabsTrigger value="estoque" className="gap-1.5">
                <Store className="h-4 w-4" />
                Estoque
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5">
                <ArrowLeftRight className="h-4 w-4" />
                Transferências
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="estoque" className="flex-1 overflow-hidden mt-0">
              {renderEstoqueLocalSection()}
            </TabsContent>
            
            <TabsContent value="historico" className="flex-1 overflow-hidden mt-0">
              {renderHistoricoTransferenciasSection()}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex-1 grid grid-cols-2 gap-6 p-6 overflow-hidden">
            <div className="border rounded-xl p-4 overflow-hidden flex flex-col bg-card">
              {renderEstoqueLocalSection()}
            </div>
            <div className="border rounded-xl p-4 overflow-hidden flex flex-col bg-card">
              {renderHistoricoTransferenciasSection()}
            </div>
          </div>
        )}
      </main>

      {isMobile && <BottomNavigation />}

      {/* Modal de Ajuste de Estoque */}
      <AjusteEstoqueModal
        open={showAjusteModal}
        onOpenChange={setShowAjusteModal}
        item={itemSelecionado}
      />

      {/* Modal de Adicionar Produto */}
      {lojaId && (
        <AdicionarProdutoLocalModal
          open={showAdicionarModal}
          onOpenChange={setShowAdicionarModal}
          localId={lojaId}
          localNome={lojaNome}
        />
      )}

      {/* Modal de Histórico de Movimentações */}
      <HistoricoMovimentacoesModal
        open={showHistoricoModal}
        onOpenChange={setShowHistoricoModal}
        item={itemSelecionado}
      />

      {/* Modal de Zerar Estoque */}
      <ZerarEstoqueModal
        open={showZerarModal}
        onOpenChange={setShowZerarModal}
        item={itemSelecionado}
      />

      {/* Modal de Editar Preço Local */}
      {itemSelecionado && lojaId && (
        <EditarPrecoLocalModal
          open={showEditarPrecoModal}
          onClose={() => setShowEditarPrecoModal(false)}
          item={{
            itemId: itemSelecionado.itemId,
            itemNome: itemSelecionado.itemNome,
            itemImagemUrl: itemSelecionado.itemImagemUrl,
            itemPrecoUnitario: itemSelecionado.itemPrecoUnitario,
          }}
          localId={lojaId}
          localNome={lojaNome}
          precoLocal={itemSelecionado.precoLocal}
        />
      )}

      {/* Modal Nova Contagem */}
      {lojaId && (
        <NovaContagemModal
          open={showNovaContagemModal}
          onOpenChange={setShowNovaContagemModal}
          localId={lojaId}
          localNome={lojaNome}
          itensEstoque={estoqueDetalhado}
        />
      )}

      {/* Modal Histórico de Contagens */}
      {lojaId && (
        <HistoricoContagensModal
          open={showHistoricoContagensModal}
          onOpenChange={setShowHistoricoContagensModal}
          localId={lojaId}
          localNome={lojaNome}
        />
      )}
      <Dialog open={showNovaTransferencia} onOpenChange={setShowNovaTransferencia}>
        <DialogContent className="w-[96vw] max-w-[720px] max-h-[85vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
            <DialogTitle>Nova Transferência</DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Seleção de Origem e Destino */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">De:</Label>
                <Select 
                  value={origemId} 
                  onValueChange={handleOrigemChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione origem" />
                  </SelectTrigger>
                  <SelectContent>
                    {locaisOrigem.map(local => (
                      <SelectItem key={local.id} value={local.id}>
                        {local.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">Para:</Label>
                <Select 
                  value={destinoId} 
                  onValueChange={setDestinoId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {locaisDestino.map(local => (
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
                          <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border">
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
                      <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 border">
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
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={item.quantidade || ''}
                          onChange={e => handleQuantidadeChange(item.itemId, e.target.value.replace(/\D/g, ''))}
                          onBlur={() => handleQuantidadeBlur(item.itemId)}
                          onFocus={(e) => e.target.select()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.currentTarget.blur();
                            }
                          }}
                          className="w-14 h-8 text-center font-medium"
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
          <div className="sticky bottom-0 px-6 py-4 border-t bg-background flex items-center justify-between shrink-0">
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

      {/* Componente de impressão - modo preview ou oculto */}
      <PrintEstoqueLocal 
        itens={estoqueDetalhado} 
        localNome={lojaNome}
        showPreview={showPDFPreview}
        onClose={handleClosePreview}
        onPrint={handlePrint}
      />

      {/* Modal de Relatório de Saídas */}
      <RelatorioSaidasModal
        open={showRelatorioSaidasModal}
        onOpenChange={setShowRelatorioSaidasModal}
        localIdInicial={lojaId || undefined}
      />
    </div>
  );
}
